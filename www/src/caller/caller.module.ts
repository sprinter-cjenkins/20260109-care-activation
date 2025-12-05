import { Module } from '@nestjs/common';
import { CallerService } from './caller.service';
import { CallerController } from './caller.controller';
import { PrismaModule } from '#prisma/prisma.module';
import { CallerProviderRegistry } from './providers/caller-provider.registry';

@Module({
  imports: [PrismaModule],
  providers: [CallerService, CallerProviderRegistry],
  controllers: [CallerController],
  exports: [CallerService],
})
export class CallerModule {}
