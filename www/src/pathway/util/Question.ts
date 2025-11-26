import { Node } from './Node';
import { Pathway } from './Pathway';
import { v4 } from 'uuid';
import questionListToPathway from './questionListToPathway';

export type ReplyPaths = {
  moveOn?: {
    label: string;
    description: string;
  };
  retry?: {
    label: string;
    description: string;
    retries: number;
  };
  followUp?: {
    label: string;
    description: string;
    followUpQuestions: Question[];
  };
  giveUp?: {
    label: string;
    description: string;
    giveUpPrompt: string;
  };
};

export type QuestionParams = {
  title: string;
  prompt: string;
  replyPaths: ReplyPaths;
};

export default class Question {
  params: QuestionParams;
  firstNode: Node;
  id: string;

  constructor(params: QuestionParams) {
    this.id = v4();
    this.params = params;

    this.firstNode = {
      id: this.id,
      name: this.params.title,
      prompt: this.params.prompt,
      type: 'Default',
    };
  }

  addFollowUp(followUp: { followUpQuestions: Question[]; label: string; description: string }) {
    this.params.replyPaths.followUp = followUp;

    // If we have a moveOn path, change it to not conflict with the follow up path
    if (this.params.replyPaths.moveOn) {
      this.params.replyPaths.moveOn.description = `
        Choose this pathway if the user says no, they don't need any follow up questions or if they don't know, aren't sure, or don't want to answer the question.
        Examples: "I don't know", "No", "I have not", "I'm not sure", "I don't want to tell you that"
      `;
    }
  }

  addGiveUp(giveUp: { label: string; description: string; giveUpPrompt: string }) {
    this.params.replyPaths.giveUp = giveUp;
  }

  toPathway(moveOnNode: Node) {
    const { giveUp, followUp, retry } = this.params.replyPaths;

    const giveUpNode: Node = {
      id: v4(),
      name: `${this.params.title} give up`,
      prompt: giveUp?.giveUpPrompt,
      type: 'End Call',
    };

    const followUpPathway =
      followUp != null ? questionListToPathway(followUp.followUpQuestions, moveOnNode) : [];

    const retryPathway =
      retry != null
        ? this.createRetryPathway({
            moveOnNode,
            giveUpNode,
            followUpNode: followUpPathway[0]?.node,
          })
        : [];

    return [
      {
        node: this.firstNode,
        edges: this.createNodeEdges({
          moveOnNode,
          giveUpNode,
          followUpNode: followUpPathway[0]?.node,
          retryNode: retryPathway[0]?.node,
        }),
      },
      ...retryPathway,
      ...followUpPathway,
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
    retryNode,
    followUpNode,
    giveUpNode,
  }: {
    moveOnNode?: Node;
    retryNode?: Node;
    followUpNode?: Node;
    giveUpNode?: Node;
  }) {
    const { giveUp, moveOn, retry, followUp } = this.params.replyPaths;

    return [
      ...(giveUp != null && giveUpNode != null
        ? [
            {
              target: giveUpNode,
              description: giveUp.description,
              label: giveUp.label,
            },
          ]
        : []),
      ...(moveOn != null && moveOnNode != null
        ? [
            {
              target: moveOnNode,
              label: moveOn.label,
              description: moveOn.description,
            },
          ]
        : []),
      ...(retry != null && retryNode != null
        ? [
            {
              target: retryNode,
              label: retry.label,
              description: retry.description,
            },
          ]
        : []),
      ...(followUp != null && followUpNode != null
        ? [
            {
              target: followUpNode,
              label: followUp.label,
              description: followUp.description,
            },
          ]
        : []),
    ];
  }

  createRetryPathway({
    followUpNode,
    giveUpNode,
    moveOnNode,
  }: {
    followUpNode?: Node;
    giveUpNode?: Node;
    moveOnNode?: Node;
  }) {
    const retryNodes: Node[] = new Array(this.params.replyPaths.retry?.retries ?? 0)
      .fill(null)
      .map((_, i) => ({
        id: v4(),
        name: `${this.params.title} retry ${i}`,
        prompt: `
        The patient either answered ambiguously or asked a follow up question.
        If the question is relevent to the question listed below, answer then ask again.
        ${this.params.prompt}
      `,
        type: 'Default',
      }));

    const tooConfusedNode: Node = {
      id: v4(),
      name: "We're too confused, give up",
      type: 'Default',
      prompt: `
          # Background
          We tried to find the answer we were looking for but didn't succeed. At this point we want to give up for now and let someone else handle this call later once we figure out what went wrong.
  
          Apologize for not being able to finish the call and tell the patient that someone else will reach out to get the rest of the booking information.
  
          # Script
          Sorry, I'm having trouble figuring out how to proceed, someone else on the Sprinter Health team will reach out to you shortly to finish booking this appointment. Have a nice day!
        `,
    };

    const resultPathway: Pathway = [];
    for (let i = 0; i < retryNodes.length; i++) {
      let nextRetry = retryNodes[i + 1];
      if (nextRetry == null) {
        nextRetry = tooConfusedNode;
      }
      resultPathway.push({
        node: retryNodes[i],
        edges: this.createNodeEdges({ moveOnNode, followUpNode, giveUpNode, retryNode: nextRetry }),
      });
    }

    resultPathway.push({ node: tooConfusedNode });

    return resultPathway;
  }
}
