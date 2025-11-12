import { PatientPayload } from '#patient/patient.service';
import { getPatientFullName } from '#patient/utils';
import { CareTaskType, PartnerOrganization } from '@prisma/client';

const PRODUCTION_DEXA_PATHWAY_ID = 'b529e181-4184-47fd-b2a8-e4bab2dcdeb9';
const DEVELOPMENT_DEXA_PATHWAY_ID = '01a835e9-9ede-4919-a33f-43673fc95493';

const PRODUCTION_DEXA_SCAN_CITATION_SCHEMA_ID = '43b8e88f-1f57-4a81-b171-949802c40a44';
const DEVELOPMENT_DEXA_SCAN_CITATION_SCHEMA_ID = '0fa9fc67-97ff-4e4a-911e-42e3ba5c56ca';

export function getPathwayID(careTaskType: CareTaskType) {
  switch (careTaskType) {
    case CareTaskType.DEXA_SCAN:
      return process.env.NODE_ENV === 'development'
        ? DEVELOPMENT_DEXA_PATHWAY_ID
        : PRODUCTION_DEXA_PATHWAY_ID;
    default:
      return null;
  }
}

export function getCitationSchemaID(careTaskType: CareTaskType) {
  switch (careTaskType) {
    case CareTaskType.DEXA_SCAN:
      return process.env.NODE_ENV === 'development'
        ? DEVELOPMENT_DEXA_SCAN_CITATION_SCHEMA_ID
        : PRODUCTION_DEXA_SCAN_CITATION_SCHEMA_ID;
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

export function getNameOfTask(careTaskType: CareTaskType) {
  switch (careTaskType) {
    case CareTaskType.DEXA_SCAN:
      return 'DEXA scan';
    default:
      return null;
  }
}

export function buildRequestData(patient: PatientPayload) {
  const patientFullName = getPatientFullName(patient);
  return {
    patient_full_name: patientFullName,
    patient_dob: patient.birthDate.toLocaleDateString('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }),
    plan_name: getPartnerOrganizationName(patient.partnerOrganization),
  };
}

export function getVoicemailMessage(patient: PatientPayload, careTaskType: CareTaskType) {
  return `Hi, This is Sprinty calling on behalf of ${getPartnerOrganizationName(patient.partnerOrganization)} from Sprinter Health to help you schedule your ${getNameOfTask(careTaskType)}. Please call us back at two zero nine, three seven zero, zero two zero nine. Thank you so much, and have a wonderful day!`;
}

// 2k character limit
export function getSummaryPrompt(patient: PatientPayload) {
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
