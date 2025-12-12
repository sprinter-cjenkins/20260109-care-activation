import { Node } from './Node';
import { Pathway } from './Pathway';

export function createVoicemailPathway(message: string, userRespondedNode: Node): Pathway {
  const voicemailDetectedPathwayDescription = `
    Take this path only if you reach a voicemail system where you are prompted to leave a recorded message after a beep or tone. you will know if you have reached a voicemail box if you see messages like: "Please leave a message after the tone", "Start your message now", "Record your message after the beep", "leave a message", "not available", "can't come to the phone", "away from the phone", at the tone", "leave your name and number", "we'll get back to you as soon as possible", "I'm sorry I missed your call", "Two six two... is not available", "you have reached seven six three four five four, three seven eight two", etc
  `;

  const startNode: Node = {
    id: 'start-node',
    name: 'Start Node',
    isStart: true,
    type: 'IVR',
    prompt: `
      Listen for automated prompts, follow the instructions and wait for a live user to pick up the phone, avoid conversations, prepare for closure messages and alternative options, do not terminate call unless explicitly instructed or all options exhausted. Do not hang up the phone if there is silence, you should never be the one to end the call. Never end the call when you are waiting for an agent or human. Do not request a callback. If there is silence for 2 seconds you may start speaking.
      You do not have the ability to press buttons or select options while listening for automated prompts. The only action you can take at this step is to wait. Never attempt to press a button.
      # Examples
      To use your wait tool respond with the following
      Assistant: [uses wait tool]
      DO NOT LEAVE A VOICEMAIL IF PROMPTED. THIS WILL HAPPEN AT A LATER STEP
    `,
    condition: `
      Condition is achieved when ANY of the following is true:
      1) A real human picks up and makes ANY verbal response. Any utterance, word, phrase, question, etc from a human means the condition is achieved, even something extremely simple is given ("hello?", "who is this", "hi", etc.). Any response by a human achieves the condition.  
      2) If you reached a voicemail box. You will know if you have reached a voicemail box if you see messages like: 'leave a message,' 'after the beep,' 'mailbox,' or 'we'll return your call.'
      3) You have waited at least 2 seconds and have not heard anything.
    `,
  };

  const forceInterruptNode: Node = {
    id: 'force-interupt-node',
    name: 'Force Interrupt',
    type: 'Default',
    prompt: '<|0.1|>',
  };

  const customizedVoicemailNode: Node = {
    id: 'leave-voicemail-node',
    name: 'Leave Voicemail',
    type: 'Default',
    text: message,
    condition:
      'If you are interrupted and the full message is not left, you must repeat the entire message again before progressing. When you arrive at this node use your wait tool until the user is done speaking, then you can leave the message.\n\n\nThe condition is achieved once the final sentence of the voicemail message has been left:\n"Have a wonderful day!"',
  };

  const abruptEndCallNode: Node = {
    id: 'abrupt-end-call-node',
    name: 'End Call',
    type: 'End Call',
    prompt: '<|0.1|>',
  };

  return [
    {
      node: startNode,
      edges: [
        {
          label: 'Voicemail Detected',
          description: voicemailDetectedPathwayDescription,
          target: forceInterruptNode,
        },
        {
          label: 'User responded',
          description:
            'take this pathway if you reached a live user on the line or have waited at least 2 seconds',
          target: userRespondedNode,
        },
      ],
    },
    {
      node: forceInterruptNode,
      edges: [
        {
          label: 'Continue',
          target: customizedVoicemailNode,
        },
      ],
    },
    {
      node: customizedVoicemailNode,
      edges: [
        {
          label: 'Continue',
          target: abruptEndCallNode,
        },
      ],
    },
    {
      node: abruptEndCallNode,
    },
  ];
}
