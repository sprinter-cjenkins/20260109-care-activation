import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CareTaskService } from './care-task.service';
import { PrismaService } from '../prisma/prisma.service';
import { CareTaskStatus, CareTaskType, PartnerOrganization } from '@prisma/client';

describe('CareTaskService', () => {
  let service: CareTaskService;

  const mockPrismaService = {
    careTask: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    patient: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CareTaskService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CareTaskService>(CareTaskService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockPatient = {
    id: 'patient-1',
    externalId: 'EXT123',
    email: 'john.doe@example.com',
    phone: '+1234567890',
    givenName: 'John',
    familyName: 'Doe',
    birthDate: new Date('1990-01-15'),
    timezone: 'America/New_York',
    partnerOrganization: PartnerOrganization.ELEVANCEHEALTH,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCareTask = {
    id: 'task-1',
    patientId: 'patient-1',
    type: CareTaskType.DEXA_SCAN,
    status: CareTaskStatus.PENDING,
    createdAt: new Date(),
    updatedAt: new Date(),
    patient: mockPatient,
    events: [],
  };

  describe('createByExternalId', () => {
    it('should create a care task when patient exists', async () => {
      // Arrange
      const externalId = 'EXT123';
      const taskData = {
        type: CareTaskType.DEXA_SCAN,
        status: CareTaskStatus.PENDING,
      };

      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
      mockPrismaService.careTask.create.mockResolvedValue(mockCareTask);

      // Act
      const result = await service.createByExternalId(externalId, taskData);

      // Assert
      expect(mockPrismaService.patient.findUnique).toHaveBeenCalledWith({
        where: { externalId },
      });
      expect(mockPrismaService.careTask.create).toHaveBeenCalledWith({
        data: {
          ...taskData,
          patientId: mockPatient.id,
        },
        include: {
          patient: true,
          events: true,
        },
      });
      expect(result).toEqual(mockCareTask);
    });

    it('should throw NotFoundException when patient does not exist', async () => {
      // Arrange
      const externalId = 'NONEXISTENT';
      const taskData = {
        type: CareTaskType.MAMMOGRAM,
        status: CareTaskStatus.SCHEDULED,
      };

      mockPrismaService.patient.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.createByExternalId(externalId, taskData)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.createByExternalId(externalId, taskData)).rejects.toThrow(
        'Patient with external ID NONEXISTENT not found',
      );

      expect(mockPrismaService.patient.findUnique).toHaveBeenCalledWith({
        where: { externalId },
      });
      expect(mockPrismaService.careTask.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update a care task when it exists', async () => {
      // Arrange
      const taskId = 'task-1';
      const updateData = {
        status: CareTaskStatus.COMPLETED,
      };
      const updatedTask = { ...mockCareTask, ...updateData };

      mockPrismaService.careTask.findUnique.mockResolvedValue(mockCareTask);
      mockPrismaService.careTask.update.mockResolvedValue(updatedTask);

      // Act
      const result = await service.update(taskId, updateData);

      // Assert
      expect(mockPrismaService.careTask.findUnique).toHaveBeenCalledWith({
        where: { id: taskId },
        include: {
          patient: true,
          events: true,
        },
      });
      expect(mockPrismaService.careTask.update).toHaveBeenCalledWith({
        where: { id: taskId },
        data: updateData,
        include: {
          patient: true,
          events: true,
        },
      });
      expect(result).toEqual(updatedTask);
    });

    it('should throw NotFoundException when care task does not exist', async () => {
      // Arrange
      const taskId = 'nonexistent-task';
      const updateData = {
        status: CareTaskStatus.COMPLETED,
      };

      mockPrismaService.careTask.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update(taskId, updateData)).rejects.toThrow(NotFoundException);
      await expect(service.update(taskId, updateData)).rejects.toThrow(
        'CareTask with ID nonexistent-task not found',
      );

      expect(mockPrismaService.careTask.findUnique).toHaveBeenCalledWith({
        where: { id: taskId },
        include: {
          patient: true,
          events: true,
        },
      });
      expect(mockPrismaService.careTask.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should delete a care task when it exists', async () => {
      // Arrange
      const taskId = 'task-1';

      mockPrismaService.careTask.findUnique.mockResolvedValue(mockCareTask);
      mockPrismaService.careTask.delete.mockResolvedValue(mockCareTask);

      // Act
      const result = await service.remove(taskId);

      // Assert
      expect(mockPrismaService.careTask.findUnique).toHaveBeenCalledWith({
        where: { id: taskId },
        include: {
          patient: true,
          events: true,
        },
      });
      expect(mockPrismaService.careTask.delete).toHaveBeenCalledWith({
        where: { id: taskId },
        include: {
          patient: true,
          events: true,
        },
      });
      expect(result).toEqual(mockCareTask);
    });

    it('should throw NotFoundException when care task does not exist', async () => {
      // Arrange
      const taskId = 'nonexistent-task';

      mockPrismaService.careTask.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.remove(taskId)).rejects.toThrow(NotFoundException);
      await expect(service.remove(taskId)).rejects.toThrow(
        'CareTask with ID nonexistent-task not found',
      );

      expect(mockPrismaService.careTask.findUnique).toHaveBeenCalledWith({
        where: { id: taskId },
        include: {
          patient: true,
          events: true,
        },
      });
      expect(mockPrismaService.careTask.delete).not.toHaveBeenCalled();
    });
  });
});
