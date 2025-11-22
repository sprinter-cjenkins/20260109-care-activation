import { getBlandAIConfig } from '#src/auth/bland-ai.credentials';
import { getErrorMessage } from '#src/utils';
import { Injectable } from '@nestjs/common';
import { CareTaskType } from '@prisma/client';
import { PathwayProvider } from '../pathway-provider';
import { LoggerNoPHI } from '#logger/logger';
import { getPathway, getPathwayID } from '#src/pathway/pathways';

@Injectable()
export class BlandAIPathwayProvider implements PathwayProvider {
  name: string = 'bland-ai';

  private readonly blandAPIKey: string;
  private readonly blandAPIURL: string;

  private readonly logger: LoggerNoPHI;

  constructor(logger: LoggerNoPHI) {
    this.logger = logger;

    const { blandAPIKey, blandAPIURL } = getBlandAIConfig();

    if (blandAPIKey == null) {
      throw new Error('BLAND_AI_API_KEY environment variable not set');
    }

    this.blandAPIKey = blandAPIKey;
    this.blandAPIURL = blandAPIURL;
  }

  // This overwrites the existing pathway data in bland, proceed with caution when on production
  async updatePathway(careTaskType: CareTaskType) {
    if (this.blandAPIKey == null) {
      throw new Error('BLAND_AI_API_KEY environment variable not set');
    }

    const pathwayID = getPathwayID(careTaskType);

    if (pathwayID == null) {
      throw new Error('Pathway ID not found');
    }

    try {
      const response = await fetch(`${this.blandAPIURL}/pathway/${pathwayID}/version/3`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: this.blandAPIKey,
        },
        body: JSON.stringify(getPathway(careTaskType)),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Bland AI API error: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      // promote the version
      const promoteResponse = await fetch(`${this.blandAPIURL}/pathway/${pathwayID}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: this.blandAPIKey,
        },
        body: JSON.stringify({ version_id: 3 }),
      });

      if (!promoteResponse.ok) {
        const errorText = await promoteResponse.text();
        throw new Error(
          `Bland AI API error: ${promoteResponse.status} ${promoteResponse.statusText} - ${errorText}`,
        );
      }

      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to update pathway:`, { error: getErrorMessage(error) });
      return { success: false };
    }
  }
}
