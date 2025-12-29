import { Node } from '../../util/Node';

export type PipecatNode = {
  id: string;
  name?: string;
  text?: string;
  prompt?: string;
};

export function createPipecatNode(node: Node): PipecatNode {
  return {
    id: node.id,
    name: node.name,
    text: node.text,
    prompt: node.prompt,
  };
}
