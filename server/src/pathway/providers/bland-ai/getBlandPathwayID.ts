import { CareTaskType } from '@ca/prisma';

const PRODUCTION_DEXA_PATHWAY_ID = 'b529e181-4184-47fd-b2a8-e4bab2dcdeb9';
const DEVELOPMENT_DEXA_PATHWAY_ID = '01a835e9-9ede-4919-a33f-43673fc95493';

export default function getBlandPathwayID(careTaskType: CareTaskType) {
  switch (careTaskType) {
    case CareTaskType.DEXA_SCAN:
      return process.env.NODE_ENV === 'development'
        ? DEVELOPMENT_DEXA_PATHWAY_ID
        : PRODUCTION_DEXA_PATHWAY_ID;
    default:
      return null;
  }
}
