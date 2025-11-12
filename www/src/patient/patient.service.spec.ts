import { Test, TestingModule } from '@nestjs/testing';
import { PatientService } from './patient.service';
import { PrismaService } from '../prisma/prisma.service';
import { mockPatientCreateInput, mockPatientPayload } from '../../test/mocks';

describe('PatientService - createOrUpdate', () => {
  let service: PatientService;

  const mockPrismaService = {
    patient: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<PatientService>(PatientService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create a new patient when no existing patient is found', async () => {
    mockPrismaService.patient.findMany.mockResolvedValue([]);
    mockPrismaService.patient.create.mockResolvedValue(mockPatientPayload);

    // Act
    const result = await service.createOrUpdate(mockPatientCreateInput);

    // Assert
    expect(mockPrismaService.patient.findMany).toHaveBeenCalledWith({
      where: {
        externalID: mockPatientCreateInput.externalID,
        birthDate: mockPatientCreateInput.birthDate,
      },
    });
    expect(mockPrismaService.patient.create).toHaveBeenCalledWith({
      data: mockPatientCreateInput,
    });
    expect(mockPrismaService.patient.update).not.toHaveBeenCalled();
    expect(result).toEqual(mockPatientPayload);
  });

  it('should update existing patient when one patient is found', async () => {
    // Arrange
    const updatedPatient = { ...mockPatientPayload, birthDate: new Date('1990-01-16') };

    mockPrismaService.patient.findMany.mockResolvedValue([mockPatientPayload]);
    mockPrismaService.patient.update.mockResolvedValue(updatedPatient);

    // Act
    const result = await service.createOrUpdate(mockPatientCreateInput);

    // Assert
    expect(mockPrismaService.patient.findMany).toHaveBeenCalledWith({
      where: {
        externalID: mockPatientCreateInput.externalID,
        birthDate: mockPatientCreateInput.birthDate,
      },
    });
    expect(mockPrismaService.patient.update).toHaveBeenCalledWith({
      where: { id: mockPatientPayload.id },
      data: mockPatientCreateInput,
    });
    expect(mockPrismaService.patient.create).not.toHaveBeenCalled();
    expect(result).toEqual(updatedPatient);
  });

  it('should throw error when multiple patients are found', async () => {
    // Arrange
    const existingPatients = [
      { ...mockPatientPayload, id: 'patient-1' },
      { ...mockPatientPayload, id: 'patient-2' },
    ];
    mockPrismaService.patient.findMany.mockResolvedValue(existingPatients);

    // Act & Assert
    await expect(service.createOrUpdate(mockPatientCreateInput)).rejects.toThrow(
      'Multiple patients found with the same externalID and birthDate',
    );

    expect(mockPrismaService.patient.findMany).toHaveBeenCalledWith({
      where: {
        externalID: mockPatientCreateInput.externalID,
        birthDate: mockPatientCreateInput.birthDate,
      },
    });
    expect(mockPrismaService.patient.create).not.toHaveBeenCalled();
    expect(mockPrismaService.patient.update).not.toHaveBeenCalled();
  });
});
