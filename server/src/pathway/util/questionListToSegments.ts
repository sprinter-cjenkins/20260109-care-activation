import { DefaultEndNode } from './Node';
import { Segment } from './Pathway';
import { Node } from './Node';
import Question from './Question';

export default function questionListToSegments(questions: Question[], moveOnNode: Node): Segment[] {
  let nodes: Segment[] = [];
  for (let i = 0; i < questions.length; i++) {
    let nextNode = questions[i + 1]?.firstNode;

    // if we've run out of questions, redirect to default end call
    if (nextNode == null) {
      nextNode = moveOnNode;
    }

    nodes = nodes.concat(questions[i].toSegments(nextNode));
  }

  nodes.push({ node: DefaultEndNode });

  return nodes;
}
