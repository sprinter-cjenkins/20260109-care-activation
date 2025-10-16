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
import { LoggerNoPHI } from '../logger/logger';

export interface APICallResult extends CallResult {
  message: string;
}

@Injectable()
export class CallerService {
  private readonly callerProvider: CallerProvider;

  private readonly logger: LoggerNoPHI;
  constructor(private readonly prisma: PrismaService) {
    this.logger = new LoggerNoPHI(CallerService.name);
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

    let message = '';
    if (callResult.status === 'initiated') {
      message = 'Call initiated successfully';
    } else if (callResult.status === 'completed') {
      message = 'Call completed successfully';
    } else if (callResult.status === 'failed') {
      message = 'Call failed to initiate';
    }

    return {
      callId: callResult.callId,
      status: callResult.status,
      message: message,
    };
  }

  async getCall(callId: string): Promise<APICallResult> {
    this.logger.log(`Getting call status for call ${callId}`);
    try {
      const result = await this.callerProvider.getCall(callId);
      await this.updateCallEvent(result);
      let message = '';
      if (result.status === 'completed') {
        message = 'Call retrieved successfully';
      } else if (result.status === 'failed') {
        message = 'Call failed to retrieve';
      } else if (result.status === 'initiated') {
        message = 'Call is still in progress';
      }
      return {
        ...result,
        message: message,
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
    const careTaskEvent = await this.prisma.careTaskEvent.findFirstOrThrow({
      where: { externalId: callId },
      include: {
        task: true,
      },
    });

    if (!careTaskEvent) {
      throw new Error('Call event not found');
    }

    if (summary?.requested_opt_out) {
      await this.prisma.patientOptOut.create({
        data: {
          patientId: careTaskEvent.task.patientId,
          channel: OutreachChannel.PHONE,
        },
      });
    }

    if (answeredBy === 'voicemail') {
      await this.prisma.careTaskEvent.update({
        where: { id: careTaskEvent.id },
        data: { status: CareTaskEventStatus.VOICEMAIL },
      });
    } else if (answeredBy === 'human') {
      await this.prisma.careTaskEvent.update({
        where: { id: careTaskEvent.id },
        data: { status: CareTaskEventStatus.SUCCESS },
      });
    }

    if (summary?.questions?.length && summary.questions.length > 0) {
      const existingQuestions = await this.prisma.eventResult.findMany({
        where: {
          type: EventResultType.QUESTION,
          eventId: careTaskEvent.id,
        },
      });

      const nonExistingQuestions = summary.questions.filter(
        (question) => !existingQuestions.some((q) => q.key === question.key),
      );

      if (nonExistingQuestions.length > 0) {
        await this.prisma.eventResult.createMany({
          data: nonExistingQuestions.map((question) => ({
            type: EventResultType.QUESTION,
            eventId: careTaskEvent.id,
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
          eventId: careTaskEvent.id,
        },
      });

      const nonExistingOther = summary.other.filter(
        (other) => !existingOther.some((o) => o.key === other.key),
      );

      await this.prisma.eventResult.createMany({
        data: nonExistingOther.map((other) => ({
          type: EventResultType.OTHER,
          eventId: careTaskEvent.id,
          key: other.key,
          value: other.value,
        })),
      });
    }

    if (summary?.verifications?.length && summary.verifications.length > 0) {
      await this.prisma.eventResult.createMany({
        data: summary.verifications.map((verification) => ({
          type: EventResultType.VERIFICATION,
          eventId: careTaskEvent.id,
          key: verification.key,
          value: verification.result,
          metadata: {
            expected: verification.expected,
            received: verification.received,
          },
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
