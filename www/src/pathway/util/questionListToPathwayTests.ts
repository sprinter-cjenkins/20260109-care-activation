import { Node } from './Node';
import Question from './Question';
import { PathwayTest } from '../pathways';

export default function questionListToPathwayTests(
  questions: Question[],
  moveOnNode: Node,
): PathwayTest[] {
  let tests: PathwayTest[] = [];
  for (let i = 0; i < questions.length; i++) {
    let nextNode = questions[i + 1]?.firstNode;

    // if we've run out of questions, redirect to default end call
    if (nextNode == null) {
      nextNode = moveOnNode;
    }

    tests = tests.concat(questions[i].toPathwayTests(nextNode));
  }

  return tests;
}
