import { Test, TestingModule } from '@nestjs/testing';
import { PatientService } from './patient.service';
import { PrismaService } from '../prisma/prisma.service';
import { PartnerOrganization } from '@prisma/client';

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

  const mockPatientData = {
    externalId: 'EXT123',
    email: 'john.doe@example.com',
    phone: '+1234567890',
    givenName: 'John',
    familyName: 'Doe',
    birthDate: new Date('1990-01-15'),
    timezone: 'America/New_York',
    partnerOrganization: PartnerOrganization.ELEVANCEHEALTH,
    metadata: {},
  };

  it('should create a new patient when no existing patient is found', async () => {
    // Arrange
    const createdPatient = {
      id: 'patient-1',
      ...mockPatientData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockPrismaService.patient.findMany.mockResolvedValue([]);
    mockPrismaService.patient.create.mockResolvedValue(createdPatient);

    // Act
    const result = await service.createOrUpdate(mockPatientData);

    // Assert
    expect(mockPrismaService.patient.findMany).toHaveBeenCalledWith({
      where: {
        externalId: mockPatientData.externalId,
        birthDate: mockPatientData.birthDate,
      },
    });
    expect(mockPrismaService.patient.create).toHaveBeenCalledWith({
      data: mockPatientData,
    });
    expect(mockPrismaService.patient.update).not.toHaveBeenCalled();
    expect(result).toEqual(createdPatient);
  });

  it('should update existing patient when one patient is found', async () => {
    // Arrange
    const existingPatient = { id: 'patient-1', ...mockPatientData };
    const updatedPatient = { ...existingPatient, email: 'john.updated@example.com' };

    mockPrismaService.patient.findMany.mockResolvedValue([existingPatient]);
    mockPrismaService.patient.update.mockResolvedValue(updatedPatient);

    // Act
    const result = await service.createOrUpdate(mockPatientData);

    // Assert
    expect(mockPrismaService.patient.findMany).toHaveBeenCalledWith({
      where: {
        externalId: mockPatientData.externalId,
        birthDate: mockPatientData.birthDate,
      },
    });
    expect(mockPrismaService.patient.update).toHaveBeenCalledWith({
      where: { id: existingPatient.id },
      data: mockPatientData,
    });
    expect(mockPrismaService.patient.create).not.toHaveBeenCalled();
    expect(result).toEqual(updatedPatient);
  });

  it('should throw error when multiple patients are found', async () => {
    // Arrange
    const existingPatients = [
      { id: 'patient-1', ...mockPatientData },
      { id: 'patient-2', ...mockPatientData },
    ];
    mockPrismaService.patient.findMany.mockResolvedValue(existingPatients);

    // Act & Assert
    await expect(service.createOrUpdate(mockPatientData)).rejects.toThrow(
      'Multiple patients found with the same externalId and birthDate',
    );

    expect(mockPrismaService.patient.findMany).toHaveBeenCalledWith({
      where: {
        externalId: mockPatientData.externalId,
        birthDate: mockPatientData.birthDate,
      },
    });
    expect(mockPrismaService.patient.create).not.toHaveBeenCalled();
    expect(mockPrismaService.patient.update).not.toHaveBeenCalled();
  });
});
