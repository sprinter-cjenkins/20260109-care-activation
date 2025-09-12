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
}
