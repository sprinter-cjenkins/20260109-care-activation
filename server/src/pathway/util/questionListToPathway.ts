import { DefaultEndNode } from './Node';
import { Pathway } from './Pathway';
import { Node } from './Node';
import Question from './Question';

export default function questionListToPathway(questions: Question[], moveOnNode: Node): Pathway {
  let pathway: Pathway = [];
  for (let i = 0; i < questions.length; i++) {
    let nextNode = questions[i + 1]?.firstNode;

    // if we've run out of questions, redirect to default end call
    if (nextNode == null) {
      nextNode = moveOnNode;
    }

    pathway = pathway.concat(questions[i].toPathway(nextNode));
  }

  pathway.push({ node: DefaultEndNode });

  return pathway;
}
