import { CareTaskType } from '@prisma/client';

export interface PathwayProvider {
  updatePathway: (careTaskType: CareTaskType) => Promise<{ success: boolean }>;
}
