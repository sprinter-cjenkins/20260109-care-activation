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
    it('should throw error when task is not found', async () => {
      // Arrange
      const taskId = 'non-existent-task';
      jest.spyOn(prismaService.careTask, 'findUnique').mockResolvedValue(null);

      // Act & Assert
      await expect(service.initiateCall(taskId)).rejects.toThrow('Task not found');
    });

    it('should throw error when task type is not DEXA_SCAN', async () => {
      // Arrange
      const taskId = 'task-456';
      jest.spyOn(prismaService.careTask, 'findUnique').mockResolvedValue(mockNonDexaTask);

      // Act & Assert
      await expect(service.initiateCall(taskId)).rejects.toThrow('Task not found');
    });

    it('should successfully call Bland AI with correct parameters for DEXA_SCAN task', async () => {
      const taskId = 'task-123';

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
});
