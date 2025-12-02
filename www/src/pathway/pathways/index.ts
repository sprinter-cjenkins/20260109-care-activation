import { CareTaskType } from '@prisma/client';
import {
  DEXA_SCAN_PATHWAY,
  DEXA_SCAN_PATHWAY_TESTS,
  globalPrompt,
  voicemailMessage,
} from './DEXA_SCAN';
import buildBlandPathway from '../providers/bland-ai/buildBlandPathway';

const PRODUCTION_DEXA_PATHWAY_ID = 'b529e181-4184-47fd-b2a8-e4bab2dcdeb9';
const DEVELOPMENT_DEXA_PATHWAY_ID = '01a835e9-9ede-4919-a33f-43673fc95493';

export function getPathwayTests(taskType: CareTaskType) {
  switch (taskType) {
    case CareTaskType.DEXA_SCAN:
      return flattenPathwayTests(DEXA_SCAN_PATHWAY_TESTS);
    default:
      return null;
  }
}

export function getPathway(taskType: CareTaskType) {
  switch (taskType) {
    case CareTaskType.DEXA_SCAN:
      return buildBlandPathway({
        globalPrompt,
        voicemailMessage,
        pathway: DEXA_SCAN_PATHWAY,
      });
    default:
      return null;
  }
}

export function getPathwayID(careTaskType: CareTaskType) {
  switch (careTaskType) {
    case CareTaskType.DEXA_SCAN:
      return process.env.NODE_ENV === 'development'
        ? DEVELOPMENT_DEXA_PATHWAY_ID
        : PRODUCTION_DEXA_PATHWAY_ID;
    default:
      return null;
  }
}

export type PathwayTest = {
  question: string;
  correctRoutes: {
    correctRoute: string;
    answers: string[];
  }[];
};

export type FlattenedPathwayTest = {
  question: string;
  correctRoute: string;
  answer: string;
};

function flattenPathwayTests(tests: PathwayTest[]): FlattenedPathwayTest[] {
  return tests
    .map(({ question, correctRoutes }) =>
      correctRoutes.map(({ correctRoute, answers }) =>
        answers.map((answer) => ({
          question,
          correctRoute,
          answer,
        })),
      ),
    )
    .flat(2);
}
