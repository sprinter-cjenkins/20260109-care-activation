import { getBlandAIConfig } from '#src/auth/bland-ai.credentials';
import { getErrorMessage } from '#src/util/getErrorMessage';
import { Injectable } from '@nestjs/common';
import { CareTaskType } from '@ca/prisma';
import { PathwayProvider, QuestionRoutingCaseResult } from '../pathway-provider';
import { LoggerNoPHI } from '#logger/logger';
import buildBlandPathway from './buildBlandPathway';
import { PATHWAY_FOR_CARE_TASK_TYPE, PATHWAY_TEST_FOR_CARE_TASK_TYPE } from '#src/pathway/pathways';
import getBlandPathwayID from './getBlandPathwayID';
import axios from 'axios';
import generateTestCases from '#src/pathway/testing/generateTestCases';

@Injectable()
export class BlandAIPathwayProvider implements PathwayProvider {
  name: string = 'bland-ai';

  private readonly blandAPIKey: string;
  private readonly blandAPIURL: string;
  private readonly pathwayChatEndpoint: string;

  private readonly logger: LoggerNoPHI;

  constructor(logger: LoggerNoPHI) {
    this.logger = logger;

    const { blandAPIKey, blandAPIURL } = getBlandAIConfig();

    if (blandAPIKey == null) {
      throw new Error('BLAND_AI_API_KEY environment variable not set');
    }

    this.blandAPIKey = blandAPIKey;
    this.blandAPIURL = blandAPIURL;
    this.pathwayChatEndpoint = `${this.blandAPIURL}/pathway/chat`;
  }

  getPathwayTests(taskType: CareTaskType) {
    return PATHWAY_TEST_FOR_CARE_TASK_TYPE[taskType];
  }

  getPathway(taskType: CareTaskType) {
    return buildBlandPathway(PATHWAY_FOR_CARE_TASK_TYPE[taskType]);
  }

  // This overwrites the existing pathway data in bland, proceed with caution when on production
  async updatePathway(careTaskType: CareTaskType) {
    if (this.blandAPIKey == null) {
      throw new Error('BLAND_AI_API_KEY environment variable not set');
    }

    const pathwayID = getBlandPathwayID(careTaskType);

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
        body: JSON.stringify(this.getPathway(careTaskType)),
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

  async runSingleTestCase({
    testCase,
    pathwayID,
    questionID,
    correctRouteID,
  }: {
    testCase: string;
    pathwayID: string;
    questionID: string;
    correctRouteID: string;
  }) {
    const pathwayChat = await axios.post<{ data: { chat_id: string } }>(
      `${this.pathwayChatEndpoint}/create`,
      {
        pathway_id: pathwayID,
        start_node_id: questionID,
        // TODO vary this input data
        request_data: {
          patient_full_name: 'Jiahan Ericsson',
          plan_name: 'Humana',
          patient_dob: '01/01/1999',
        },
      },
      {
        headers: {
          authorization: this.blandAPIKey,
        },
      },
    );

    const chatID = pathwayChat.data.data.chat_id;

    // send one message
    const response = await axios.post<{
      data: {
        current_node_id: string;
        current_node_name: string;
        assistant_responses: string[];
      };
    }>(
      `${this.pathwayChatEndpoint}/${chatID}`,
      { message: testCase },
      {
        headers: {
          authorization: this.blandAPIKey,
        },
      },
    );

    const currentNodeID = response.data.data.current_node_id;

    if (currentNodeID === correctRouteID) {
      console.log(`Correct! - "${testCase}"`);
    } else {
      console.log(`:( wrong - "${testCase}"`);
      console.log(`Response: ${response.data.data.assistant_responses[0]}`);
    }

    return currentNodeID === correctRouteID;
  }

  async testQuestionRouting(careTaskType: CareTaskType) {
    if (this.blandAPIKey == null) {
      throw new Error('BLAND_AI_API_KEY environment variable not set');
    }

    const pathwayID = getBlandPathwayID(careTaskType);
    if (pathwayID == null) {
      throw new Error('Pathway ID not found');
    }

    const nodes = await this.getPathwayNodeIDsByName(careTaskType);

    const tests = this.getPathwayTests(careTaskType);
    if (tests == null) {
      throw new Error('Could not found any tests for ' + careTaskType);
    }

    const testPromises = [] as (() => Promise<number>)[];
    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      const questionID = nodes[test.question];
      const correctRouteID = nodes[test.correctRoute];

      // one at a time to not overload any servers
      testPromises.push(async () => {
        try {
          // create pathway chat
          const pathwayChat = await axios.post<{ data: { chat_id: string } }>(
            `${this.pathwayChatEndpoint}/create`,
            {
              pathway_id: pathwayID,
              start_node_id: questionID,
              // TODO vary this input data
              request_data: {
                patient_full_name: 'Jiahan Ericsson',
                plan_name: 'Humana',
                patient_dob: '01/01/1999',
              },
            },
            {
              headers: {
                authorization: this.blandAPIKey,
              },
            },
          );

          const chatID = pathwayChat.data.data.chat_id;

          // Get the first message from the chat
          const firstMessage = await axios.post<{
            data: { assistant_responses: string[] };
          }>(
            `${this.pathwayChatEndpoint}/${chatID}`,
            {},
            {
              headers: {
                authorization: this.blandAPIKey,
              },
            },
          );

          const testCases = await generateTestCases(
            firstMessage.data.data.assistant_responses[0],
            test.answer,
          );
          const runners = testCases.map(
            async (testCase) =>
              await this.runSingleTestCase({ testCase, pathwayID, questionID, correctRouteID }),
          );

          const successes = (await Promise.all(runners)).reduce((acc, v) => acc + (v ? 1 : 0), 0);
          return successes;
        } catch (error) {
          this.logger.error(`Failed to test question routing:`, {
            error: getErrorMessage(error),
          });
        }
        return 0;
      });
    }

    // now actually run the API queries for the tests
    const results = [] as QuestionRoutingCaseResult[];
    for (let i = 0; i < tests.length; i++) {
      console.log(`round ${i}: ${tests[i].question} - ${tests[i].answer}`);
      const successes = await testPromises[i]();

      results.push({
        successRate: successes / 10,
        ...tests[i],
      });
    }

    return results;
  }

  async getPathwayNodeIDsByName(careTaskType: CareTaskType) {
    if (this.blandAPIKey == null) {
      throw new Error('BLAND_AI_API_KEY environment variable not set');
    }

    const pathwayID = getBlandPathwayID(careTaskType);

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
