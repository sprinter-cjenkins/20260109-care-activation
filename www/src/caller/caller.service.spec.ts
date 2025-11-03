import { Test, TestingModule } from '@nestjs/testing';
import { CallerService } from './caller.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CareTaskStatus,
  CareTaskType,
  OutreachChannel,
  PartnerOrganization,
  Patient,
} from '@prisma/client';
import { buildRequestData, getPathwayID, getSummaryPrompt, getVoicemailMessage } from './utils';

// Mock fetch globally
global.fetch = jest.fn();

describe('CallerService', () => {
  let service: CallerService;
  let prismaService: PrismaService;

  const mockPatient: Patient = {
    id: 'patient-123',
    givenName: 'John',
    familyName: 'Doe',
    phoneNumber: '+1234567890',
    externalId: 'ext-123',
    birthDate: new Date('1990-01-01'),
    createdAt: new Date(),
    updatedAt: new Date(),
    emailAddress: 'john.doe@example.com',
    metadata: {},
    partnerOrganization: PartnerOrganization.ELEVANCEHEALTH,
    timezone: 'America/New_York',
  };

  const mockDexaTask = {
    id: 'task-123',
    type: CareTaskType.DEXA_SCAN,
    status: CareTaskStatus.PENDING,
    patientId: 'patient-123',
    patient: mockPatient,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockNonDexaTask = {
    id: 'task-456',
    type: 'OTHER' as CareTaskType,
    status: CareTaskStatus.PENDING,
    patientId: 'patient-123',
    patient: mockPatient,
    createdAt: new Date(),
    updatedAt: new Date(),
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
            eventResult: {
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
      ],
    }).compile();

    service = module.get<CallerService>(CallerService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Reset mocks
    jest.clearAllMocks();

    // Set up environment variable
    process.env.BLAND_AI_API_KEY = 'test-api-key';
  });

  afterAll(() => {
    delete process.env.BLAND_AI_API_KEY;
  });

  describe('initiateCall', () => {
    const taskId = 'task-123';

    it('should throw error when task is not found', async () => {
      // Arrange
      const taskId = 'non-existent-task';
      jest.spyOn(prismaService.careTask, 'findUnique').mockResolvedValue(null);

      // Act & Assert
      await expect(service.initiateCall(taskId)).rejects.toThrow('Task not found');
    });

    it('should throw error when task type is not DEXA_SCAN', async () => {
      // Arrange
      jest.spyOn(prismaService.careTask, 'findUnique').mockResolvedValue(mockNonDexaTask);

      // Act & Assert
      await expect(service.initiateCall(taskId)).rejects.toThrow('Pathway ID not found');
    });

    it('should successfully call Bland AI with correct parameters for DEXA_SCAN task', async () => {
      jest.spyOn(prismaService.careTask, 'findUnique').mockResolvedValue(mockDexaTask);

      const mockBlandResponse = {
        call_id: 'bland-call-123',
        status: 'initiated',
      };
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockBlandResponse),
      });
      await service.initiateCall(taskId);

      // Verify Bland AI API call with correct parameters
      const call = (global.fetch as jest.Mock).mock.calls[0][1];
      expect(JSON.parse(call.body as string) as Record<string, unknown>).toMatchObject({
        phone_number: mockPatient.phoneNumber,
        voice: 'June',
        pathway_id: getPathwayID(mockDexaTask.type),
        from: process.env.BLAND_AI_FROM_NUMBER,
        request_data: buildRequestData(mockPatient),
        summary_prompt: getSummaryPrompt(mockPatient),
        voicemail: {
          message: getVoicemailMessage(mockPatient, mockDexaTask.type),
          action: 'leave_message',
          sensitive: true,
        },
      });
    });

    it('should throw error when patient has opted out of phone outreach', async () => {
      jest.spyOn(prismaService.careTask, 'findUnique').mockResolvedValue(mockDexaTask);
      jest.spyOn(prismaService.patientOptOut, 'findFirst').mockResolvedValue({
        id: 'opt-out-123',
        patientId: mockPatient.id,
        channel: OutreachChannel.PHONE,
        createdAt: new Date(),
      });

      await expect(service.initiateCall(taskId)).rejects.toThrow(
        'Patient has opted out of phone outreach',
      );
    });
  });

  describe('getCall', () => {
    const callId = 'bland-call-123';

    const mockBlandResponse = {
      call_id: callId,
      answered_by: 'human',
      summary: JSON.stringify({}),
      status: 'completed',
    };

    const mockCareTaskUpdateEvent = jest.fn().mockResolvedValue({});
    const mockCareTaskFindFirstOrThrow = jest.fn().mockResolvedValue({
      id: callId,
      task: { patientId: mockPatient.id, patient: { optedOutChannels: [] } },
    });
    const mockPatientOptOutCreate = jest.fn().mockResolvedValue({});
    const mockEventResultCreateMany = jest.fn().mockResolvedValue({});
    let mockEventResultFindMany = jest.fn().mockResolvedValue([]);
    const mockEventResultFindFirstOrThrow = jest.fn().mockResolvedValue({ id: callId });

    beforeEach(() => {
      jest.spyOn(prismaService.careTaskEvent, 'update').mockImplementation(mockCareTaskUpdateEvent);
      jest
        .spyOn(prismaService.careTaskEvent, 'findFirstOrThrow')
        .mockImplementation(mockCareTaskFindFirstOrThrow);
      jest
        .spyOn(prismaService.eventResult, 'createMany')
        .mockImplementation(mockEventResultCreateMany);
      jest.spyOn(prismaService.eventResult, 'findMany').mockImplementation(mockEventResultFindMany);
      jest
        .spyOn(prismaService.eventResult, 'findFirstOrThrow')
        .mockImplementation(mockEventResultFindFirstOrThrow);
      jest.spyOn(prismaService.patientOptOut, 'create').mockImplementation(mockPatientOptOutCreate);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockBlandResponse),
      });
    });

    it('should update task event with SUCCESS when call is completed', async () => {
      await service.getCall(callId);

      // Assert
      expect(mockCareTaskUpdateEvent).toHaveBeenCalledWith({
        where: {
          id: callId,
        },
        data: {
          status: 'SUCCESS',
        },
      });
    });

    it('should update task event with VOICEMAIL when call goes to voicemail', async () => {
      mockBlandResponse.answered_by = 'voicemail';
      await service.getCall(callId);
      expect(mockCareTaskUpdateEvent).toHaveBeenCalledWith({
        where: {
          id: callId,
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

      await service.getCall(callId);

      expect(mockEventResultCreateMany).toHaveBeenCalledWith({
        data: [{ type: 'QUESTION', eventId: callId, key: 'question1', value: 'answer1' }],
      });

      expect(mockEventResultCreateMany).toHaveBeenCalledWith({
        data: [{ type: 'OTHER', eventId: callId, key: 'other1', value: 'answer2' }],
      });
    });

    it('should not create question results if we already created them', async () => {
      mockBlandResponse.summary = JSON.stringify({
        questions: [{ key: 'question1', value: 'answer1' }],
      });

      mockEventResultFindMany = jest
        .fn()
        .mockResolvedValue([
          { type: 'QUESTION', eventId: callId, key: 'question1', value: 'answer1' },
        ]);

      jest.spyOn(prismaService.eventResult, 'findMany').mockImplementation(mockEventResultFindMany);

      await service.getCall(callId);

      expect(mockEventResultCreateMany).not.toHaveBeenCalled();
    });

    it('should opt out if patient summary has requested_opt_out', async () => {
      mockBlandResponse.summary = JSON.stringify({
        requested_opt_out: true,
      });

      await service.getCall(callId);

      expect(mockPatientOptOutCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            patientId: mockPatient.id,
            channel: OutreachChannel.PHONE,
          },
        }),
      );
    });

    it('should not opt out if patient has already opted out', async () => {
      mockBlandResponse.summary = JSON.stringify({
        requested_opt_out: true,
      });
      mockCareTaskFindFirstOrThrow.mockResolvedValue({
        id: callId,
        task: {
          patientId: mockPatient.id,
          patient: {
            optedOutChannels: [{ channel: OutreachChannel.PHONE, createdAt: new Date() }],
          },
        },
      });

      await service.getCall(callId);

      expect(mockPatientOptOutCreate).not.toHaveBeenCalled();
    });

    it('handles invalid summaries', async () => {
      mockBlandResponse.summary = 'Failed to generate summary';
      await service.getCall(callId);
      expect(mockEventResultCreateMany).toHaveBeenCalledWith({
        data: [
          {
            type: 'OTHER',
            eventId: callId,
            key: 'failureReason',
            value: 'Failed to generate summary',
          },
        ],
      });
    });
  });
});
