import { Node } from '../../util/Node';

export type BlandNode = {
  id: string;
  data: {
    name: string;
    prompt?: string;
    text?: string;
    isStart?: boolean;
    condition?: string;
    modelOptions: {
      newTemperature: number;
      isSMSReturnNode: boolean;
      skipUserResponse: boolean;
      disableEndCallTool: boolean;
      disableSilenceRepeat: boolean;
    };
  };
  type: string;
  position: {
    x: number;
    y: number;
  };
};

let currentXPosition = 0;
let currentYPosition = 0;
const X_POSITION_STEP = 450;
const Y_POSITION_STEP = 200;
const X_POSITION_WRAP = 2999;

export default function createBlandNode(node: Node): BlandNode {
  currentXPosition += X_POSITION_STEP;
  if (currentXPosition > X_POSITION_WRAP) {
    currentXPosition = 0;
    currentYPosition += Y_POSITION_STEP;
  }

  const { name, type, text, prompt, condition, isStart } = node;
  return {
    id: node.id,
    data: {
      name: name ?? 'New Default Node',
      prompt,
      text,
      isStart,
      condition,
      modelOptions: {
        newTemperature: 0.2,
        isSMSReturnNode: false,
        skipUserResponse: false,
        disableEndCallTool: false,
        disableSilenceRepeat: false,
      },
    },
    type,
    // TODO: should we care about this?
    position: {
      x: currentXPosition,
      y: currentYPosition,
    },
  };
}
