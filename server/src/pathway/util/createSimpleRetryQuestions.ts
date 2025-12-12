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
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    result.push(
      new SimpleRetryQuestion({
        allowIDontKnow,
        title: `${title} ${i}`,
        prompt: `Ask the following question: "${question}"`,
      }),
    );
  }
  return result;
}
