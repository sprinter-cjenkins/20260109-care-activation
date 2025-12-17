import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { CareTaskService } from './care-task.service';
import { CareTask, CareTaskStatus, Prisma } from '@ca/prisma';

@Controller('care-tasks')
export class CareTaskController {
  constructor(private readonly careTaskService: CareTaskService) {}

  @Get()
  findAll(
    @Query('patientID') patientID?: string,
    @Query('status') status?: string,
  ): Promise<CareTask[]> {
    if (patientID) {
      return this.careTaskService.findByPatient(patientID);
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

  @Post('createByExternalID')
  createByExternalID(
    @Body()
    data: {
      externalID: string;
      taskData: Omit<Prisma.CareTaskCreateInput, 'patientID' | 'patient'>;
    },
  ): Promise<CareTask> {
    return this.careTaskService.createByExternalID(data.externalID, data.taskData);
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
