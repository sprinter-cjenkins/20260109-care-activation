import { Injectable } from '@nestjs/common';
import { CallerProvider, CallInitiationRequest, CallResult } from './caller-provider';
import { LoggerNoPHI } from '#logger/logger';
import { buildRequestData, getCitationSchemaID } from '#caller/utils';
import { cleanJsonString, getSummaryPrompt, getVoicemailMessage } from '#caller/utils';
import type { Request } from 'express';
import crypto from 'node:crypto';
import { getErrorMessage } from '#src/util/getErrorMessage';
import { getPatientPhoneNumber } from '#patient/utils';
import { getBlandAIConfig } from '#src/auth/bland-ai.credentials';
import getBlandPathwayID from '#src/pathway/providers/bland-ai/getBlandPathwayID';

export interface BlandAIResponse {
  status: string;
  message: string;
  call_id: string;
  batch_id: string;
  errors: string[];
  transcript?: string;
  answers?: Record<string, string>;
  id?: string;
  summary: string;
  answered_by: string;
}

interface BlandAISummary {
  questions: Array<{ key: string; value: string }>;
  other: Array<{ key: string; value: string }>;
  verifications: Array<{ key: string; result: string; expected: string; received: string }>;
  requested_opt_out: boolean;
}

export interface ParsedBlandAIResponse {
  call_id: string;
  answered_by: string;
  summary: BlandAISummary;
}

@Injectable()
export class BlandAICallerProvider implements CallerProvider {
  name: string = 'bland-ai';

  private readonly blandAPIKey: string;
  private readonly encryptedKey: string;
  private readonly fromNumber: string;

  private readonly blandAPIURL: string;

  private readonly logger: LoggerNoPHI;

  constructor(logger: LoggerNoPHI) {
    this.logger = logger;

    const { blandAPIKey, encryptedKey, fromNumber, blandAPIURL } = getBlandAIConfig();

    if (blandAPIKey == null) {
      throw new Error('BLAND_AI_API_KEY environment variable not set');
    }

    if (encryptedKey == null) {
      throw new Error('BLAND_AI_TWILIO_ENCRYPTED_KEY environment variable not set');
    }

    if (fromNumber == null) {
      throw new Error('BLAND_AI_FROM_NUMBER environment variable not set');
    }
    this.blandAPIKey = blandAPIKey;
    this.encryptedKey = encryptedKey;
    this.fromNumber = fromNumber;
    this.blandAPIURL = blandAPIURL;
  }

  async initiateCall(request: CallInitiationRequest): Promise<CallResult> {
    const { patient, careTaskType } = request;

    const pathwayID = getBlandPathwayID(careTaskType);

    if (!pathwayID) {
      throw new Error('Pathway ID not found');
    }

    try {
      const response = await fetch(`${this.blandAPIURL}/calls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: this.blandAPIKey,
          encrypted_key: this.encryptedKey,
        },
        body: JSON.stringify({
          phone_number: getPatientPhoneNumber(patient),
          voice: 'June',
          pathway_id: pathwayID,
          voicemail: {
            message: getVoicemailMessage(patient, careTaskType),
            action: 'leave_message',
            sensitive: true,
          },
          request_data: buildRequestData(patient),
          summary_prompt: getSummaryPrompt(patient),
          record: true,
          noise_cancellation: true,
          citation_schema_ids: [getCitationSchemaID(careTaskType)],
          ...(process.env.NODE_ENV !== 'development' && {
            webhook: process.env.BLAND_AI_WEBHOOK_URL,
          }),
          from: this.fromNumber,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Bland AI API error: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      const data = (await response.json()) as BlandAIResponse;

      this.logger.log(`Call initiated successfully: ${data.call_id}`);

      return {
        callID: data.call_id,
        status: 'initiated',
      };
    } catch (error) {
      this.logger.error(`Failed to initiate call:`, { error: getErrorMessage(error) });
      return {
        callID: '',
        status: 'failed',
      };
    }
  }
  async getCall(callID: string): Promise<CallResult> {
    if (!this.blandAPIKey) {
      throw new Error('BLAND_AI_API_KEY environment variable not set');
    }

    try {
      const response = await fetch(`${this.blandAPIURL}/calls/${callID}`, {
        method: 'GET',
        headers: {
          authorization: this.blandAPIKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Bland AI API error: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      const data = (await response.json()) as BlandAIResponse;
      const parsedData = this.parseBlandAIResponse(data);
      const answeredBy =
        parsedData.answered_by === 'human' || parsedData.answered_by === 'voicemail'
          ? parsedData.answered_by
          : undefined;
      return {
        callID: parsedData.call_id || callID,
        status: data.status === 'completed' ? 'completed' : 'initiated',
        summary: parsedData.summary,
        answeredBy,
      };
    } catch (error) {
      this.logger.error(`Failed to get call status:`, { error: getErrorMessage(error) });
      return {
        callID: callID,
        status: 'failed',
      };
    }
  }

  parseBlandAIResponse(data: BlandAIResponse): ParsedBlandAIResponse {
    const { call_id, answered_by, summary } = data;
    let parsedSummary: BlandAISummary = {
      questions: [],
      other: [],
      verifications: [],
      requested_opt_out: false,
    };
    try {
      // sometimes the LLM wraps the json string with "Here is the json string" or something like that
      const croppedJSONSummary = summary.slice(summary.indexOf('{'), summary.lastIndexOf('}') + 1);
      parsedSummary = JSON.parse(cleanJsonString(croppedJSONSummary)) as BlandAISummary;
    } catch (error) {
      this.logger.error(`Failed to parse summary:`, {
        error: getErrorMessage(error),
        externalCallID: call_id,
      });
      parsedSummary.other.push({ key: 'failureReason', value: summary });
    }
    return { call_id, answered_by, summary: parsedSummary };
  }

  parseWebhook(request: Request): Promise<CallResult> {
    const signature = request.headers['x-webhook-signature'] as string | undefined;
    const secret = process.env.BLAND_AI_WEBHOOK_SECRET;

    const rawBody = (request.body as Buffer).toString('utf8');
    const body = JSON.parse(rawBody) as BlandAIResponse;

    if (!signature || !secret) {
      throw new Error('Bland AI webhook signature or secret not found');
    }
    const verified = this.verifyWebhookSignature(signature, secret, rawBody);
    if (!verified) {
      throw new Error('Invalid webhook signature');
    }
    const parsedData = this.parseBlandAIResponse(body);
    const answeredBy =
      parsedData.answered_by === 'human' || parsedData.answered_by === 'voicemail'
        ? parsedData.answered_by
        : undefined;
    return Promise.resolve({
      callID: parsedData.call_id,
      status: parsedData.answered_by != null ? 'completed' : 'initiated',
      summary: parsedData.summary,
      answeredBy,
    });
  }

  verifyWebhookSignature(signature: string, secret: string, body: string): boolean {
    const expectedSignature = crypto.createHmac('sha256', secret).update(body).digest('hex');
    return expectedSignature === signature;
  }
}
