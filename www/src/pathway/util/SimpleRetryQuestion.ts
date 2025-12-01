import Question from './Question';

export type SimpleRetryQuestionParams = {
  title: string;
  prompt: string;
  allowIDontKnow: boolean;
};

export default class SimpleRetryQuestion extends Question {
  constructor({ title, prompt, allowIDontKnow }: SimpleRetryQuestionParams) {
    const iDontKnowExamples = `
      Examples: "I don't know" "I'm not sure" "I don't want to tell you that"
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
          label: 'Success',
          description: `User answered the question. "I don't know" is ${allowIDontKnow ? '' : 'not'} an acceptable answer. ${allowIDontKnow ? iDontKnowExamples : ''}`,
        },
        retry: {
          label: 'User did not answer the question',
          description:
            "User asked a question, was confused, or otherwise didn't answer the question.",
          retries: 4,
        },
      },
    });
  }
}
