import { CallerProvider, CallInitiationRequest, CallResult } from './caller-provider';
import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { CallerService } from '../caller.service';

import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import type {
  GetConversationResponseModelStatus,
  ConversationHistoryTranscriptCommonModelOutput,
  ConversationInitiationClientDataRequestOutput,
  ConversationHistoryMetadataCommonModel,
  ConversationHistoryAnalysisCommonModel,
} from '@elevenlabs/elevenlabs-js/api';
import { LoggerService } from '../../logger/logger.service';

const DEXA_AGENT_ID = 'agent_4601k5s8m9bteq4vytedj4h4gheq';
const DEXA_PHONE_ID = 'phnum_4001k5vwz9wbe0t8jxdpbqx48wyv';

interface GetConversationResponse {
  agent_id: string;
  conversation_id: string;
  status: GetConversationResponseModelStatus;
  userId?: string;
  transcript: ConversationHistoryTranscriptCommonModelOutput[];
  metadata: ConversationHistoryMetadataCommonModel;
  analysis?: ConversationHistoryAnalysisCommonModel;
  conversationInitiationClientData?: ConversationInitiationClientDataRequestOutput;
  hasAudio: boolean;
  hasUserAudio: boolean;
  hasResponseAudio: boolean;
}

@Injectable()
export class ElevenLabsProvider implements CallerProvider {
  name: string = 'eleven-labs';
  private readonly logger: LoggerService;
  private readonly elevenLabsApiKey = process.env.ELEVEN_LABS_API_KEY;
  private readonly elevenLabsApiUrl = 'https://api.elevenlabs.io/v1';

  constructor(logger: LoggerService) {
    this.logger = logger;
  }

  private readonly client = new ElevenLabsClient({
    apiKey: this.elevenLabsApiKey,
  });

  async initiateCall(request: CallInitiationRequest): Promise<CallResult> {
    if (!this.elevenLabsApiKey) {
      throw new Error('ELEVEN_LABS_API_KEY environment variable not set');
    }

    const { patient } = request;

    const dynamicVariables = {
      user_given_name: patient.givenName,
      user_family_name: patient.familyName,
      user_plan_name: patient.partnerOrganization,
    };

    const toolOverrides = {
      voicemail_detection: {
        message: `Hi, ${patient.givenName} ${patient.familyName}. This is June from Sprinter Health calling on behalf of ${patient.partnerOrganization}. Just calling to follow up on scheduling your DEXA scan. Please give us a call back when you can.`,
      },
    };

    try {
      const response = await fetch(`${this.elevenLabsApiUrl}/convai/twilio/outbound-call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': this.elevenLabsApiKey,
        },
        body: JSON.stringify({
          agent_id: DEXA_AGENT_ID,
          agent_phone_number_id: DEXA_PHONE_ID,
          to_number: patient.phoneNumber,
          conversation_initiation_client_data: {
            dynamic_variables: dynamicVariables,
            tool_overrides: toolOverrides,
          },
        }),
      });

      const data = (await response.json()) as GetConversationResponse;

      if (!data.conversation_id) {
        throw new Error('Failed to initiate call: No conversation ID returned');
      }

      return {
        status: 'initiated',
        callId: data.conversation_id,
      };
    } catch (error) {
      throw new Error(
        `Failed to initiate call: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getCall(conversationId: string): Promise<CallResult> {
    if (!this.elevenLabsApiKey) {
      throw new Error('ELEVEN_LABS_API_KEY environment variable not set');
    }

    try {
      const response = await this.client.conversationalAi.conversations.get(conversationId);

      let mappedStatus: 'initiated' | 'completed' | 'failed';
      switch (response.status) {
        case 'initiated':
        case 'in-progress':
        case 'processing':
          mappedStatus = 'initiated';
          break;
        case 'done':
          mappedStatus = 'completed';
          break;
        case 'failed':
          mappedStatus = 'failed';
          break;
      }
      const voicemailToolUsed = response.metadata.featuresUsage?.voicemailDetection?.used;

      let answeredBy: 'human' | 'voicemail' = 'human';
      if (voicemailToolUsed) {
        answeredBy = 'voicemail';
      }
      return {
        callId: conversationId,
        status: mappedStatus,
        answeredBy,
      };
    } catch (error) {
      throw new Error(
        `Failed to get call status: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  parseElevenLabsResponse(response: GetConversationResponse): CallResult {
    let mappedStatus: 'initiated' | 'completed' | 'failed';
    switch (response.status) {
      case 'initiated':
      case 'in-progress':
      case 'processing':
        mappedStatus = 'initiated';
        break;
      case 'done':
        mappedStatus = 'completed';
        break;
      case 'failed':
        mappedStatus = 'failed';
        break;
    }
    const voicemailToolUsed = response.metadata?.featuresUsage?.voicemailDetection?.used;

    let answeredBy = 'human';
    if (voicemailToolUsed) {
      answeredBy = 'voicemail';
    }

    return {
      // TODO get real typing
      callId: response.conversation_id,
      status: mappedStatus,
      answeredBy: answeredBy as 'human' | 'voicemail',
    };
  }

  async parseWebhook(req: Request): Promise<CallResult> {
    const headers = req.headers['elevenlabs-signature'] as string | undefined;
    const secret = process.env.ELEVEN_LABS_WEBHOOK_SECRET;

    if (!headers || !secret) {
      throw new Error('ElevenLabs signature or secret not found');
    }

    try {
      await this.client.webhooks.constructEvent(req.body, headers, secret);
      const parsedBody = (req.body as Buffer).toString('utf8');

      // TODO get real typing
      const data = (JSON.parse(parsedBody) as { data: GetConversationResponse }).data;
      return this.parseElevenLabsResponse(data);
    } catch (error) {
      throw new Error(
        `Failed to parse ElevenLabs webhook: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
