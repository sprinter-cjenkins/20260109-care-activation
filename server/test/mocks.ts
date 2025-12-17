import { CareTaskPayload } from '#care-task/care-task.service';
import { PatientPayload } from '#patient/patient.service';
import {
  CallerProvider,
  CareTaskStatus,
  CareTaskType,
  ContactPointSystem,
  ContactPointUse,
  NameUse,
  PartnerOrganization,
  Prisma,
} from '@ca/prisma';

export const mockPatientCreateInput: Prisma.PatientCreateInput = {
  externalID: 'EXT123',
  birthDate: new Date('1990-01-15'),
  timezone: 'America/New_York',
  partnerOrganization: PartnerOrganization.ELEVANCEHEALTH,
  metadata: {},
};

export const mockPatientPayload: PatientPayload = {
  ...mockPatientCreateInput,
  birthDate: new Date('1990-01-15'),
  metadata: {},
  id: 'patient-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  telecom: [
    {
      id: 'telecom-1',
      system: ContactPointSystem.PHONE,
      value: '+1234567890',
      use: ContactPointUse.HOME,
      rank: 1,
      patientID: 'patient-1',
    },
    {
      id: 'telecom-2',
      system: ContactPointSystem.EMAIL,
      value: 'john.doe@example.com',
      use: ContactPointUse.HOME,
      rank: 1,
      patientID: 'patient-1',
    },
  ],
  name: [
    {
      id: 'name-1',
      given: ['John'],
      family: 'Doe',
      use: NameUse.USUAL,
      patientID: 'patient-1',
      prefix: null,
      suffix: null,
    },
  ],
};

export const mockCareTaskPayload: CareTaskPayload = {
  id: 'task-1',
  patientID: 'patient-1',
  type: CareTaskType.DEXA_SCAN,
  status: CareTaskStatus.PENDING,
  createdAt: new Date(),
  updatedAt: new Date(),
  patient: mockPatientPayload,
  events: [],
  callerProvider: CallerProvider.BLAND_AI,
};
