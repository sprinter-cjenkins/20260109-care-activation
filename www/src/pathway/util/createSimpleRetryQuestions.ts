import Question from './Question';
import SimpleRetryQuestion from './SimpleRetryQuestion';

export default function createSimpleRetryQuestions({
  title,
  questions,
  allowIDontKnow,
}: {
  title: string;
  questions: string[];
  allowIDontKnow: boolean;
}): Question[] {
  const result: Question[] = [];
  for (const question of questions) {
    result.push(
      new SimpleRetryQuestion({
        allowIDontKnow,
        title,
        prompt: `Ask the following question: "${question}"`,
      }),
    );
  }
  return result;
}
