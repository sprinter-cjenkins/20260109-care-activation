import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Patient } from '@prisma/client';

@Controller('patients')
export class PatientController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll(): Promise<Patient[]> {
    return this.prisma.patient.findMany();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Patient | null> {
    return this.prisma.patient.findUnique({ where: { id } });
  }

  @Post()
  create(@Body() data: any): Promise<Patient> {
    return this.prisma.patient.create({ data });
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() data: any): Promise<Patient> {
    return this.prisma.patient.update({ where: { id }, data });
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<Patient> {
    return this.prisma.patient.delete({ where: { id } });
  }
}
