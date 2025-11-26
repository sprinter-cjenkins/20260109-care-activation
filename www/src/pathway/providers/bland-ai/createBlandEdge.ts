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
  label,
  description,
}: {
  source: BlandNode;
  target: BlandNode;
  label?: string;
  description?: string;
}): BlandEdge {
  return {
    id: v4(),
    data: {
      label: trimPromptWhitespace(label ?? ''),
      description: trimPromptWhitespace(description ?? ''),
      isHighlighted: false,
    },
    type: 'custom',
    source: source.id,
    target: target.id,
  };
}
