import { CallerProvider, CallInitiationRequest, CallResult } from './caller-provider';
import { Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { CallerService } from '../caller.service';

import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { GetConversationResponseModel } from '@elevenlabs/elevenlabs-js/api';

const DEXA_AGENT_ID = 'agent_4601k5s8m9bteq4vytedj4h4gheq';
const DEXA_PHONE_ID = 'phnum_4001k5vwz9wbe0t8jxdpbqx48wyv';

@Injectable()
export class ElevenLabsProvider implements CallerProvider {
  name: string = 'eleven-labs';
  private readonly logger = new Logger(CallerService.name);
  private readonly elevenLabsApiKey = process.env.ELEVEN_LABS_API_KEY;

  private readonly client = new ElevenLabsClient({
    apiKey: this.elevenLabsApiKey,
  });

  async initiateCall(request: CallInitiationRequest): Promise<CallResult> {
    if (!this.elevenLabsApiKey) {
      throw new Error('ELEVEN_LABS_API_KEY environment variable not set');
    }

    const { patient } = request;

    try {
      const response = await this.client.conversationalAi.twilio.outboundCall({
        agentId: DEXA_AGENT_ID,
        agentPhoneNumberId: DEXA_PHONE_ID,
        toNumber: patient.phoneNumber,
        conversationInitiationClientData: {
          dynamicVariables: {
            user_given_name: patient.givenName,
            user_family_name: patient.familyName,
            user_plan_name: patient.partnerOrganization,
          },
        },
      });

      if (!response.conversationId) {
        throw new Error('Failed to initiate call: No conversation ID returned');
      }

      return {
        status: 'initiated',
        callId: response.conversationId,
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

    console.log(`Getting call status for conversation ${conversationId}`);

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

  parseElevenLabsResponse(response: GetConversationResponseModel): CallResult {
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
      // @ts-expect-error ElevenLabs response type is not consistent
      callId: (response.conversationId || response.conversation_id) as string,
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
      const data = (JSON.parse(parsedBody) as { data: GetConversationResponseModel }).data;
      return this.parseElevenLabsResponse(data);
    } catch (error) {
      throw new Error(
        `Failed to parse ElevenLabs webhook: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
