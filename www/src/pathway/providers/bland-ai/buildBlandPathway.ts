import createBlandNode, { BlandNode } from './createBlandNode';
import createBlandEdge, { BlandEdge } from './createBlandEdge';
import { Node } from '../../util/Node';
import { Pathway } from '../../util/Pathway';
import nullThrows from 'capital-t-null-throws';
import { createVoicemailPathway } from '../../util/createVoicemailPathway';
import trimPromptWhitespace from '#src/pathway/util/trimPromptWhitespace';

// Position needs to be in this non-rendered object because bland hates you in particular
type BlandGlobalConfig = {
  globalConfig: {
    globalPrompt: string;
  };
  position: {
    x: number;
    y: number;
  };
};

type BlandPathway = { nodes: (BlandNode | BlandGlobalConfig)[]; edges: BlandEdge[] };

export default function buildBlandPathway({
  globalPrompt,
  voicemailMessage,
  pathway,
}: {
  globalPrompt: string;
  voicemailMessage: string;
  pathway: Pathway;
}): BlandPathway {
  const pathwayWithVoicemail = createVoicemailPathway(voicemailMessage, pathway[0].node).concat(
    pathway,
  );

  // ugh this is gonna have to be ugly to find all of the id references.., ick..
  const blandNodes: BlandNode[] = pathwayWithVoicemail.map(({ node }) => createBlandNode(node));

  let blandEdges: BlandEdge[] = [];

  // we need to preserve id's here so this is a lil funky
  for (const element of pathwayWithVoicemail) {
    const sourceBlandNode = findMatchingBlandNode(blandNodes, element.node);
    blandEdges = blandEdges.concat(
      element.edges?.map((edge) =>
        createBlandEdge({
          source: sourceBlandNode,
          target: findMatchingBlandNode(blandNodes, edge.target),
          label: edge.label,
          description: edge.description,
        }),
      ) ?? [],
    );
  }

  const globalConfig: BlandGlobalConfig = {
    globalConfig: {
      globalPrompt: trimPromptWhitespace(globalPrompt),
    },
    position: {
      x: 0,
      y: 0,
    },
  };

  return {
    nodes: [...blandNodes, globalConfig],
    edges: blandEdges,
  };
}

function findMatchingBlandNode(blandNodes: BlandNode[], node: Node) {
  return nullThrows(blandNodes.find((blandNode) => isBlandNodeCreatedFromNode(blandNode, node)));
}

function isBlandNodeCreatedFromNode(blandNode: BlandNode, node: Node) {
  return node.id === blandNode.id;
}
