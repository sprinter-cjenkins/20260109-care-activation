import { Injectable, Logger } from '@nestjs/common';
import {
  CareTaskEventStatus,
  CareTaskEventType,
  CareTaskType,
  EventResultType,
  Patient,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  cleanJsonString,
  getAiTask,
  getFirstSentence,
  getSummaryPrompt,
  getVoicemailMessage,
} from './utils';

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

      const data = (await response.json()) as BlandAIResponse;

      this.logger.log(`Call initiated successfully: ${data.call_id}`);

      await this.prisma.careTaskEvent.create({
        data: {
          taskId,
          externalId: data.call_id,
          eventType: CareTaskEventType.PATIENT_ONBOARDING_CALL,
          status: CareTaskEventStatus.INITIATED,
        },
      });

      return {
        callId: data.call_id,
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

  async getCall(callId: string): Promise<CallResult> {
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

      const data = (await response.json()) as BlandAIResponse;
      const parsedData = this.parseBlandAIResponse(data);
      await this.updateCallEvent(parsedData);

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

  parseBlandAIResponse(data: BlandAIResponse): ParsedBlandAIResponse {
    const { call_id, answered_by, summary } = data;
    const parsedSummary = JSON.parse(cleanJsonString(summary)) as BlandAISummary;
    return { call_id, answered_by, summary: parsedSummary };
  }

  async updateCallEvent(data: ParsedBlandAIResponse): Promise<void> {
    const { call_id, answered_by, summary } = data;
    const callEventId = await this.prisma.careTaskEvent.findFirstOrThrow({
      where: { externalId: call_id },
    });

    if (!callEventId) {
      throw new Error('Call event not found');
    }

    if (answered_by === 'voicemail') {
      await this.prisma.careTaskEvent.update({
        where: { id: callEventId.id },
        data: { status: CareTaskEventStatus.VOICEMAIL },
      });
    } else if (answered_by === 'human') {
      await this.prisma.careTaskEvent.update({
        where: { id: callEventId.id },
        data: { status: CareTaskEventStatus.SUCCESS },
      });
    }

    if (summary?.questions?.length > 0) {
      const existingQuestions = await this.prisma.eventResult.findMany({
        where: {
          type: EventResultType.QUESTION,
          eventId: callEventId.id,
        },
      });

      const nonExistingQuestions = summary.questions.filter(
        (question) => !existingQuestions.some((q) => q.key === question.key),
      );

      if (nonExistingQuestions.length > 0) {
        await this.prisma.eventResult.createMany({
          data: nonExistingQuestions.map((question) => ({
            type: EventResultType.QUESTION,
            eventId: callEventId.id,
            key: question.key,
            value: question.value,
          })),
        });
      }
    }

    if (summary?.other?.length > 0) {
      const existingOther = await this.prisma.eventResult.findMany({
        where: {
          type: EventResultType.OTHER,
          eventId: callEventId.id,
        },
      });

      const nonExistingOther = summary.other.filter(
        (other) => !existingOther.some((o) => o.key === other.key),
      );

      await this.prisma.eventResult.createMany({
        data: nonExistingOther.map((other) => ({
          type: EventResultType.OTHER,
          eventId: callEventId.id,
          key: other.key,
          value: other.value,
        })),
      });
    }
  }

  async handleWebhook(payload: BlandAIResponse): Promise<void> {
    this.logger.log('Received webhook:', payload);
    const { call_id } = payload;

    if (!call_id) {
      this.logger.error('Webhook missing call_id');
      return;
    }

    const parsedData = this.parseBlandAIResponse(payload);

    await this.updateCallEvent(parsedData);
  }
}
