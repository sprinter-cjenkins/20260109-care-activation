import { Node } from './Node';

export type Pathway = {
  node: Node;
  edges?: {
    target: Node;
    label?: string;
    description?: string;
  }[];
}[];
