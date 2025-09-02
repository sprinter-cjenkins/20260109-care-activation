import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { PatientModule } from './patient/patient.module';

@Module({
  imports: [PrismaModule, PatientModule],
})
export class AppModule {}
