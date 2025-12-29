import { Test, TestingModule } from '@nestjs/testing';
import { CallerService } from './caller.service';
import { PrismaService } from '../prisma/prisma.service';
import { CallerProvider, CareTaskEvent, CareTaskType, ContactPointSystem } from '@ca/prisma';
import { buildRequestData, getSummaryPrompt, getVoicemailMessage } from './utils';
import { getPatientPhoneNumber } from '#patient/utils';
import { mockPatientPayload, mockCareTaskPayload } from '../../test/mocks';
import { CareTaskPayload } from '#care-task/care-task.service';
import { CallerProviderRegistry } from '#caller/providers/caller-provider.registry';
import { Request } from 'express';
import getBlandPathwayID from '#src/pathway/providers/bland-ai/getBlandPathwayID';

// Mock fetch globally
global.fetch = jest.fn();

describe('CallerService', () => {
  let service: CallerService;
  let prismaService: PrismaService;

  const mockNonDexaTask: CareTaskPayload = {
    ...mockCareTaskPayload,
    id: 'task-456',
    type: 'OTHER' as CareTaskType,
  };

  beforeAll(() => {
    process.env.BLAND_AI_API_KEY = 'test-api-key';
    process.env.BLAND_AI_FROM_NUMBER = '+1234567890';
    process.env.BLAND_AI_TWILIO_ENCRYPTED_KEY = 'test-encrypted-key';
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CallerService,
        {
          provide: PrismaService,
          useValue: {
            careTask: {
              findUnique: jest.fn(),
            },
            careTaskEvent: {
              create: jest.fn(),
              update: jest.fn(),
              findFirstOrThrow: jest.fn(),
            },
            careTaskEventResult: {
              createMany: jest.fn(),
              findMany: jest.fn(),
              findFirstOrThrow: jest.fn(),
            },
            patientOptOut: {
              findFirst: jest.fn(),
              create: jest.fn(),
            },
          },
        },
        CallerProviderRegistry,
      ],
    }).compile();

    service = module.get<CallerService>(CallerService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('initiateCall', () => {
    const careTaskID = 'task-123';

    it('should throw error when task is not found', async () => {
      // Arrange
      const careTaskID = 'non-existent-task';
      jest.spyOn(prismaService.careTask, 'findUnique').mockResolvedValue(null);

      // Act & Assert
      await expect(service.initiateCall(careTaskID)).rejects.toThrow('Task not found');
    });

    it('should throw error when task type is not DEXA_SCAN', async () => {
      // Arrange
      jest.spyOn(prismaService.careTask, 'findUnique').mockResolvedValue(mockNonDexaTask);

      // Act & Assert
      await expect(service.initiateCall(careTaskID)).rejects.toThrow('Pathway ID not found');
    });

    it('should successfully call Bland AI with correct parameters for DEXA_SCAN task', async () => {
      jest.spyOn(prismaService.careTask, 'findUnique').mockResolvedValue(mockCareTaskPayload);

      const mockBlandResponse = {
        call_id: 'bland-call-123',
        status: 'initiated',
      };
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockBlandResponse),
      });
      await service.initiateCall(careTaskID);

      // Verify Bland AI API call with correct parameters
      const call = (global.fetch as jest.Mock).mock.calls[0][1];
      expect(JSON.parse(call.body as string) as Record<string, unknown>).toMatchObject({
        phone_number: getPatientPhoneNumber(mockPatientPayload),
        voice: 'June',
        pathway_id: getBlandPathwayID(mockCareTaskPayload.type),
        from: process.env.BLAND_AI_FROM_NUMBER,
        request_data: buildRequestData(mockPatientPayload),
        summary_prompt: getSummaryPrompt(mockPatientPayload),
        voicemail: {
          message: getVoicemailMessage(mockPatientPayload, mockCareTaskPayload.type),
          action: 'leave_message',
          sensitive: true,
        },
      });
    });

    it('should throw error when patient has opted out of phone outreach', async () => {
      jest.spyOn(prismaService.careTask, 'findUnique').mockResolvedValue(mockCareTaskPayload);
      jest.spyOn(prismaService.patientOptOut, 'findFirst').mockResolvedValue({
        id: 'opt-out-123',
        patientID: mockPatientPayload.id,
        contactPointSystem: ContactPointSystem.PHONE,
        createdAt: new Date(),
      });

      await expect(service.initiateCall(careTaskID)).rejects.toThrow(
        'Patient has opted out of phone outreach',
      );
    });
  });

  describe('getCall', () => {
    const callID = 'bland-call-123';

    const mockBlandResponse = {
      call_id: callID,
      answered_by: 'human',
      summary: JSON.stringify({}),
      status: 'completed',
    };

    const mockCareTaskUpdateEvent = jest.fn().mockResolvedValue({});
    const mockCareTaskFindFirstOrThrow = jest.fn().mockResolvedValue({
      id: callID,
      careTask: {
        patientID: mockPatientPayload.id,
        patient: { optedOutChannels: [] },
        callerProvider: CallerProvider.BLAND_AI,
      },
    });
    const mockPatientOptOutCreate = jest.fn().mockResolvedValue({});
    const mockCareTaskEventResultCreateMany = jest.fn().mockResolvedValue({});
    let mockCareTaskEventResultFindMany = jest.fn().mockResolvedValue([]);
    const mockCareTaskEventResultFindFirstOrThrow = jest.fn().mockResolvedValue({ id: callID });

    beforeEach(() => {
      jest.spyOn(prismaService.careTaskEvent, 'update').mockImplementation(mockCareTaskUpdateEvent);
      jest
        .spyOn(prismaService.careTaskEvent, 'findFirstOrThrow')
        .mockImplementation(mockCareTaskFindFirstOrThrow);

      jest
        .spyOn(prismaService.careTaskEventResult, 'createMany')
        .mockImplementation(mockCareTaskEventResultCreateMany);
      jest
        .spyOn(prismaService.careTaskEventResult, 'findMany')
        .mockImplementation(mockCareTaskEventResultFindMany);
      jest
        .spyOn(prismaService.careTaskEventResult, 'findFirstOrThrow')
        .mockImplementation(mockCareTaskEventResultFindFirstOrThrow);

      jest.spyOn(prismaService.patientOptOut, 'create').mockImplementation(mockPatientOptOutCreate);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockBlandResponse),
      });
    });

    it('should update task event with SUCCESS when call is completed', async () => {
      await service.getCall(callID);

      // Assert
      expect(mockCareTaskUpdateEvent).toHaveBeenCalledWith({
        where: {
          id: callID,
        },
        data: {
          status: 'SUCCESS',
        },
      });
    });

    it('should update task event with VOICEMAIL when call goes to voicemail', async () => {
      mockBlandResponse.answered_by = 'voicemail';
      await service.getCall(callID);
      expect(mockCareTaskUpdateEvent).toHaveBeenCalledWith({
        where: {
          id: callID,
        },
        data: {
          status: 'VOICEMAIL',
        },
      });
    });

    it('should create question results if summary has questions', async () => {
      mockBlandResponse.summary = JSON.stringify({
        questions: [{ key: 'question1', value: 'answer1' }],
        other: [{ key: 'other1', value: 'answer2' }],
      });

      await service.getCall(callID);

      expect(mockCareTaskEventResultCreateMany).toHaveBeenCalledWith({
        data: [{ type: 'QUESTION', eventID: callID, key: 'question1', value: 'answer1' }],
      });

      expect(mockCareTaskEventResultCreateMany).toHaveBeenCalledWith({
        data: [{ type: 'OTHER', eventID: callID, key: 'other1', value: 'answer2' }],
      });
    });

    it('should not create question results if we already created them', async () => {
      mockBlandResponse.summary = JSON.stringify({
        questions: [{ key: 'question1', value: 'answer1' }],
      });

      mockCareTaskEventResultFindMany = jest
        .fn()
        .mockResolvedValue([
          { type: 'QUESTION', eventID: callID, key: 'question1', value: 'answer1' },
        ]);

      jest
        .spyOn(prismaService.careTaskEventResult, 'findMany')
        .mockImplementation(mockCareTaskEventResultFindMany);

      await service.getCall(callID);

      expect(mockCareTaskEventResultCreateMany).not.toHaveBeenCalled();
    });

    it('should opt out if patient summary has requested_opt_out', async () => {
      mockBlandResponse.summary = JSON.stringify({
        requested_opt_out: true,
      });

      await service.getCall(callID);

      expect(mockPatientOptOutCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            patientID: mockPatientPayload.id,
            contactPointSystem: ContactPointSystem.PHONE,
          },
        }),
      );
    });

    it('should not opt out if patient has already opted out', async () => {
      mockBlandResponse.summary = JSON.stringify({
        requested_opt_out: true,
      });
      mockCareTaskFindFirstOrThrow.mockResolvedValue({
        id: callID,
        careTask: {
          patientID: mockPatientPayload.id,
          patient: {
            optedOutChannels: [
              { contactPointSystem: ContactPointSystem.PHONE, createdAt: new Date() },
            ],
          },
          callerProvider: CallerProvider.BLAND_AI,
        },
      });

      await service.getCall(callID);

      expect(mockPatientOptOutCreate).not.toHaveBeenCalled();
    });

    it('handles invalid summaries', async () => {
      mockBlandResponse.summary = 'Failed to generate summary';
      await service.getCall(callID);
      expect(mockCareTaskEventResultCreateMany).toHaveBeenCalledWith({
        data: [
          {
            type: 'OTHER',
            eventID: callID,
            key: 'failureReason',
            value: 'Failed to generate summary',
          },
        ],
      });
    });
  });

  describe('handleWebhook', () => {
    const mockCareTaskEventFindFirstOrThrow: jest.Mock = jest.fn().mockResolvedValue({
      id: 'event-123',
      externalID: 'test-call-123',
    } as unknown as CareTaskEvent);

    beforeEach(() => {
      jest
        .spyOn(prismaService.careTaskEvent, 'findFirstOrThrow')
        .mockImplementation(mockCareTaskEventFindFirstOrThrow);
    });
    it('should use provider from query param to parse webhook', async () => {
      const mockRequest = {
        query: { provider: 'cartesia' },
        headers: { 'x-webhook-secret': 'test-secret' },
        body: Buffer.from(
          JSON.stringify({
            type: 'call_completed',
            call_id: 'test-call-123',
            body: [],
          }),
        ),
      } as unknown as Request;

      process.env.CARTESIA_WEBHOOK_SECRET = 'test-secret';

      await service.handleWebhook(mockRequest);

      // Verify the event was looked up
      expect(mockCareTaskEventFindFirstOrThrow).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { externalID: 'test-call-123' },
        }),
      );
    });

    it('should throw error for unknown provider in query param', async () => {
      const mockRequest = {
        query: { provider: 'unknown-provider' },
        headers: {},
        body: Buffer.from('{}'),
      } as unknown as Request;

      await expect(service.handleWebhook(mockRequest)).rejects.toThrow(
        'Unknown provider: unknown-provider',
      );
    });
  });
});
