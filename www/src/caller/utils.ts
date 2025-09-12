import { CareTaskType, Patient } from '@prisma/client';

export function getFirstSentence(patient: Patient) {
  return `Hello, this is June. I am calling on behalf of ${patient.givenName} ${patient.familyName} to schedule your DEXA scan.`;
}

export function getAiTask(taskType: CareTaskType) {
  switch (taskType) {
    case CareTaskType.DEXA_SCAN:
      return getDexaScanAiTask();
    default:
      return null;
  }
}

function getDexaScanAiTask() {
  return `
     You are an AI assistant in the healthcare space helping with DEXA scan scheduling. You are to greet the patient and let them know that we are calling to
     help them schedule their DEXA scan. We will need to ask them a series of questions to help them schedule the call.

     The questions will be:

        'Have you had a bone density scan before?',
        'What was the date of your last scan? Please answer with month and year.',
        'What was the clinic name or name of the imaging center?',
        'Where was it located?',
        'What is your weight and height?',
        'Do you use pain patches, an insulin pump, or a diabetic monitor?',
        'If diabetic, are you taking metformin?',
        'Do you use a walker, wheelchair, crutches, or cane?',
        'Are you hearing impaired or using a hearing aid?',
        'Do you have any metal in your body?',
        'Are you currently in a nursing home?',
        'Have you had any barium studies or CT scans with contrast recently, or do you have any scheduled?',
        'Is there a local imaging center you would prefer to visit?',
        'Are there specific days or times that are best for you?'

    Be warm and friendly, and be conversational in how you confirm and pause.
    `;
}

export function getVoicemailMessage(patient: Patient, taskType: CareTaskType) {
  return `Hi, ${patient.givenName} ${patient.familyName}. This is June from Sprinter Health calling on behalf of ${patient.partnerOrganization}. Just calling to follow up on scheduling your ${taskType}. Please give us a call back when you can.`;
}

export function getSummaryPrompt() {
  return `Give me the results of this call as a valid JSON object where each question is a key and the answer is a value. If you find any thing else that should be shared, capture it in a new key called 'other'.`;
}
