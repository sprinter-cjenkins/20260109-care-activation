import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Patient, Prisma } from '@prisma/client';

export const patientNameAndTelecomInclude = {
  telecom: true,
  name: true,
} satisfies Prisma.PatientInclude;

export type PatientPayload = Prisma.PatientGetPayload<{
  include: typeof patientNameAndTelecomInclude;
}>;

@Injectable()
export class PatientService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<PatientPayload[]> {
    return this.prisma.patient.findMany({ include: patientNameAndTelecomInclude });
  }

  async findOne(id: string): Promise<PatientPayload | null> {
    return this.prisma.patient.findUnique({
      where: { id },
      include: patientNameAndTelecomInclude,
    });
  }

  async findWhere(query: Prisma.PatientWhereInput): Promise<Patient[]> {
    return this.prisma.patient.findMany({ where: query });
  }

  async create(data: Prisma.PatientCreateInput): Promise<Patient> {
    return this.prisma.patient.create({ data });
  }

  async update(id: string, data: Prisma.PatientUpdateInput): Promise<Patient> {
    return this.prisma.patient.update({ where: { id }, data });
  }

  async remove(id: string): Promise<Patient> {
    return this.prisma.patient.delete({ where: { id } });
  }

  async createOrUpdate(data: Prisma.PatientCreateInput): Promise<Patient> {
    const existingPatients = await this.findWhere({
      externalID: data.externalID,
      birthDate: data.birthDate,
    });
    if (existingPatients.length > 1) {
      throw new Error('Multiple patients found with the same externalID and birthDate');
    }
    if (existingPatients.length === 1) {
      return this.update(existingPatients[0].id, data);
    }
    return this.create(data);
  }
}
