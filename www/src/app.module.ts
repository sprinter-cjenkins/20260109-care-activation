import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { PatientModule } from './patient/patient.module';
import { CallerModule } from './caller/caller.module';
import { CareTaskModule } from './care-task/care-task.module';
import { HealthModule } from './health/health.module';
import { PathwayModule } from './pathway/pathway.module';

@Module({
  imports: [PrismaModule, PatientModule, CallerModule, CareTaskModule, HealthModule, PathwayModule],
})
export class AppModule {}
