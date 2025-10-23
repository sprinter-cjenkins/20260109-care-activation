import { Module } from '@nestjs/common';
import { CallerService } from './caller.service';
import { CallerController } from './caller.controller';
import { PrismaModule } from '#prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [CallerService],
  controllers: [CallerController],
  exports: [CallerService],
})
export class CallerModule {}
