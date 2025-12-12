import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '#prisma/prisma.service';
import { CareTask, CareTaskStatus, Prisma } from '@prisma/client';

export const careTaskPatientAndEventsInclude = {
  patient: true,
  events: true,
} satisfies Prisma.CareTaskInclude;

export type CareTaskPayload = Prisma.CareTaskGetPayload<{
  include: typeof careTaskPatientAndEventsInclude;
}>;

@Injectable()
export class CareTaskService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<CareTaskPayload[]> {
    return this.prisma.careTask.findMany({
      include: careTaskPatientAndEventsInclude,
    });
  }

  async findOne(id: string): Promise<CareTaskPayload | null> {
    return this.prisma.careTask.findUnique({
      where: { id },
      include: careTaskPatientAndEventsInclude,
    });
  }

  async findByPatient(patientID: string): Promise<CareTaskPayload[]> {
    return this.prisma.careTask.findMany({
      where: { patientID },
      include: careTaskPatientAndEventsInclude,
    });
  }

  async findByStatus(status: CareTaskStatus): Promise<CareTaskPayload[]> {
    return this.prisma.careTask.findMany({
      where: { status },
      include: careTaskPatientAndEventsInclude,
    });
  }

  async createByExternalID(
    externalID: string,
    taskData: Omit<Prisma.CareTaskCreateInput, 'patientID' | 'patient'>,
  ): Promise<CareTask> {
    // First, find the patient by external ID
    const patient = await this.prisma.patient.findUnique({
      where: { externalID },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with external ID ${externalID} not found`);
    }

    // Create the care task with the found patient ID
    return this.prisma.careTask.create({
      data: {
        ...taskData,
        patientID: patient.id,
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
