export type NodeType = 'Default' | 'End Call' | 'IVR';

export type Node = {
  id: string;
  name?: string;
  type: NodeType;
  text?: string;
  prompt?: string;
  condition?: string;
  isStart?: boolean;
};

export const DefaultEndNode: Node = {
  id: 'default-end-node',
  name: 'End Script',
  type: 'End Call',
  prompt: `
    "Thank you for speaking with Sprinty, your AI Care Navigator. We'll be in touch again to confirm your DEXA appointment details."
    Do not ask any additional questions. We have finished gathering information for this appointment.
  `,
  condition: `
    The condition is achieved once the final sentence of the script has been stated:
    "We'll be in touch again to confirm your DEXA appointment details."
  `,
};
