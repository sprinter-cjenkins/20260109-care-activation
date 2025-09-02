// src/patient/patient.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PatientController } from './patient.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PatientController],
})
export class PatientModule {}
