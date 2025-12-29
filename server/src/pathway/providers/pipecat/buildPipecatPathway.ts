import { Pathway } from '#src/pathway/util/Pathway';
import { createPipecatNode, PipecatNode } from './createPipecatNode';

// just switch out the direct node reference for the ID reference so its portable
// also underscores because its going to python
export type PipecatPathway = {
  global_prompt: string;
  voicemail_message: string;
  segments: {
    node: PipecatNode;
    edges: {
      target_id: string;
      prompt: string;
    }[];
  }[];
};

export default function buildPipecatPathway(pathway: Pathway): PipecatPathway {
  const pipecatNodes: PipecatNode[] = pathway.segments.map(({ node }) => createPipecatNode(node));

  return {
    global_prompt: pathway.globalPrompt,
    voicemail_message: pathway.voicemailMessage,
    segments: pathway.segments.map((base, i) => ({
      node: pipecatNodes[i],
      edges:
        base.edges?.map((edge) => ({
          target_id: edge.target.id,
          prompt: edge.description ?? edge.label ?? 'Continue',
        })) ?? [],
    })),
  };
}
