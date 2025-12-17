import { Controller, Post, Param } from '@nestjs/common';
import { CareTaskType } from '@ca/prisma';
import { APIPushResult, PathwayService } from './pathway.service';

@Controller('pathway')
export class PathwayController {
  constructor(private readonly pathwayService: PathwayService) {}

  @Post('push/:careTaskType')
  create(@Param('careTaskType') careTaskType: CareTaskType): Promise<APIPushResult> {
    return this.pathwayService.push(careTaskType);
  }
}
