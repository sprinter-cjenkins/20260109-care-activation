import createSimpleRetryQuestions from '../util/createSimpleRetryQuestions';
import { DefaultEndNode } from '../util/Node';
import { Pathway } from '../util/Pathway';
import Question from '../util/Question';
import questionListToPathway from '../util/questionListToPathway';
import SimpleRetryQuestion from '../util/SimpleRetryQuestion';

export const globalPrompt = `
# Background
As a sprinter health care navigator, your role is to guide patients through scheduling a dexa scan. this process involves collecting necessary information and understanding patient preferences. it's essential to approach each conversation with empathy, recognizing that discussing health matters can be stressful for many individuals. your goal is to make this process as smooth and straightforward as possible.

Patients may be anxious or unsure about what to expect from the dexa scan. they might have questions or concerns that need to be addressed in a clear and compassionate manner. it's crucial to listen attentively to their needs and respond in a way that is both informative and reassuring.

If emergency language is used (e.g., severe pain, fall with injury), advise calling 911 or a clinician and end the intake. Never provide medical advice or interpret results; you only gather info and preferences.

# Tone
Adopt a warm, yet direct tone. speak clearly and at a moderate pace, avoiding jargon or complex medical terminology that might confuse patients. focus on using short sentences and plain language to ensure clarity and understanding. remember, the aim is to be helpful and supportive without being overly formal or verbose. in your interactions, prioritize being concise and to the point, while still conveying empathy and understanding for the patient's situation.
`;

export const voicemailMessage = `
Hi! This is Sprinty, calling on behalf of {{plan_name}} from Sprinter Health to help you schedule your DEXA scan. Please call us back at two zero nine, three seven zero, zero two zero nine. Thank you so much, and have a wonderful day!
`;

// TODO this might be able to be abstracted out a bit more.
const confirmName = new SimpleRetryQuestion({
  title: 'Confirm Name',
  prompt: `
    You are Sprinty, the AI Care Navigator for Sprinter Health.
    Your role is to assist the patient in scheduling a DEXA scan and gather information safely and accurately.
    This is a recorded call. You must follow all instructions carefully.
    GOAL:
    Introduce yourself, confirm you are speaking with the correct patient.
    ---
    SAY:
    "Hello, my name is Sprinty, your AI Care Navigator from Sprinter Health.
    I am calling on behalf of {{plan_name}} on a recorded line.
    May I please speak with {{patient_full_name}}?"
  `,
  allowIDontKnow: false,
});

confirmName.addGiveUp({
  giveUpPrompt:
    'Apologize for not being able to connect with the correct patient, and politely hang up the call.',
  label: 'User was not patient',
  description: 'User was not the patient or an authorized user.',
});

const confirmDOB = new SimpleRetryQuestion({
  title: 'Confirm DOB',
  allowIDontKnow: false,
  prompt: `
      "Thank you for confirming. Please verify your date of birth."
    - Match closely to {{patient_dob}}. Only mark as failure if it clearly does not match.
    - Never give the date of birth; the patient must say it.
  `,
});

const heightAndWeight = new SimpleRetryQuestion({
  title: 'Height and Weight',
  allowIDontKnow: false,
  prompt: `
    "Now, a couple of quick health details. What is your current height and weight?"
  `,
});

const hasHadPreviousDEXAScan = new SimpleRetryQuestion({
  title: 'Previous DEXA Scan',
  allowIDontKnow: true,
  prompt: `
    Say that we will need to ask a few questions to schedule their DEXA scan. Start with
    "Have you ever had a bone density scan, sometimes called a 'DEXA' scan, before?"
  `,
});

hasHadPreviousDEXAScan.addFollowUp({
  label: 'User has had previous DEXA scan',
  description: `
    If the user says they have had a dexa scan before.
    Pick this option if it makes sense to ask follow-ups such as (when was it, where was it, etc).
  `,
  followUpQuestions: createSimpleRetryQuestions({
    title: 'Previous DEXA Scan',
    allowIDontKnow: true,
    questions: [
      'What month and year was it?',
      'What was the name of the clinic or imaging center?',
      'Where was that clinic located?',
    ],
  }),
});

const devicesAndConditions = createSimpleRetryQuestions({
  title: 'Devices and Conditions',
  allowIDontKnow: true,
  questions: [
    'Do you use a walker, wheelchair, crutches, or cane?',
    'Do you have any metal in your body?',
    'Are you currently living in a nursing home?',
  ],
});

const centerNearYou = new SimpleRetryQuestion({
  title: 'Center Near You',
  allowIDontKnow: true,
  prompt: `
    Now collect this information for us to schedule the call. Remember you can't actually schedule the call, we are just collecting information.
    "Finally, I will collect some information that I will use to schedule the scan on your behalf."
    Then you will need to ask this question:
    "Is there a local imaging center you would prefer to visit for your scan?"
  `,
});

const schedulingPreference = new SimpleRetryQuestion({
  title: 'Scheduling Preference',
  allowIDontKnow: false,
  prompt: `
    "Are there specific days or times that usually work best for your appointment? For example, Monday mornings?"

    For the days/times try to get "windows" like "Tuesdays" instead of single options like "tomorrow". We want the availability to apply to at least a few windows.
    These are great examples of answers: "Saturdays and Sundays", "Monday and Wednesday afternoon", "Monday mornings", and "Thursday evenings".
    These are insufficient answers because there aren't enough options: "Tomorrow", "how about this Saturday at 9?".
  `,
});

const DEXA_SCAN_QUESTION_LIST: Question[] = [
  confirmName,
  confirmDOB,
  hasHadPreviousDEXAScan,
  heightAndWeight,
  ...devicesAndConditions,
  centerNearYou,
  schedulingPreference,
];

export const DEXA_SCAN_PATHWAY: Pathway = questionListToPathway(
  DEXA_SCAN_QUESTION_LIST,
  DefaultEndNode,
);
