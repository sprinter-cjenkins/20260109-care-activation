import { Injectable } from '@nestjs/common';
import {
  CareTaskEventResultType,
  CareTaskEventStatus,
  CareTaskEventType,
  ContactPointSystem,
} from '@prisma/client';
import { PrismaService } from '#prisma/prisma.service';
import { CallResult, CallerProvider } from './providers/caller-provider';
import { BlandAICallerProvider } from './providers/bland-ai-caller.provider';
import type { Request } from 'express';
import { LoggerNoPHI } from '#logger/logger';
import { getErrorMessage } from '#src/utils';
import { incrementMetric } from '#logger/metrics';

export interface APICallResult extends CallResult {
  message: string;
}

@Injectable()
export class CallerService {
  private readonly callerProvider: CallerProvider;

  private readonly logger: LoggerNoPHI;
  constructor(private readonly prisma: PrismaService) {
    this.logger = new LoggerNoPHI(CallerService.name);
    this.callerProvider = new BlandAICallerProvider(this.logger);
  }

  async initiateCall(careTaskID: string): Promise<APICallResult> {
    const careTask = await this.prisma.careTask.findUnique({
      where: { id: careTaskID },
      include: {
        patient: {
          include: {
            name: true,
            telecom: true,
          },
        },
      },
    });

    if (!careTask) {
      throw new Error('Task not found');
    }

    const patient = careTask.patient;
    const careTaskType = careTask.type;

    const optOut = await this.prisma.patientOptOut.findFirst({
      where: {
        patientID: patient.id,
        contactPointSystem: ContactPointSystem.PHONE,
      },
    });

    if (optOut) {
      throw new Error('Patient has opted out of phone outreach');
    }

    this.logger.log(`Initiating call for patient`, {
      patientID: patient.id,
    });

    const callResult = await this.callerProvider.initiateCall({
      patient,
      careTaskType,
    });

    this.logger.log(`Call initiated successfully: ${callResult.callID}`);

    await this.prisma.careTaskEvent.create({
      data: {
        careTaskID,
        externalID: callResult.callID,
        type: CareTaskEventType.PATIENT_ONBOARDING_CALL,
        status: CareTaskEventStatus.INITIATED,
      },
    });

    let message = '';
    if (callResult.status === 'initiated') {
      incrementMetric('caller.call_initiated', {
        careTaskType,
      });
      message = 'Call initiated successfully';
    } else if (callResult.status === 'failed') {
      incrementMetric('caller.call_failed', {
        careTaskType,
      });
      message = 'Call failed to initiate';
    }

    return {
      callID: callResult.callID,
      status: callResult.status,
      message: message,
    };
  }

  async getCall(callID: string): Promise<APICallResult> {
    this.logger.log(`Getting call status for call ${callID}`);
    try {
      const callResult = await this.callerProvider.getCall(callID);
      await this.updateCallEvent(callResult);
      let message = '';
      if (callResult.status === 'completed') {
        message = 'Call retrieved successfully';
      } else if (callResult.status === 'failed') {
        message = 'Call failed to retrieve';
      } else if (callResult.status === 'initiated') {
        message = 'Call is still in progress';
      }
      return {
        ...callResult,
        message: message,
      };
    } catch (error) {
      this.logger.error(`Failed to get call status:`, {
        error: getErrorMessage(error),
        externalCallID: callID,
      });
      return {
        callID: callID,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async updateCallEvent(data: CallResult): Promise<void> {
    const { callID, answeredBy, summary } = data;
    if (!callID) {
      throw new Error('Call ID not found');
    }
    const careTaskEvent = await this.prisma.careTaskEvent.findFirstOrThrow({
      where: { externalID: callID },
      include: {
        careTask: {
          include: {
            patient: {
              include: {
                optedOutChannels: true,
              },
            },
          },
        },
      },
    });

    if (!careTaskEvent) {
      throw new Error('Call event not found');
    }

    if (
      summary?.requested_opt_out &&
      !careTaskEvent.careTask.patient.optedOutChannels.some(
        (channel) => channel.contactPointSystem === ContactPointSystem.PHONE,
      )
    ) {
      incrementMetric('caller.patient_opted_out', {
        taskType: careTaskEvent.careTask.type as string,
        contactPointSystem: ContactPointSystem.PHONE,
      });
      await this.prisma.patientOptOut.create({
        data: {
          patientID: careTaskEvent.careTask.patientID,
          contactPointSystem: ContactPointSystem.PHONE,
        },
      });
    }

    // Only increment first time we update this, in case we ever hit this code again
    if (careTaskEvent.status === CareTaskEventStatus.INITIATED && answeredBy) {
      incrementMetric('caller.call_completed', {
        taskType: careTaskEvent.careTask.type as string,
        answeredBy,
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
      const existingQuestions = await this.prisma.careTaskEventResult.findMany({
        where: {
          type: CareTaskEventResultType.QUESTION,
          eventID: careTaskEvent.id,
        },
      });

      const nonExistingQuestions = summary.questions.filter(
        (question) => !existingQuestions.some((q) => q.key === question.key),
      );

      if (nonExistingQuestions.length > 0) {
        await this.prisma.careTaskEventResult.createMany({
          data: nonExistingQuestions.map((question) => ({
            type: CareTaskEventResultType.QUESTION,
            eventID: careTaskEvent.id,
            key: question.key,
            value: question.value,
          })),
        });
      }
    }

    if (summary?.other?.length && summary.other.length > 0) {
      const existingOther = await this.prisma.careTaskEventResult.findMany({
        where: {
          type: CareTaskEventResultType.OTHER,
          eventID: careTaskEvent.id,
        },
      });

      const nonExistingOther = summary.other.filter(
        (other) => !existingOther.some((o) => o.key === other.key),
      );

      await this.prisma.careTaskEventResult.createMany({
        data: nonExistingOther.map((other) => ({
          type: CareTaskEventResultType.OTHER,
          eventID: careTaskEvent.id,
          key: other.key,
          value: other.value,
        })),
      });
    }

    if (summary?.verifications?.length && summary.verifications.length > 0) {
      await this.prisma.careTaskEventResult.createMany({
        data: summary.verifications.map((verification) => ({
          type: CareTaskEventResultType.VERIFICATION,
          eventID: careTaskEvent.id,
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
    this.logger.log('Received webhook:', request.body as Record<string, unknown>);

    const parsedData = await this.callerProvider.parseWebhook(request);
    await this.updateCallEvent(parsedData);
  }
}
