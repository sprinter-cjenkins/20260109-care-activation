import { Injectable } from '@nestjs/common';
import {
  CareTaskEventStatus,
  CareTaskEventType,
  EventResultType,
  OutreachChannel,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CallResult, CallerProvider } from './providers/caller-provider';
import { BlandAIProvider } from './providers/bland-ai.provider';
import type { Request } from 'express';
import { LoggerService } from '../logger/logger.service';

export interface APICallResult extends CallResult {
  message: string;
}

@Injectable()
export class CallerService {
  private readonly callerProvider: CallerProvider;

  private readonly logger: LoggerService;
  constructor(private readonly prisma: PrismaService) {
    this.logger = new LoggerService(CallerService.name);
    this.callerProvider = new BlandAIProvider(this.logger);
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

    const optOut = await this.prisma.patientOptOut.findFirst({
      where: {
        patientId: patient.id,
        channel: OutreachChannel.PHONE,
      },
    });

    if (optOut) {
      throw new Error('Patient has opted out of phone outreach');
    }

    this.logger.log(`Initiating call for patient ${patient.id})`);

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
    if (!callId) {
      throw new Error('Call ID not found');
    }
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

  async handleWebhook(request: Request): Promise<void> {
    this.logger.log('Received webhook:', request.body);

    const parsedData = await this.callerProvider.parseWebhook(request);
    await this.updateCallEvent(parsedData);
  }
}
