// src/patient/patient.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PatientController } from './patient.controller';
import { PatientService } from './patient.service';

@Module({
  imports: [PrismaModule],
  controllers: [PatientController],
  providers: [PatientService],
})
export class PatientModule {}
