import { Node } from './Node';
import { Segment } from './Pathway';
import { v4 } from 'uuid';
import questionListToSegments from './questionListToSegments';
import { PathwayTest } from '../pathways';

export type ReplyPaths = {
  moveOn?: {
    condition: string;
  };
  retry?: {
    condition: string;
  };
  followUp?: {
    condition: string;
    followUpQuestions: Question[];
  };
  giveUp?: {
    condition: string;
    nodePrompt: string;
  };
};

export type QuestionParams = {
  title: string;
  prompt: string;
  condition?: string;
  replyPaths: ReplyPaths;
  tests?: {
    moveOn?: string[];
    followUp?: string[];
    giveUp?: string[];
    retry?: string[];
  };
};

export default class Question {
  params: QuestionParams;
  firstNode: Node;
  id: string;

  constructor(params: QuestionParams) {
    this.id = v4();
    this.params = params;

    const condition = this.params.condition?.trim();

    this.firstNode = {
      id: this.id,
      name: this.params.title,
      prompt: this.params.prompt,
      condition: this.params.condition != null ? condition : undefined,
      type: 'Default',
    };
  }

  addFollowUp(followUp: { followUpQuestions: Question[]; condition: string }) {
    this.params.replyPaths.followUp = followUp;

    // If we have a moveOn path, change it to not conflict with the follow up path
    if (this.params.replyPaths.moveOn) {
      this.params.replyPaths.moveOn.condition = `
        The user says no to the question being asked. Also if they don't know, aren't sure, or don't want to answer the question.
        Examples: "I don't know", "No", "I have not", "I'm not sure", "I don't want to tell you that"
      `;
    }
  }

  addGiveUp(giveUp: { condition: string; nodePrompt: string }) {
    this.params.replyPaths.giveUp = giveUp;
  }

  toSegments(moveOnNode: Node): Segment[] {
    const { giveUp, followUp } = this.params.replyPaths;

    const giveUpNode: Node = {
      id: v4(),
      name: `${this.params.title} give up`,
      prompt: giveUp?.nodePrompt,
      type: 'End Call',
    };

    const followUpSegments =
      followUp != null ? questionListToSegments(followUp.followUpQuestions, moveOnNode) : [];

    return [
      {
        node: this.firstNode,
        edges: this.createNodeEdges({
          moveOnNode,
          giveUpNode,
          followUpNode: followUpSegments[0]?.node,
        }),
      },
      ...followUpSegments,
      ...(giveUp != null
        ? [
            {
              node: giveUpNode,
            },
          ]
        : []),
    ];
  }

  createNodeEdges({
    moveOnNode,
    followUpNode,
    giveUpNode,
  }: {
    moveOnNode?: Node;
    followUpNode?: Node;
    giveUpNode?: Node;
  }) {
    const { giveUp, moveOn, retry, followUp } = this.params.replyPaths;

    return [
      ...(giveUp != null && giveUpNode != null
        ? [
            {
              target: giveUpNode,
              condition: giveUp.condition,
            },
          ]
        : []),
      ...(moveOn != null && moveOnNode != null
        ? [
            {
              target: moveOnNode,
              condition: moveOn.condition,
            },
          ]
        : []),
      ...(followUp != null && followUpNode != null
        ? [
            {
              target: followUpNode,
              condition: followUp.condition,
            },
          ]
        : []),
      ...(retry != null
        ? [
            {
              target: this.firstNode,
              condition: retry.condition,
            },
          ]
        : []),
    ];
  }

  toPathwayTests(moveOnNode: Node): PathwayTest[] {
    if (this.params.tests == null) return [];
    const { moveOn, followUp, giveUp, retry } = this.params.tests;

    const nodeName = this.params.title;
    const giveUpNodeName = `${nodeName} give up`;
    const moveOnNodeName = moveOnNode.name ?? '';
    const followUpNodeName =
      this.params.replyPaths.followUp?.followUpQuestions[0].params.title ?? '';
    const retryNodeName = nodeName;

    return [
      {
        question: nodeName,
        correctRoutes: [
          ...(giveUp != null
            ? [
                {
                  correctRoute: giveUpNodeName,
                  answers: giveUp,
                },
              ]
            : []),
          ...(moveOn != null
            ? [
                {
                  correctRoute: moveOnNodeName,
                  answers: moveOn,
                },
              ]
            : []),
          ...(followUp != null
            ? [
                {
                  correctRoute: followUpNodeName,
                  answers: followUp,
                },
              ]
            : []),
          ...(retry != null
            ? [
                {
                  correctRoute: retryNodeName,
                  answers: retry,
                },
              ]
            : []),
        ],
      },
    ];
  }
}
