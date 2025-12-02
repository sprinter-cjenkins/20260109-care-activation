import { LoggerNoPHI } from '#logger/logger';
import { Injectable } from '@nestjs/common';
import { CallerProvider, CallInitiationRequest, CallResult, CallSummary } from './caller-provider';
import type { Request } from 'express';
import { getPatientPhoneNumber } from '#patient/utils';
import { getErrorMessage } from '#src/utils';

const DEXA_AGENT_ID = 'agent_FRvL6X7Df537CNqarejeiE';
const SUPPORTED_WEBHOOK_TYPES = ['call_completed', 'call_failed', 'call_started'];

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

export interface CartesiaCallTranscriptEntry {
  role: 'user' | 'assistant' | 'system';
  text: string;
  log_metric: {
    name: string;
    value: string;
    timestamp: string;
  };
}

export interface CartesiaGetCallResponse {
  id: string;
  agent_id: string;
  start_time: string;
  end_time: string;
  transcript: CartesiaCallTranscriptEntry[];
  summary: string;
  status: string;
  error_message: string;
  deployment_id: string;
}

export interface CartesiaGetMetricsResponse {
  data: {
    id: string;
    metricId: string;
    metricName: string;
    summary: string;
    agentId: string;
    callId: string;
    deploymentId: string;
    result: string;
    status: 'completed' | 'failed';
    createdAt: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any;
  }[];
  has_more: boolean;
  next_page?: string;
}

export interface CartesiaQuestionnaireMetricValue {
  question_key: string;
  question_text: string;
  answer: string;
}

export interface CartesiaVerificationMetricValue {
  verification_question_id: string;
  received: string;
  expected: string;
  result: boolean;
}

export interface CartesiaWebhookRequest {
  type: 'call_completed' | 'call_started' | 'call_failed';
  request_id: string;
  call_id: string;
  agent_id: string;
  webhook_id: string;
  timestamp: string;
  body: CartesiaCallTranscriptEntry[];
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

  async getCall(callID: string): Promise<CallResult> {
    const apiKey = process.env.CARTESIA_API_KEY;
    if (!apiKey) {
      throw new Error('CARTESIA_API_KEY environment variable not set');
    }

    try {
      const response = await fetch(`https://api.cartesia.ai/agents/calls/${callID}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'Cartesia-Version': '2025-04-16',
        },
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to get call: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      const data = (await response.json()) as CartesiaGetCallResponse;

      const metricsData = await this.getMetricsData(callID);

      const callSummary = this.getCallSummaryFromTranscriptAndMetrics(data.transcript, metricsData);

      return {
        callID,
        status: 'completed',
        summary: callSummary,
        answeredBy: 'human', // TODO: add voicemail detection
      };
    } catch (error) {
      this.logger.error('Failed to get call:', {
        error: getErrorMessage(error),
        cause: error instanceof Error && 'cause' in error ? error.cause : undefined,
      });
      throw error;
    }
  }

  async getMetricsData(callID: string): Promise<CartesiaGetMetricsResponse | null> {
    const apiKey = process.env.CARTESIA_API_KEY;
    if (!apiKey) {
      throw new Error('CARTESIA_API_KEY environment variable not set');
    }

    let metricsData: CartesiaGetMetricsResponse | null = null;
    const params = new URLSearchParams({
      call_id: callID,
    });
    const metricsResponse = await fetch(
      `https://api.cartesia.ai/agents/metrics/results?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'Cartesia-Version': '2025-04-16',
        },
      },
    );
    console.log('metricsResponse', metricsResponse, apiKey);
    if (!metricsResponse.ok) {
      const errorText = await metricsResponse.text();
      this.logger.error('Failed to get metrics:', {
        error: errorText,
        callID,
      });
    } else {
      metricsData = (await metricsResponse.json()) as CartesiaGetMetricsResponse;
      console.log('metricsData', metricsData);
    }
    return metricsData;
  }

  getCallSummaryFromTranscriptAndMetrics(
    transcript: CartesiaCallTranscriptEntry[] | null,
    metricsData: CartesiaGetMetricsResponse | null,
  ): CallSummary {
    if (!transcript) {
      return {
        questions: [],
        verifications: [],
        other: [],
        requested_opt_out: false,
      };
    }
    const requestedOptOut =
      metricsData?.data.find((metric) => metric.metricName === 'did_patient_request_opt_out')
        ?.value === true;

    const sentiment = metricsData?.data.find((metric) => metric.metricName === 'sentiment_analysis')
      ?.value as number;

    const questions = transcript
      .filter((entry) => entry?.log_metric?.name === 'questionnaire_question')
      .map((entry) => {
        const value = JSON.parse(entry.log_metric.value) as CartesiaQuestionnaireMetricValue;
        return {
          key: value.question_text,
          value: value.answer,
        };
      });

    const verifications = transcript
      .filter((entry) => entry?.log_metric?.name === 'verification_question')
      .map((entry) => {
        const value = JSON.parse(entry.log_metric.value) as CartesiaVerificationMetricValue;
        return {
          key: value.verification_question_id,
          received: value.received,
          expected: value.expected,
          result: value.result.toString(),
        };
      });

    const callSummary: CallSummary = {
      questions,
      verifications,
      other: sentiment
        ? [
            {
              key: 'sentiment',
              value: sentiment.toString(),
            },
          ]
        : [],
      requested_opt_out: requestedOptOut,
    };

    return callSummary;
  }

  parseWebhook(request: Request): Promise<CallResult | null> {
    const headersSecret = request.headers['x-webhook-secret'] as string | undefined;
    if (!headersSecret) {
      throw new Error('X-Webhook-Secret header not found');
    }

    const secret = process.env.CARTESIA_WEBHOOK_SECRET;
    if (!secret) {
      throw new Error('CARTESIA_WEBHOOK_SECRET environment variable not set');
    }

    if (headersSecret !== secret) {
      throw new Error('Invalid webhook secret');
    }

    const parsedBody = (request.body as Buffer).toString('utf8');

    const data = JSON.parse(parsedBody) as CartesiaWebhookRequest;

    if (!SUPPORTED_WEBHOOK_TYPES.includes(data.type)) {
      return Promise.resolve(null);
    }
    const callID = data.call_id;
    let status: 'initiated' | 'completed' | 'failed';
    switch (data.type) {
      case 'call_completed':
        status = 'completed';
        break;
      case 'call_failed':
        status = 'failed';
        break;
      case 'call_started':
        status = 'initiated';
        break;
    }

    const callSummary = this.getCallSummaryFromTranscriptAndMetrics(data.body, null); // TODO need to schedule metrics data fetch
    return Promise.resolve({
      callID,
      status,
      summary: callSummary,
      answeredBy: 'human', // TODO: add voicemail detection
    });
  }
}
