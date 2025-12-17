import { getBlandAIConfig } from '#src/auth/bland-ai.credentials';
import { getErrorMessage } from '#src/utils';
import { Injectable } from '@nestjs/common';
import { CareTaskType } from '@ca/prisma';
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

    const testPromises = Array.from(
      new Array(tests.length),
      () => [],
    ) as (() => Promise<boolean>)[][];
    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      const questionID = nodes[test.question];
      const correctRouteID = nodes[test.correctRoute];

      // for each question, try it three times to check for consistency
      for (let j = 0; j < RETRIES; j++) {
        testPromises[i].push(async () => {
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
                request_data: {
                  patient_full_name: 'Jiahan Ericsson',
                  plan_name: 'Humana',
                  patient_dob: '01/01/1999',
                },
              }),
            });

            if (!pathwayChat.ok) {
              const errorText = await pathwayChat.text();
              throw new Error(
                `Bland AI API error: ${pathwayChat.status} ${pathwayChat.statusText} - ${errorText}`,
              );
            }

            const pathwayChatObject = (await pathwayChat.json()) as {
              data: { chat_id: string };
            };
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
              data: {
                current_node_id: string;
                current_node_name: string;
                assistant_responses: string;
              };
            };
            const currentNodeID = chatResponseObject.data.current_node_id;

            if (currentNodeID === correctRouteID) {
              console.log(`test (${i + 1}/${tests.length}) retry (${j + 1}/${RETRIES}): correct!`);
            } else {
              console.log(
                `test (${i + 1}/${tests.length}) retry (${j + 1}/${RETRIES}): wrong :( [${chatResponseObject.data.current_node_name} != ${test.correctRoute}]`,
              );
              console.log(`Response: ${chatResponseObject.data.assistant_responses}`);
            }

            return currentNodeID === correctRouteID;
          } catch (error) {
            this.logger.error(`Failed to test question routing:`, {
              error: getErrorMessage(error),
            });
          }
          return false;
        });
      }
    }

    // now actually run the API queries for the tests
    const results = [] as QuestionRoutingCaseResult[];
    for (let i = 0; i < tests.length; i++) {
      console.log(`round ${i}: ${tests[i].question} - ${tests[i].answer}`);
      const runs = await Promise.all(testPromises[i].map((pr) => pr()));
      const successes = runs.reduce((acc, run) => acc + (run ? 1 : 0), 0);

      results.push({
        successRate: successes / RETRIES,
        ...tests[i],
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
