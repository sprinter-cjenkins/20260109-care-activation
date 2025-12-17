import { ContactPoint, ContactPointSystem, HumanName, NameUse } from '@ca/prisma';
import { PatientPayload } from './patient.service';

export function getPatientHumanName(patient: PatientPayload): HumanName {
  // return just the usual name for now
  let nameToUse = patient.name.find((name: HumanName) => name.use === NameUse.USUAL);

  // if theres no usual name, just return the first name
  if (nameToUse == null) {
    nameToUse = patient.name[0];
  }

  // if the name is still null, give up
  if (nameToUse == null) {
    throw new Error('Patient has no names');
  }

  return nameToUse;
}

export function getPatientFullName(patient: PatientPayload) {
  const name = getPatientHumanName(patient);
  const givenNames = name.given as string[];
  return `${givenNames.join(' ')} ${name.family}`;
}

export function getPatientFamilyName(patient: PatientPayload) {
  const name = getPatientHumanName(patient);
  return name.family;
}

export function getPatientFirstName(patient: PatientPayload) {
  const name = getPatientHumanName(patient);
  const givenNames = name.given as string[];
  return givenNames[0];
}

export function getPatientPhoneNumber(patient: PatientPayload) {
  // get the phone number with the lowest rank
  const phone = patient.telecom
    .filter((telecom: ContactPoint) => telecom.system === ContactPointSystem.PHONE)
    .sort((a: ContactPoint, b: ContactPoint) => a.rank - b.rank)[0];

  if (phone == null) {
    throw new Error('Patient has no phone number');
  }
  return phone.value;
}
