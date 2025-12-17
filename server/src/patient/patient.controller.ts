import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { PatientService } from './patient.service';
import type { PatientFullCreateInput } from './patient.service';
import { Patient, Prisma } from '@ca/prisma';

@Controller('patients')
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  @Get()
  findAll(): Promise<Patient[]> {
    return this.patientService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Patient | null> {
    return this.patientService.findOne(id);
  }

  @Post('create')
  create(@Body() data: Prisma.PatientCreateInput): Promise<Patient> {
    return this.patientService.createOrUpdate(data);
  }

  @Post('create-full')
  createFull(@Body() data: PatientFullCreateInput): Promise<Patient> {
    return this.patientService.createFull(data);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() data: Prisma.PatientUpdateInput): Promise<Patient> {
    return this.patientService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<Patient> {
    return this.patientService.remove(id);
  }
}
