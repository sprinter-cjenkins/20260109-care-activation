import { LoggerNoPHI } from '#logger/logger';
import { Injectable } from '@nestjs/common';
import { CareTaskType } from '@prisma/client';
import { PathwayProvider, QuestionRoutingCaseResult } from './providers/pathway-provider';
import { BlandAIPathwayProvider } from './providers/bland-ai/bland-ai-pathway.provider';

export interface APIPushResult {
  success: boolean;
}

@Injectable()
export class PathwayService {
  private readonly logger: LoggerNoPHI;
  private readonly pathwayProvider: PathwayProvider;
  constructor() {
    this.logger = new LoggerNoPHI(PathwayService.name);
    this.pathwayProvider = new BlandAIPathwayProvider(this.logger);
  }

  async push(careTaskType: CareTaskType): Promise<APIPushResult> {
    return await this.pathwayProvider.updatePathway(careTaskType);
  }

  async test(careTaskType: CareTaskType): Promise<QuestionRoutingCaseResult[]> {
    return await this.pathwayProvider.testQuestionRouting(careTaskType);
  }
}
