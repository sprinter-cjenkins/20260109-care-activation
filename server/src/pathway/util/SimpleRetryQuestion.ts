import Question from './Question';

export type SimpleRetryQuestionParams = {
  title: string;
  prompt: string;
  allowIDontKnow: boolean;
  yesOrNoQuestion?: boolean;
  moveOnCondition?: string;
  tests?: {
    moveOn?: string[];
    followUp?: string[];
    giveUp?: string[];
    retry?: string[];
  };
};

export default class SimpleRetryQuestion extends Question {
  constructor({
    title,
    prompt,
    allowIDontKnow,
    moveOnCondition,
    yesOrNoQuestion = false,
    tests,
  }: SimpleRetryQuestionParams) {
    const iDontKnowExamples = `
      Examples: "I don't know", "I'm not sure", "I don't want to tell you that", "I don't remember"
    `;
    super({
      title,
      prompt: `
        ${prompt}
        Do not ask any other question as part of your response. Your only goal is to get an answer to the question above. Don't say anything unrelated to answering that question.
        "I don't know" is ${allowIDontKnow ? '' : 'not'} an acceptable answer. ${allowIDontKnow ? iDontKnowExamples : ''}
      `,
      replyPaths: {
        moveOn: {
          condition:
            moveOnCondition ??
            `
            User answered the question. The answer could be anything that is not a follow up question, obviously off topic, or being confused about the question being asked.
            ${
              yesOrNoQuestion
                ? `
              Yes or no, or any other affirmative or negative response is also an acceptable answer.
              Examples: "Yeah", "Yes", "Nope", "Nah"
            `
                : ''
            }
            "I don't know" is ${allowIDontKnow ? '' : 'not'} an acceptable answer.
            ${allowIDontKnow ? iDontKnowExamples : ''}`,
        },
        retry: {
          condition:
            "The user did not answer the question. User asked their own question, was confused, or otherwise didn't answer the question.",
        },
      },
      tests,
    });
  }
}
