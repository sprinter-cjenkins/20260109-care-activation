import nullThrows from 'capital-t-null-throws';
import createSimpleRetryQuestions from '../util/createSimpleRetryQuestions';
import { DefaultEndNode } from '../util/Node';
import { Pathway } from '../util/Pathway';
import Question from '../util/Question';
import questionListToPathway from '../util/questionListToPathway';
import SimpleRetryQuestion from '../util/SimpleRetryQuestion';

export const globalPrompt = `
# Background
You are Sprinty, a Sprinter Health AI Care Navigator. Your role is to ask patients questions about scheduling a DEXA scan. We are collecting this information one step at a time so its important to not skip ahead and only focus on the current question that needs to be answered. If the question has already been answered, verify that the information is correct with the patient. It's essential to approach each conversation with empathy, recognizing that discussing health matters can be stressful for many individuals. Your goal is to make this process as smooth and straightforward as possible.

Patients may be anxious or unsure about what to expect from the DEXA scan. They might have questions or concerns that need to be addressed in a clear and compassionate manner. It's crucial to listen attentively to their needs and respond in a way that is both informative and reassuring.

If emergency language is used (example: severe pain, fall with injury), advise calling 911 or a clinician and end the call. Never provide medical advice or interpret results; you only gather info and preferences.

# Tone
Adopt a warm, yet direct tone. Speak clearly and at a moderate pace, avoiding jargon or complex medical terminology that might confuse patients. Focus on using short sentences and plain language to ensure clarity and understanding. Remember, the aim is to be helpful and supportive without being overly formal or verbose. In your interactions, prioritize being concise and to the point, while still conveying empathy and understanding for the patient's situation.
`;

export const voicemailMessage = `
Hi! This is Sprinty, calling on behalf of {{plan_name}} from Sprinter Health to help you schedule your DEXA scan. Please call us back at two zero nine, three seven zero, zero two zero nine. Thank you so much, and have a wonderful day!
`;

// TODO this might be able to be abstracted out a bit more.
const confirmName = new SimpleRetryQuestion({
  title: 'Confirm Name',
  prompt: `
    Introduce yourself, confirm you are speaking with the correct patient.
    ---
    SAY:
    "Hello, my name is Sprinty, your AI Care Navigator from Sprinter Health.
    I am calling on behalf of {{plan_name}} on a recorded line.
    May I please speak with {{patient_full_name}}?"
  `,
  allowIDontKnow: false,
});

const confirmWrongName = new SimpleRetryQuestion({
  title: 'Confirm wrong name',
  prompt: `
    The patient has said a name that doesn't match with {{patient_full_name}}. We need to verify that they are not {{patient_full_name}} or someone authorized to speak on behalf of {{patient_full_name}}.
    "To confirm, I am not speaking to {{patient_full_name}} or someone authorized to speak on their behalf?"
  `,
  allowIDontKnow: false,
});

confirmWrongName.addGiveUp({
  giveUpPrompt:
    'Apologize for not being able to connect with the correct patient, and politely hang up the call.',
  label: 'User was not patient',
  description: 'User was not the patient or an authorized user.',
});

confirmName.addFollowUp({
  label: 'Potentially the wrong person',
  description:
    'Follow this pathway if the patient has said their name is something other than {{patient_full_name}}',
  followUpQuestions: [confirmWrongName],
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

// only move forward if we match the date of birth correctly
nullThrows(confirmDOB.params.replyPaths.moveOn).description =
  'Choose this pathway only if the date the patient said matches closely to {{patient_dob}}.';

nullThrows(confirmDOB.params.replyPaths.retry).description =
  "Choose this pathway if the date the patient said doesn't match {{patient_dob}}. Also if the user asked a question, was confused, or otherwise didn't answer the question";

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
    If the user says they have had a DEXA scan before.
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

const fractures = new SimpleRetryQuestion({
  title: 'Fractures in last 6 months',
  allowIDontKnow: true,
  prompt: `
    "Have you had any fractures within the past 6 months?"
  `,
});

const height = new SimpleRetryQuestion({
  title: 'Height',
  allowIDontKnow: false,
  prompt: `
    "Now, a couple of quick health details. What is your current height?"
    For this question vague answers are okay.
    If the patient asks about limits, the usual limit is maximum six feet, but these numbers vary between centers so we have to verify and get back to them.
    Within a foot answers are fine for height, (for example: "five foot something", "five feet", "around five feet").
    Meters and centimeters are also fine, convert them to feet when thinking about them.
  `,
});

const weight = new SimpleRetryQuestion({
  title: 'Weight',
  allowIDontKnow: false,
  prompt: `
    "And what is your current weight?"
    For this question vague answers are okay.
    If the patient asks about limits, the usual limit is 350 pounds, but these numbers vary between centers so we have to verify and get back to them.
    Within 100 pounds is fine for weight, like 200 something pounds, Kilos are also fine, convert them to pounds when thinking about them.
  `,
});

const mobilityAssistance = new SimpleRetryQuestion({
  title: 'Mobility Assistance',
  allowIDontKnow: false,
  prompt: `
    "Do you use a walker, wheelchair, crutches, or cane?"
  `,
});

const metalInBody = new SimpleRetryQuestion({
  title: 'Mobility Assistance',
  allowIDontKnow: true,
  prompt: `
    "Do you have any metal in your body?"
  `,
});

metalInBody.addFollowUp({
  label: 'User does have metal in their body',
  description: `
    If the user says they do have metal in their body.
    Pick this option if it makes sense to ask follow-ups such as (What metal is in your body?)
  `,
  followUpQuestions: [
    new SimpleRetryQuestion({
      title: 'What Metal In Body',
      allowIDontKnow: true,
      prompt: '"What metal specifically do you have in your body?"',
    }),
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

centerNearYou.addFollowUp({
  label: 'User has a center preference',
  description: `
    If the user says they do have a prefered imaging center location.
    Pick this option if it makes sense to ask follow-ups such as (What is the name of that imaging center?)
  `,
  followUpQuestions: [
    new SimpleRetryQuestion({
      title: 'Which center',
      allowIDontKnow: true,
      prompt: '"What is the name or location of that center?"',
    }),
  ],
});

const schedulingPreference = new SimpleRetryQuestion({
  title: 'Scheduling Preference',
  allowIDontKnow: true,
  prompt: `
    "Are there specific days or times that usually work best for your appointment? For example, Monday mornings?"

    For the days/times try to get windows like "Tuesdays" instead of single options like "tomorrow". We want the availability to apply to at least a few windows.
    These are great examples of answers: "Saturdays and Sundays", "Monday and Wednesday afternoon", "Monday mornings", and "Thursday evenings".
    These are insufficient answers because there aren't enough options: "Tomorrow", "How about this Saturday at 9?".
  `,
});

// only continue when we have a window
nullThrows(schedulingPreference.params.replyPaths.moveOn).description = `
  Only take this pathway when we get windows like "Tuesdays" instead of single options like "tomorrow". We want the availability to apply to at least a few windows.
  These are great examples of answers: "Saturdays and Sundays", "Monday and Wednesday afternoon", "Monday mornings", and "Thursday evenings".
  These are insufficient answers because there aren't enough options: "Tomorrow", "How about this Saturday at 9?".
`;

const DEXA_SCAN_QUESTION_LIST: Question[] = [
  confirmName, // If their name is something else, follow up to doublecheck
  confirmDOB,
  hasHadPreviousDEXAScan, // and follow ups
  fractures,
  height,
  weight,
  mobilityAssistance,
  metalInBody, // if yes we ask what metal
  centerNearYou, // if yes we ask which center
  schedulingPreference,
];

export const DEXA_SCAN_PATHWAY: Pathway = questionListToPathway(
  DEXA_SCAN_QUESTION_LIST,
  DefaultEndNode,
);
