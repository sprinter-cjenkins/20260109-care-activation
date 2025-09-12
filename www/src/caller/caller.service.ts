import { Injectable, Logger } from '@nestjs/common';
import { CareTaskType, Patient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getAiTask, getFirstSentence, getSummaryPrompt, getVoicemailMessage } from './utils';

export interface CallResult {
  callId: string;
  status: 'initiated' | 'completed' | 'failed';
  message?: string;
  transcript?: string;
  answers?: Record<string, string>;
}

export interface CallInitiationRequest {
  patient: Patient;
  taskType: CareTaskType;
}

@Injectable()
export class CallerService {
  private readonly logger = new Logger(CallerService.name);
  private readonly blandApiKey = process.env.BLAND_AI_API_KEY;
  private readonly blandApiUrl = 'https://api.bland.ai/v1';

  constructor(private readonly prisma: PrismaService) {}

  async initiateCall(taskId: string): Promise<CallResult> {
    const task = await this.prisma.careTask.findUnique({
      where: { id: taskId },
      include: {
        patient: true,
      },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    const patient = task.patient;
    const taskType = task.type;

    if (!this.blandApiKey) {
      throw new Error('BLAND_AI_API_KEY environment variable not set');
    }

    const aiTask = getAiTask(taskType);
    const phoneNumber = patient.phone;
    if (!aiTask) {
      throw new Error('Task not found');
    }

    this.logger.log(
      `Initiating call for patient ${patient.id} (${patient.givenName} ${patient.familyName})`,
    );

    try {
      const response = await fetch(`${this.blandApiUrl}/calls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: this.blandApiKey,
        },
        body: JSON.stringify({
          // TODO: Fill in actual request body parameters
          phone_number: phoneNumber,
          voice: 'June',
          task: aiTask,
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

      const data = await response.json();

      this.logger.log(`Call initiated successfully: ${data.call_id || data.id}`);

      return {
        callId: data.call_id || data.id || 'unknown',
        status: 'initiated',
        message: 'Call initiated successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to initiate call:`, error);
      return {
        callId: '',
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async getCallStatus(callId: string): Promise<CallResult> {
    if (!this.blandApiKey) {
      throw new Error('BLAND_AI_API_KEY environment variable not set');
    }

    this.logger.log(`Getting status for call ${callId}`);

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

      const data = await response.json();

      return {
        callId: data.call_id || data.id || callId,
        status: data.status === 'completed' ? 'completed' : 'initiated',
        message: 'Status retrieved successfully',
        transcript: data.transcript,
        answers: data.answers || {},
      };
    } catch (error) {
      this.logger.error(`Failed to get call status:`, error);
      return {
        callId,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async handleWebhook(payload: any): Promise<void> {
    this.logger.log('Received webhook:', payload);

    // TODO: Handle different webhook events
    switch (payload.event) {
      case 'call.completed':
        await this.handleCallCompleted(payload);
        break;
      case 'call.failed':
        await this.handleCallFailed(payload);
        break;
      default:
        this.logger.log(`Unhandled webhook event: ${payload.event}`);
    }
  }

  private async handleCallCompleted(payload: any): Promise<void> {
    this.logger.log(`Call ${payload.call_id} completed`);
    // TODO: Update care task status, store transcript, etc.
  }

  private async handleCallFailed(payload: any): Promise<void> {
    this.logger.log(`Call ${payload.call_id} failed: ${payload.reason}`);
    // TODO: Update care task status, log failure, schedule retry
  }
}
