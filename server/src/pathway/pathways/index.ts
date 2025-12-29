import { CareTaskType } from '@ca/prisma';
import { DEXA_SCAN_PATHWAY, DEXA_SCAN_PATHWAY_TESTS } from './DEXA_SCAN';
import { Pathway } from '../util/Pathway';

export const PATHWAY_FOR_CARE_TASK_TYPE: Record<CareTaskType, Pathway> = {
  [CareTaskType.DEXA_SCAN]: DEXA_SCAN_PATHWAY,
  [CareTaskType.MAMMOGRAM]: { voicemailMessage: '', globalPrompt: '', segments: [] },
};

export const PATHWAY_TEST_FOR_CARE_TASK_TYPE: Record<CareTaskType, FlattenedPathwayTest[]> = {
  [CareTaskType.DEXA_SCAN]: flattenPathwayTests(DEXA_SCAN_PATHWAY_TESTS),
  [CareTaskType.MAMMOGRAM]: flattenPathwayTests([]),
};

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
