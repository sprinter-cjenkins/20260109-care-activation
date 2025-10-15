import { CareTaskType, Patient } from '@prisma/client';

const DEXA_PATHWAY_ID = 'eb9825e6-c2aa-4382-a1cd-27c0fe6784a1';

export function getPathwayID(taskType: CareTaskType) {
  switch (taskType) {
    case CareTaskType.DEXA_SCAN:
      return DEXA_PATHWAY_ID;
    default:
      return null;
  }
}

export function getNameOfTask(taskType: CareTaskType) {
  switch (taskType) {
    case CareTaskType.DEXA_SCAN:
      return 'DEXA scan';
    default:
      return null;
  }
}

export function buildRequestData(patient: Patient) {
  return {
    patient_full_name: `${patient.givenName} ${patient.familyName}`,
    patient_dob: patient.birthDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }),
    plan_name: patient.partnerOrganization,
  };
}

export function getVoicemailMessage(patient: Patient, taskType: CareTaskType) {
  return `Hi, This is Sprinty from Sprinter Health calling on behalf of ${patient.partnerOrganization} from Sprinter Health to help you schedule your ${getNameOfTask(taskType)}. Please call us back at two zero nine, three seven zero, zero two zero nine. Thank you so much, and have a wonderful day!`;
}

export function getSummaryPrompt() {
  return `
    Give me the results of this call as a valid JSON object.
    The first key should be 'verifications', and it should be a list of objects where each object has what we tried to verify, 
    the result (success or failure), and the expected/received values. The first object will be for "name" and second for "dob".
    The first key should be 'questions' and it should be list of objects where each question 
    from the original list is a key and the answer is a value. 
    If you find any thing else that should be shared, capture it in a new top level 
    key called 'other'. Within other you should have a similar list of objects of keys and values. 
    If the key fits into any of these categories, use it. If not you can use other. 
    Categories would be failureReason, notes, and sentiment.

    You do not need to include other in the case of voicemail, since there was no interaction.

    If the patient explicitly asked to opt out, set the "requested_opt_out" key to true. If not, leave it as false.

    Sample object would be like:
    {
        verifications: [
            {
                key: 'name',
                result: 'success',
                expected: 'John Doe',
                received: 'John Doe'
            },
            {
                key: 'dob',
                result: 'failure',
                expected: '01/01/1990',
                received: '06/05/1995'
            }
        ],
        requested_opt_out: false,
        questions: [
        {
            key: 'question1',
            value: 'answer1'
        },
        {
            key: 'question2',
            value: 'answer2'
        }],
        other: [
        {
            key: 'failureReason',
            value: 'answer1'
        },
        {
            key: 'other',
            value: 'answer2'
        }
        ]
    }
    `;
}

export function cleanJsonString(str: string): string {
  if (!str) {
    return '';
  }
  // Remove triple backticks and optional "json" label
  return str.replace(/```(json)?/g, '').trim();
}
