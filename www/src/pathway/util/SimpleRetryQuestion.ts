import Question from './Question';

export type SimpleRetryQuestionParams = {
  title: string;
  prompt: string;
  allowIDontKnow: boolean;
};

export default class SimpleRetryQuestion extends Question {
  constructor({ title, prompt, allowIDontKnow }: SimpleRetryQuestionParams) {
    super({
      title,
      prompt: `${prompt}\nDo not ask any other question as part of this prompt. "I don't know" is ${allowIDontKnow ? '' : 'not'} an acceptable answer.`,
      replyPaths: {
        moveOn: {
          label: 'Success',
          description: `User answered the question. "I don't know" is ${allowIDontKnow ? '' : 'not'} an acceptable answer.`,
        },
        retry: {
          label: 'User did not answer the question',
          description:
            "User asked a follow up question, was confused or otherwise didn't answer the question.",
          retries: 4,
        },
      },
    });
  }
}
