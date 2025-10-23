import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '#prisma/prisma.service';
import { CareTask, CareTaskStatus, Prisma } from '@prisma/client';

@Injectable()
export class CareTaskService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<CareTask[]> {
    return this.prisma.careTask.findMany({
      include: {
        patient: true,
        events: true,
      },
    });
  }

  async findOne(id: string): Promise<CareTask | null> {
    return this.prisma.careTask.findUnique({
      where: { id },
      include: {
        patient: true,
        events: true,
      },
    });
  }

  async findByPatient(patientId: string): Promise<CareTask[]> {
    return this.prisma.careTask.findMany({
      where: { patientId },
      include: {
        patient: true,
        events: true,
      },
    });
  }

  async findByStatus(status: CareTaskStatus): Promise<CareTask[]> {
    return this.prisma.careTask.findMany({
      where: { status },
      include: {
        patient: true,
        events: true,
      },
    });
  }

  async createByExternalId(
    externalId: string,
    taskData: Omit<Prisma.CareTaskCreateInput, 'patientId' | 'patient'>,
  ): Promise<CareTask> {
    // First, find the patient by external ID
    const patient = await this.prisma.patient.findUnique({
      where: { externalId },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with external ID ${externalId} not found`);
    }

    // Create the care task with the found patient ID
    return this.prisma.careTask.create({
      data: {
        ...taskData,
        patientId: patient.id,
      },
      include: {
        patient: true,
        events: true,
      },
    });
  }

  async update(id: string, data: Prisma.CareTaskUpdateInput): Promise<CareTask> {
    // Check if task exists
    const existingTask = await this.findOne(id);
    if (!existingTask) {
      throw new NotFoundException(`CareTask with ID ${id} not found`);
    }

    return this.prisma.careTask.update({
      where: { id },
      data,
      include: {
        patient: true,
        events: true,
      },
    });
  }

  async remove(id: string): Promise<CareTask> {
    // Check if task exists
    const existingTask = await this.findOne(id);
    if (!existingTask) {
      throw new NotFoundException(`CareTask with ID ${id} not found`);
    }

    return this.prisma.careTask.delete({
      where: { id },
      include: {
        patient: true,
        events: true,
      },
    });
  }
}
