import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Patient, Prisma } from '@prisma/client';

@Injectable()
export class PatientService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Patient[]> {
    return this.prisma.patient.findMany();
  }

  async findOne(id: string): Promise<Patient | null> {
    return this.prisma.patient.findUnique({ where: { id } });
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
      externalId: data.externalId,
      birthDate: data.birthDate,
    });
    if (existingPatients.length > 1) {
      throw new Error('Multiple patients found with the same externalId and birthDate');
    }
    if (existingPatients.length === 1) {
      return this.update(existingPatients[0].id, data);
    }
    return this.create(data);
  }
}
