import { Injectable, Logger } from '@nestjs/common';
import { CareTaskEventStatus, CareTaskEventType, EventResultType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getAiTask } from './utils';
import { CallResult, CallerProvider } from './providers/caller-provider';
import { BlandAIProvider } from './providers/bland-ai.provider';

export interface APICallResult extends CallResult {
  message: string;
}

@Injectable()
export class CallerService {
  private readonly logger = new Logger(CallerService.name);
  private readonly callerProvider: CallerProvider;

  constructor(private readonly prisma: PrismaService) {
    this.callerProvider = new BlandAIProvider();
  }

  async initiateCall(taskId: string): Promise<APICallResult> {
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

    const aiTask = getAiTask(taskType);
    if (!aiTask) {
      throw new Error('Task not found');
    }

    this.logger.log(
      `Initiating call for patient ${patient.id} (${patient.givenName} ${patient.familyName})`,
    );

    try {
      const callResult = await this.callerProvider.initiateCall({
        patient,
        taskType,
      });

      this.logger.log(`Call initiated successfully: ${callResult.callId}`);

      await this.prisma.careTaskEvent.create({
        data: {
          taskId,
          externalId: callResult.callId,
          eventType: CareTaskEventType.PATIENT_ONBOARDING_CALL,
          status: CareTaskEventStatus.INITIATED,
        },
      });

      return {
        callId: callResult.callId,
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

  async getCall(callId: string): Promise<APICallResult> {
    this.logger.log(`Getting status for call ${callId}`);

    try {
      const result = await this.callerProvider.getCall(callId);
      await this.updateCallEvent(result);
      return {
        ...result,
        message: 'Call status retrieved successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to get call status:`, error);
      return {
        callId: callId,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async updateCallEvent(data: CallResult): Promise<void> {
    const { callId, answeredBy, summary } = data;
    const callEventId = await this.prisma.careTaskEvent.findFirstOrThrow({
      where: { externalId: callId },
    });

    if (!callEventId) {
      throw new Error('Call event not found');
    }

    if (answeredBy === 'voicemail') {
      await this.prisma.careTaskEvent.update({
        where: { id: callEventId.id },
        data: { status: CareTaskEventStatus.VOICEMAIL },
      });
    } else if (answeredBy === 'human') {
      await this.prisma.careTaskEvent.update({
        where: { id: callEventId.id },
        data: { status: CareTaskEventStatus.SUCCESS },
      });
    }

    if (summary?.questions?.length && summary.questions.length > 0) {
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

    if (summary?.other?.length && summary.other.length > 0) {
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

  async handleWebhook(payload: any): Promise<void> {
    this.logger.log('Received webhook:', payload);

    const parsedData = await this.callerProvider.parseWebhook(payload);

    await this.updateCallEvent(parsedData);
  }
}
