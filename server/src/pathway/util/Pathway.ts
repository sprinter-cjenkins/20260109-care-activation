import { Node } from './Node';

export type Segment = {
  node: Node;
  edges?: {
    target: Node;
    condition: string;
  }[];
};

export type Pathway = {
  globalPrompt: string;
  voicemailMessage: string;
  segments: Segment[];
};
