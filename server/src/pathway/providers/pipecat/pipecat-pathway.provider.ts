import { LoggerNoPHI } from '#logger/logger';
import { Injectable } from '@nestjs/common';
import { PathwayProvider, QuestionRoutingCaseResult } from '../pathway-provider';
import { CareTaskType } from '@ca/prisma';
import buildPipecatPathway from './buildPipecatPathway';
import { PATHWAY_FOR_CARE_TASK_TYPE } from '#src/pathway/pathways';

@Injectable()
export class PipecatPathwayProvider implements PathwayProvider {
  name: string = 'pipecat';

  private readonly logger: LoggerNoPHI;
  constructor(logger: LoggerNoPHI) {
    this.logger = logger;
  }

  getPathway(careTaskType: CareTaskType) {
    return buildPipecatPathway(PATHWAY_FOR_CARE_TASK_TYPE[careTaskType]);
  }

  async updatePathway() {
    return Promise.resolve({ success: false });
  }

  testQuestionRouting() {
    return Promise.resolve([] as QuestionRoutingCaseResult[]);
  }
}
