import { CareTaskType } from '@ca/prisma';

export type QuestionRoutingCaseResult = {
  question: string;
  answer: string;
  correctRoute: string;
  successRate: number;
};

export interface PathwayProvider {
  updatePathway: (careTaskType: CareTaskType) => Promise<{ success: boolean }>;
  testQuestionRouting: (careTaskType: CareTaskType) => Promise<QuestionRoutingCaseResult[]>;
  getPathway: (careTaskType: CareTaskType) => unknown;
}
