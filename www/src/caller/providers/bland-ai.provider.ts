import { Injectable, Logger } from '@nestjs/common';
import { CallerProvider, CallInitiationRequest, CallResult } from './caller-provider';
import { CallerService } from '../caller.service';
import { cleanJsonString, getFirstSentence, getSummaryPrompt, getVoicemailMessage } from '../utils';

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
  private readonly logger = new Logger(CallerService.name);
  private readonly blandApiKey = process.env.BLAND_AI_API_KEY;
  private readonly blandApiUrl = 'https://api.bland.ai/v1';

  async initiateCall(request: CallInitiationRequest): Promise<CallResult> {
    const { patient, taskType } = request;

    if (!this.blandApiKey) {
      throw new Error('BLAND_AI_API_KEY environment variable not set');
    }

    try {
      const response = await fetch(`${this.blandApiUrl}/calls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: this.blandApiKey,
        },
        body: JSON.stringify({
          // TODO: Fill in actual request body parameters
          phone_number: patient.phone,
          voice: 'June',
          task: taskType,
          first_sentence: getFirstSentence(patient),
          voicemail: {
            message: getVoicemailMessage(patient, taskType),
            action: 'leave_message',
            sensitive: true,
          },
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
      return {
        callId: parsedData.call_id || callId,
        status: data.status === 'completed' ? 'completed' : 'initiated',
        summary: parsedData.summary,
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

  async parseWebhook(payload: any): Promise<CallResult> {
    const parsedData = this.parseBlandAIResponse(payload as BlandAIResponse);
    const answeredBy =
      parsedData.answered_by === 'human' || parsedData.answered_by === 'voicemail'
        ? parsedData.answered_by
        : undefined;
    return {
      callId: parsedData.call_id,
      status: parsedData.answered_by === 'human' ? 'completed' : 'initiated',
      summary: parsedData.summary,
      answeredBy,
    };
  }
}
