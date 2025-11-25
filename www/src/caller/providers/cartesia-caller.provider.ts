import { LoggerNoPHI } from '#logger/logger';
import { Injectable } from '@nestjs/common';
import { CallerProvider, CallInitiationRequest, CallResult } from './caller-provider';
import type { Request } from 'express';
import { getPatientPhoneNumber } from '#patient/utils';
import { getErrorMessage } from '#src/utils';

const DEXA_AGENT_ID = 'agent_FRvL6X7Df537CNqarejeiE';

export interface CartesiaInitiateCallResponse {
  agent_id: string;
  direction: 'outbound' | 'inbound';
  calls: {
    number: string;
    call_sid: string;
    agent_call_id: string;
  }[];
  status: string;
}

@Injectable()
export class CartesiaCallerProvider implements CallerProvider {
  name: string = 'cartesia';
  private readonly logger: LoggerNoPHI;

  constructor(logger: LoggerNoPHI) {
    this.logger = logger;
  }

  async initiateCall(request: CallInitiationRequest): Promise<CallResult> {
    const { patient } = request;
    const phoneNumber = getPatientPhoneNumber(patient);
    const apiKey = process.env.CARTESIA_API_KEY;
    if (!apiKey) {
      throw new Error('CARTESIA_API_KEY environment variable not set');
    }

    let data: CartesiaInitiateCallResponse;
    try {
      const response = await fetch('https://agents-preview.cartesia.ai/twilio/call/outbound', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'Cartesia-Version': '2025-04-16',
        },
        body: JSON.stringify({
          target_numbers: [phoneNumber],
          agent_id: DEXA_AGENT_ID,
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to initiate call: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }
      data = (await response.json()) as CartesiaInitiateCallResponse;
      if (data.status !== 'success') {
        throw new Error('Failed to initiate call');
      }
      const callID = data.calls[0].agent_call_id;
      return {
        callID,
        status: 'initiated',
      };
    } catch (error) {
      this.logger.error('Failed to initiate call:', {
        error: getErrorMessage(error),
        cause: error instanceof Error && 'cause' in error ? error.cause : undefined,
      });
      throw error;
    }
  }

  // TODO Implement
  async getCall(callID: string): Promise<CallResult> {
    return Promise.resolve({
      callID,
      status: 'failed',
    });
  }

  // TODO Implement
  async parseWebhook(_request: Request): Promise<CallResult> {
    return Promise.resolve({
      callID: '',
      status: 'failed',
    });
  }
}
