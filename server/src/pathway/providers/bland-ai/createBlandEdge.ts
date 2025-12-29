import { v4 } from 'uuid';
import { BlandNode } from './createBlandNode';
import trimPromptWhitespace from '#src/pathway/util/trimPromptWhitespace';

export type BlandEdge = {
  id: string;
  data: {
    label?: string;
    description: string;
    isHighlighted: boolean;
  };
  type: string;
  source: string;
  target: string;
};

export default function createBlandEdge({
  source,
  target,
  condition,
}: {
  source: BlandNode;
  target: BlandNode;
  condition?: string;
}): BlandEdge {
  return {
    id: v4(),
    data: {
      label: trimPromptWhitespace(condition ?? 'Continue'),
      description: '',
      isHighlighted: false,
    },
    type: 'custom',
    source: source.id,
    target: target.id,
  };
}
