import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { CareTaskService } from './care-task.service';
import { CareTask, CareTaskStatus, Prisma } from '@prisma/client';

@Controller('care-tasks')
export class CareTaskController {
  constructor(private readonly careTaskService: CareTaskService) {}

  @Get()
  findAll(
    @Query('patientId') patientId?: string,
    @Query('status') status?: string,
  ): Promise<CareTask[]> {
    if (patientId) {
      return this.careTaskService.findByPatient(patientId);
    }
    if (status && status in CareTaskStatus) {
      return this.careTaskService.findByStatus(status as CareTaskStatus);
    }
    return this.careTaskService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<CareTask | null> {
    return this.careTaskService.findOne(id);
  }

  @Post('createByExternalId')
  createByExternalId(
    @Body()
    data: {
      externalId: string;
      taskData: Omit<Prisma.CareTaskCreateInput, 'patientId' | 'patient'>;
    },
  ): Promise<CareTask> {
    return this.careTaskService.createByExternalId(data.externalId, data.taskData);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() data: Prisma.CareTaskUpdateInput): Promise<CareTask> {
    return this.careTaskService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<CareTask> {
    return this.careTaskService.remove(id);
  }
}
