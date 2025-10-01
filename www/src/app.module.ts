import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { PatientModule } from './patient/patient.module';
import { CallerModule } from './caller/caller.module';
import { CareTaskModule } from './care-task/care-task.module';
import { LoggerModule } from './logger/logger.module';

@Module({
  imports: [PrismaModule, PatientModule, CallerModule, CareTaskModule, LoggerModule],
})
export class AppModule {}
