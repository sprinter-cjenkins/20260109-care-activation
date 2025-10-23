import { CareTaskType, PartnerOrganization, Patient } from '@prisma/client';

const DEV_DEXA_PATHWAY_ID = 'eb9825e6-c2aa-4382-a1cd-27c0fe6784a1';

export function getPathwayID(taskType: CareTaskType) {
  switch (taskType) {
    case CareTaskType.DEXA_SCAN:
      return process.env.NODE_ENV === 'production' ? null : DEV_DEXA_PATHWAY_ID;
    default:
      return null;
  }
}

export function getPartnerOrganizationName(partnerOrganization: PartnerOrganization) {
  switch (partnerOrganization) {
    case PartnerOrganization.HUMANA:
      return 'Humana';
    case PartnerOrganization.ELEVANCEHEALTH:
      return 'Elevance Health';
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
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }),
    plan_name: getPartnerOrganizationName(patient.partnerOrganization),
  };
}

export function getVoicemailMessage(patient: Patient, taskType: CareTaskType) {
  return `Hi, This is Sprinty from Sprinter Health calling on behalf of ${getPartnerOrganizationName(patient.partnerOrganization)} from Sprinter Health to help you schedule your ${getNameOfTask(taskType)}. Please call us back at two zero nine, three seven zero, zero two zero nine. Thank you so much, and have a wonderful day!`;
}

// 2k character limit
export function getSummaryPrompt(patient: Patient) {
  const requestData = buildRequestData(patient);
  return `

    Expected values for name and dob are ${requestData.patient_full_name} and ${requestData.patient_dob}.
      'en-US',
      {
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      },
    )}.

  Generate a JSON object summarizing this call:

    verifications: list objects for each verification attempt. Each object should include key (what was verified, e.g., "name", "dob"), result ("success" or "failure"), expected (from request), and received. Mark as success if eventually verified after multiple attempts.

    questions: list objects with key (original question asked) and value (patient’s answer). Include only questions you were prompted to ask.

    requested_opt_out: true if patient asked to opt out; otherwise false.

    other (optional): list objects for any additional info. Use keys failureReason, notes, sentiment if applicable; otherwise, add under other. Skip if call was voicemail.
    Example output:

    {
      "verifications": [
        {"key": "name", "result": "success", "expected": "John Doe", "received": "John Doe"},
        {"key": "dob", "result": "failure", "expected": "01/01/1990", "received": "06/05/1995"}
      ],
      "requested_opt_out": false,
      "questions": [
        {"key": "question1", "value": "answer1"}
      ],
      "other": [
        {"key": "failureReason", "value": "answer1"}
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
