import { getBlandAIConfig } from '#src/auth/bland-ai.credentials';
import { getErrorMessage } from '#src/utils';
import { Injectable } from '@nestjs/common';
import { CareTaskType } from '@prisma/client';
import { PathwayProvider, QuestionRoutingCaseResult } from '../pathway-provider';
import { LoggerNoPHI } from '#logger/logger';
import { getPathway, getPathwayID, getPathwayTests } from '#src/pathway/pathways';

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

  async testQuestionRouting(careTaskType: CareTaskType) {
    const RETRIES = 3;
    if (this.blandAPIKey == null) {
      throw new Error('BLAND_AI_API_KEY environment variable not set');
    }

    const pathwayID = getPathwayID(careTaskType);
    if (pathwayID == null) {
      throw new Error('Pathway ID not found');
    }

    const nodes = await this.getPathwayNodeIDsByName(careTaskType);

    const tests = getPathwayTests(careTaskType);
    if (tests == null) {
      throw new Error('Could not found any tests for ' + careTaskType);
    }

    const results = [] as QuestionRoutingCaseResult[];
    let i = 0;
    for (const test of tests) {
      i++;
      const questionID = nodes[test.question];
      const correctRouteID = nodes[test.correctRoute];

      // for each question, try it three times to check for consistency
      let successes = 0;
      for (let j = 0; j < RETRIES; j++) {
        // create pathway chat
        try {
          const pathwayChat = await fetch(`${this.blandAPIURL}/pathway/chat/create`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              authorization: this.blandAPIKey,
            },
            body: JSON.stringify({
              pathway_id: pathwayID,
              start_node_id: questionID,
              // TODO vary this input data
              requestData: {
                patient_full_name: 'Jiahan Ericsson',
                plan_name: 'Humana',
                patient_dob: '01/01/2000',
              },
            }),
          });

          if (!pathwayChat.ok) {
            const errorText = await pathwayChat.text();
            throw new Error(
              `Bland AI API error: ${pathwayChat.status} ${pathwayChat.statusText} - ${errorText}`,
            );
          }

          const pathwayChatObject = (await pathwayChat.json()) as { data: { chat_id: string } };
          const chatID = pathwayChatObject.data.chat_id;

          // push a message to the pathway chat and see what it says back
          const chatResponse = await fetch(`${this.blandAPIURL}/pathway/chat/${chatID}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              authorization: this.blandAPIKey,
            },
            body: JSON.stringify({ message: test.answer }),
          });

          if (!chatResponse.ok) {
            const errorText = await chatResponse.text();
            throw new Error(
              `Bland AI API error: ${chatResponse.status} ${chatResponse.statusText} - ${errorText}`,
            );
          }

          const chatResponseObject = (await chatResponse.json()) as {
            data: { current_node_id: string };
          };
          const currentNodeID = chatResponseObject.data.current_node_id;

          if (currentNodeID === correctRouteID) {
            successes++;
            console.log(`test (${i}/${tests.length}) retry (${j + 1}/${RETRIES}): success!`);
          } else {
            console.log(`test (${i}/${tests.length}) retry (${j + 1}/${RETRIES}): failed :(`);
          }
        } catch (error) {
          this.logger.error(`Failed to test question routing:`, { error: getErrorMessage(error) });
        }
      }
      results.push({
        successRate: successes / RETRIES,
        ...test,
      });
    }
    return results;
  }

  async getPathwayNodeIDsByName(careTaskType: CareTaskType) {
    if (this.blandAPIKey == null) {
      throw new Error('BLAND_AI_API_KEY environment variable not set');
    }

    const pathwayID = getPathwayID(careTaskType);

    if (pathwayID == null) {
      throw new Error('Pathway ID not found');
    }

    try {
      const response = await fetch(`${this.blandAPIURL}/pathway/${pathwayID}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          authorization: this.blandAPIKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Bland AI API error: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      const pathway = (await response.json()) as {
        nodes: { id: string; data: { name: string } }[];
      };

      return Object.fromEntries(
        pathway.nodes.map((node) => [node.data?.name ?? 'unknown', node.id]),
      ) as Record<string, string>;
    } catch (error) {
      throw new Error("Couldn't get pathway info" + error);
    }
  }
}
