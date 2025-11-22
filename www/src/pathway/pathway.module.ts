import { Module } from '@nestjs/common';
import { PathwayController } from './pathway.controller';
import { PathwayService } from './pathway.service';

@Module({
  imports: [],
  controllers: [PathwayController],
  providers: [PathwayService],
  exports: [PathwayService],
})
export class PathwayModule {}
