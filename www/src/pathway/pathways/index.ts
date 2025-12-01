import { CareTaskType } from '@prisma/client';
import { DEXA_SCAN_PATHWAY, globalPrompt, voicemailMessage } from './DEXA_SCAN';
import buildBlandPathway from '../providers/bland-ai/buildBlandPathway';
import { DEXA_SCAN_TESTS } from './DEXA_SCAN.test';

const PRODUCTION_DEXA_PATHWAY_ID = 'b529e181-4184-47fd-b2a8-e4bab2dcdeb9';
const DEVELOPMENT_DEXA_PATHWAY_ID = '01a835e9-9ede-4919-a33f-43673fc95493';

export function getPathwayTests(taskType: CareTaskType) {
  switch (taskType) {
    case CareTaskType.DEXA_SCAN:
      return DEXA_SCAN_TESTS;
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
