import { Injectable } from '@nestjs/common';
import { CallerProvider, CallInitiationRequest, CallResult } from './caller-provider';
import { LoggerNoPHI } from '../../logger/logger';
import { buildRequestData, getPathwayID } from '../utils';
import { cleanJsonString, getSummaryPrompt, getVoicemailMessage } from '../utils';
import type { Request } from 'express';

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
}

export interface ParsedBlandAIResponse {
  call_id: string;
  answered_by: string;
  summary: BlandAISummary;
}

@Injectable()
export class BlandAIProvider implements CallerProvider {
  name: string = 'bland-ai';
  private readonly blandApiKey = process.env.BLAND_AI_API_KEY;
  private readonly blandApiUrl = 'https://api.bland.ai/v1';

  private readonly logger: LoggerNoPHI;

  constructor(logger: LoggerNoPHI) {
    this.logger = logger;
  }

  async initiateCall(request: CallInitiationRequest): Promise<CallResult> {
    const { patient, taskType } = request;

    if (!this.blandApiKey) {
      throw new Error('BLAND_AI_API_KEY environment variable not set');
    }

    const pathwayId = getPathwayID(taskType);

    if (!pathwayId) {
      throw new Error('Pathway ID not found');
    }

    try {
      const response = await fetch(`${this.blandApiUrl}/calls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: this.blandApiKey,
        },
        body: JSON.stringify({
          phone_number: patient.phoneNumber,
          voice: 'June',
          pathway_id: getPathwayID(taskType),
          voicemail: {
            message: getVoicemailMessage(patient, taskType),
            action: 'leave_message',
            sensitive: true,
          },
          request_data: buildRequestData(patient),

          summary_prompt: getSummaryPrompt(),
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
        callId: data.call_id,
        status: 'initiated',
      };
    } catch (error) {
      this.logger.error(`Failed to initiate call:`, error);
      return {
        callId: '',
        status: 'failed',
      };
    }
  }
  async getCall(callId: string): Promise<CallResult> {
    if (!this.blandApiKey) {
      throw new Error('BLAND_AI_API_KEY environment variable not set');
    }

    try {
      const response = await fetch(`${this.blandApiUrl}/calls/${callId}`, {
        method: 'GET',
        headers: {
          authorization: this.blandApiKey,
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
        callId: parsedData.call_id || callId,
        status: data.status === 'completed' ? 'completed' : 'initiated',
        summary: parsedData.summary,
        answeredBy,
      };
    } catch (error) {
      this.logger.error(`Failed to get call status:`, error);
      return {
        callId: callId,
        status: 'failed',
      };
    }
  }

  parseBlandAIResponse(data: BlandAIResponse): ParsedBlandAIResponse {
    const { call_id, answered_by, summary } = data;
    const parsedSummary = JSON.parse(cleanJsonString(summary)) as BlandAISummary;
    return { call_id, answered_by, summary: parsedSummary };
  }

  parseWebhook(request: Request): Promise<CallResult> {
    const body = JSON.parse((request.body as Buffer).toString('utf8')) as BlandAIResponse;
    const parsedData = this.parseBlandAIResponse(body);
    const answeredBy =
      parsedData.answered_by === 'human' || parsedData.answered_by === 'voicemail'
        ? parsedData.answered_by
        : undefined;
    return Promise.resolve({
      callId: parsedData.call_id,
      status: parsedData.answered_by != null ? 'completed' : 'initiated',
      summary: parsedData.summary,
      answeredBy,
    });
  }
}
