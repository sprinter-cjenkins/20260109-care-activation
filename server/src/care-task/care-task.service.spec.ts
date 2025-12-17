import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CareTaskService } from './care-task.service';
import { PrismaService } from '../prisma/prisma.service';
import { CareTaskStatus, CareTaskType } from '@ca/prisma';
import { mockCareTaskPayload, mockPatientPayload } from '../../test/mocks';

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

  describe('createByExternalID', () => {
    it('should create a care task when patient exists', async () => {
      // Arrange
      const externalID = 'EXT123';
      const taskData = {
        type: CareTaskType.DEXA_SCAN,
        status: CareTaskStatus.PENDING,
      };

      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatientPayload);
      mockPrismaService.careTask.create.mockResolvedValue(mockCareTaskPayload);

      // Act
      const result = await service.createByExternalID(externalID, taskData);

      // Assert
      expect(mockPrismaService.patient.findUnique).toHaveBeenCalledWith({
        where: { externalID },
      });
      expect(mockPrismaService.careTask.create).toHaveBeenCalledWith({
        data: {
          ...taskData,
          patientID: mockPatientPayload.id,
        },
        include: {
          patient: true,
          events: true,
        },
      });
      expect(result).toEqual(mockCareTaskPayload);
    });

    it('should throw NotFoundException when patient does not exist', async () => {
      // Arrange
      const externalID = 'NONEXISTENT';
      const taskData = {
        type: CareTaskType.MAMMOGRAM,
        status: CareTaskStatus.SCHEDULED,
      };

      mockPrismaService.patient.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.createByExternalID(externalID, taskData)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.createByExternalID(externalID, taskData)).rejects.toThrow(
        'Patient with external ID NONEXISTENT not found',
      );

      expect(mockPrismaService.patient.findUnique).toHaveBeenCalledWith({
        where: { externalID },
      });
      expect(mockPrismaService.careTask.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update a care task when it exists', async () => {
      // Arrange
      const careTaskID = 'task-1';
      const updateData = {
        status: CareTaskStatus.COMPLETED,
      };
      const updatedTask = { ...mockCareTaskPayload, ...updateData };

      mockPrismaService.careTask.findUnique.mockResolvedValue(mockCareTaskPayload);
      mockPrismaService.careTask.update.mockResolvedValue(updatedTask);

      // Act
      const result = await service.update(careTaskID, updateData);

      // Assert
      expect(mockPrismaService.careTask.findUnique).toHaveBeenCalledWith({
        where: { id: careTaskID },
        include: {
          patient: true,
          events: true,
        },
      });
      expect(mockPrismaService.careTask.update).toHaveBeenCalledWith({
        where: { id: careTaskID },
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
      const careTaskID = 'nonexistent-task';
      const updateData = {
        status: CareTaskStatus.COMPLETED,
      };

      mockPrismaService.careTask.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update(careTaskID, updateData)).rejects.toThrow(NotFoundException);
      await expect(service.update(careTaskID, updateData)).rejects.toThrow(
        'CareTask with ID nonexistent-task not found',
      );

      expect(mockPrismaService.careTask.findUnique).toHaveBeenCalledWith({
        where: { id: careTaskID },
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
      const careTaskID = 'task-1';

      mockPrismaService.careTask.findUnique.mockResolvedValue(mockCareTaskPayload);
      mockPrismaService.careTask.delete.mockResolvedValue(mockCareTaskPayload);

      // Act
      const result = await service.remove(careTaskID);

      // Assert
      expect(mockPrismaService.careTask.findUnique).toHaveBeenCalledWith({
        where: { id: careTaskID },
        include: {
          patient: true,
          events: true,
        },
      });
      expect(mockPrismaService.careTask.delete).toHaveBeenCalledWith({
        where: { id: careTaskID },
        include: {
          patient: true,
          events: true,
        },
      });
      expect(result).toEqual(mockCareTaskPayload);
    });

    it('should throw NotFoundException when care task does not exist', async () => {
      // Arrange
      const careTaskID = 'nonexistent-task';

      mockPrismaService.careTask.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.remove(careTaskID)).rejects.toThrow(NotFoundException);
      await expect(service.remove(careTaskID)).rejects.toThrow(
        'CareTask with ID nonexistent-task not found',
      );

      expect(mockPrismaService.careTask.findUnique).toHaveBeenCalledWith({
        where: { id: careTaskID },
        include: {
          patient: true,
          events: true,
        },
      });
      expect(mockPrismaService.careTask.delete).not.toHaveBeenCalled();
    });
  });
});
