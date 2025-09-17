import { Test, TestingModule } from '@nestjs/testing';
import { CallerService } from './caller.service';
import { PrismaService } from '../prisma/prisma.service';
import { CareTaskStatus, CareTaskType, PartnerOrganization, Patient } from '@prisma/client';
import { getAiTask, getFirstSentence, getSummaryPrompt, getVoicemailMessage } from './utils';

// Mock fetch globally
global.fetch = jest.fn();

describe('CallerService', () => {
  let service: CallerService;
  let prismaService: PrismaService;

  const mockPatient: Patient = {
    id: 'patient-123',
    givenName: 'John',
    familyName: 'Doe',
    phone: '+1234567890',
    externalId: 'ext-123',
    birthDate: new Date('1990-01-01'),
    createdAt: new Date(),
    updatedAt: new Date(),
    email: 'john.doe@example.com',
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
      await expect(service.initiateCall(taskId)).rejects.toThrow('Task not found');
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
      expect(global.fetch).toHaveBeenCalledWith('https://api.bland.ai/v1/calls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: 'test-api-key',
        },
        body: JSON.stringify({
          phone_number: mockPatient.phone,
          voice: 'June',
          task: getAiTask(mockDexaTask.type),
          first_sentence: getFirstSentence(mockPatient),
          voicemail: {
            message: getVoicemailMessage(mockPatient, mockDexaTask.type),
            action: 'leave_message',
            sensitive: true,
          },
          summary_prompt: getSummaryPrompt(),
        }),
      });
    });
  });

  describe('getCall', () => {
    const callId = 'bland-call-123';

    const mockBlandResponse = {
      call_id: callId,
      answered_by: 'human',
      summary: JSON.stringify({}),
    };

    const mockCareTaskUpdateEvent = jest.fn().mockResolvedValue({});
    const mockCareTaskFindFirstOrThrow = jest.fn().mockResolvedValue({ id: callId });
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
        .spyOn(prismaService.careTaskEvent, 'findFirstOrThrow')
        .mockImplementation(mockEventResultFindFirstOrThrow);

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
  });
});
