import { Module } from '@nestjs/common';
import { CareTaskService } from './care-task.service';
import { CareTaskController } from './care-task.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [CareTaskService],
  controllers: [CareTaskController],
  exports: [CareTaskService],
})
export class CareTaskModule {}
