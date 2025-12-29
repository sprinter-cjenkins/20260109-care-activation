import { Node } from './Node';

export type Segment = {
  node: Node;
  edges?: {
    target: Node;
    label?: string;
    description?: string;
  }[];
};

export type Pathway = {
  globalPrompt: string;
  voicemailMessage: string;
  segments: Segment[];
};
