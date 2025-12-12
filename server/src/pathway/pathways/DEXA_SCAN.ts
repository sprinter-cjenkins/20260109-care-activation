import nullThrows from 'capital-t-null-throws';
import createSimpleRetryQuestions from '../util/createSimpleRetryQuestions';
import { DefaultEndNode } from '../util/Node';
import { Pathway } from '../util/Pathway';
import Question from '../util/Question';
import questionListToPathway from '../util/questionListToPathway';
import SimpleRetryQuestion from '../util/SimpleRetryQuestion';
import { PathwayTest } from '.';
import questionListToPathwayTests from '../util/questionListToPathwayTests';

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
  tests: {
    moveOn: [
      'Yes, this is her.',
      'Speaking',
      'Confirmed.',
      'This is Jahan',
      'You do have the correct person',
    ],
    retry: ['Who are you?', 'Why?'],
    followUp: ['No, this is Patrick.'],
  },
});

const confirmWrongName = new SimpleRetryQuestion({
  title: 'Confirm wrong name',
  prompt: `
    The patient has said a name that doesn't match with {{patient_full_name}}. We need to verify that they are not {{patient_full_name}} or someone authorized to speak on behalf of {{patient_full_name}}.
    "To confirm, I am not speaking to {{patient_full_name}} or someone authorized to speak on their behalf?"
  `,
  allowIDontKnow: false,
  tests: {
    moveOn: [
      'No you have the correct person.',
      'This is Jiahan speaking',
      'Yes I can speak on behalf of Jiahan',
    ],
    giveUp: ['Yeah no this is Jim', 'You have the wrong number', 'Yes'],
  },
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
    'Follow this pathway if the patient has said their name is something completely different than {{patient_full_name}}. Do not take this pathway if the name is close or could easily be misheard as {{patient_full_name}}',
  followUpQuestions: [confirmWrongName],
});

// rewrite this because followup needs to be reconfigured
nullThrows(confirmName.params.replyPaths.moveOn).description = `
  Take this pathway if the patient has agreed that they are {{patient_full_name}} or otherwise confirmed in any way. The name doesn't have to be an exact match for {{patient_full_name}}. As long as the name they said has similar letters, is close to, or sounds like {{patient_full_name}}. Also its fine if the name they said is close to only part of {{patient_full_name}}. The patient might only be saying their first name, and we might be hearing it wrong, so be very lenient.
  Examples: "Speaking." "This is her" "This is [name]"
`;

const confirmDOB = new SimpleRetryQuestion({
  title: 'Confirm DOB',
  allowIDontKnow: false,
  prompt: `
      "Thank you for confirming. Please verify your date of birth."
    - Match closely to {{patient_dob}}. Only mark as failure if it clearly does not match.
    - Never give the date of birth; the patient must say it.
    - If it makes sense to ask if the date they said is correct, assume it is. If the date they have said doesn't match closely to {{patient_dob}}, say sorry and ask them to verify their date of birth again.
  `,
  tests: {
    moveOn: [
      'Zero one zero one nineteen ninety nine.',
      'Jan one ninety nine.',
      'January first, ninety nine.',
      'one one nineteen ninety nine.',
      'The first of January nineteen ninety nine',
    ],
    retry: [
      'January first',
      'Why?',
      'February tenth nineteen ninety nine',
      'January first nineteen seventy',
    ],
  },
});

// only move forward if we match the date of birth correctly
nullThrows(confirmDOB.params.replyPaths.moveOn).description =
  `Choose this pathway if the date the patient said matches the day, month, and year oh "{{patient_dob}}".
  Do not pick this pathway if the year is completely different or if the day or month is completely different.
`;

nullThrows(confirmDOB.params.replyPaths.retry).description = `
  Choose this pathway if the day, month, or year the patient said is different to the date "{{patient_dob}}".
  If the date they said doesn't sound similar to "{{patient_dob}}.
  Also if the user asked a question, was confused, or otherwise didn't answer the question.
`;

const hasHadPreviousDEXAScan = new SimpleRetryQuestion({
  title: 'Previous DEXA Scan',
  allowIDontKnow: true,
  prompt: `
    Say that we will need to ask a few questions to schedule their DEXA scan. Start with
    "Have you ever had a bone density scan, sometimes called a 'DEXA' scan, before?"
  `,
  tests: {
    moveOn: ['No.', "No, I haven't had a DEXA Scan before"],
    retry: ["What's a DEXA scan?", 'Why do you need to know that'],
    followUp: ['Yes I have', 'Yes, I had one a few years ago'],
  },
});

hasHadPreviousDEXAScan.addFollowUp({
  label: 'User has had previous DEXA scan',
  description: `
    If the user says they have had a DEXA scan before.
    Pick this option if it makes sense to ask follow-ups such as (when was it, where was it, etc).
  `,
  followUpQuestions: createSimpleRetryQuestions({
    title: 'Previous DEXA Scan followup',
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
  yesOrNoQuestion: true,
  prompt: `
    "Have you had any fractures within the past 6 months?"
  `,
  tests: {
    moveOn: ['Yeah', 'Nope', "I don't remember", "I don't want to tell you that"],
    retry: ['Why are you asking me this?'],
  },
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
  tests: {
    moveOn: ['Five foot something', 'Five ten', 'Around five feet'],
    retry: [
      "I don't know",
      "I don't want to tell you that",
      'Why do you need to know?',
      'Pretty tall.',
    ],
  },
});

const weight = new SimpleRetryQuestion({
  title: 'Weight',
  allowIDontKnow: false,
  prompt: `
    "And what is your current weight?"
    For this question vague answers are okay.
    If the patient asks about limits, the usual limit is 350 pounds, but these numbers vary between centers so we have to verify and get back to them.
    Within one hundred pounds is fine for weight, like one hundred something pounds, Kilos are also fine, convert them to pounds when thinking about them.
  `,
  tests: {
    moveOn: ['One fifty', 'Fourty kilos', 'One hundred something'],
    retry: [
      "I don't know",
      "I don't want to tell you that",
      'Why do you need to know?',
      "It's fine don't worry about it.",
    ],
  },
});

const mobilityAssistance = new SimpleRetryQuestion({
  title: 'Mobility Assistance',
  allowIDontKnow: false,
  yesOrNoQuestion: true,
  prompt: `
    "Do you use a walker, wheelchair, crutches, or cane?"
  `,
  tests: {
    moveOn: ['Yeah', 'Nope', "Sometimes, but I don't need to", 'A walker'],
    retry: ['Why?', 'Why are you asking me this?', "I don't want to tell you that"],
  },
});

const metalInBody = new SimpleRetryQuestion({
  title: 'Metal In Body',
  allowIDontKnow: true,
  prompt: `
    "Do you have any metal in your body?"
  `,
  tests: {
    moveOn: ['Nope', "I don't remember", "I don't want to tell you that"],
    retry: ['Why are you asking me this?'],
    followUp: ['I do have metal in my body', 'Yeah'],
  },
});

metalInBody.addFollowUp({
  label: 'User does have metal in their body',
  description: `
    If the user says they do have metal in their body, if they answered yes.
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
  yesOrNoQuestion: true,
  prompt: `
    Now collect this information for us to schedule the call. Remember you can't actually schedule the call, we are just collecting information.
    "Finally, I will collect some information that I will use to schedule the scan on your behalf."
    Then you will need to ask this question:
    "Is there a local imaging center you would prefer to visit for your scan?"
  `,
  tests: {
    moveOn: ['Can you find one for me?', 'No.', "I don't know", 'Where are the centers near me?'],
    retry: ['Why are you asking me this?'],
    followUp: [
      'Yes',
      'Sunset Imaging is right down the street from me',
      "There's one I like down the street but I don't remember the name",
    ],
  },
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

// add some guidance to move on questions like "Can you do it?"
nullThrows(centerNearYou.params.replyPaths.moveOn).description += `
  Choose this pathway if the patient asks you for an opinion on what center to pick or asks a question about centers nearby.
  Examples: "What centers are near me?" "Can you find one for me?"
`;

const schedulingPreference = new SimpleRetryQuestion({
  title: 'Scheduling Preference',
  allowIDontKnow: true,
  prompt: `
    "Are there specific days or times that usually work best for your appointment? For example, Monday mornings?"

    For the days/times try to get windows like "Tuesdays" instead of single options like "tomorrow". We want the availability to apply to at least a few windows.
    These are great examples of answers: "Saturdays and Sundays", "Monday and Wednesday afternoon", "Monday mornings", and "Thursday evenings".
    These are insufficient answers because there aren't enough options: "Tomorrow", "How about this Saturday at 9?".
  `,
  tests: {
    moveOn: [
      "I don't know",
      "I don't know my schedule can I tell you later?",
      "Monday's are perfect for me",
      'Tuesday afternoon',
      'Mornings',
    ],
    retry: [
      'Why are you asking me this?',
      'Tomorrow works.',
      'Next Wednesday in the morning is perfect',
    ],
  },
});

// only continue when we have a window
nullThrows(schedulingPreference.params.replyPaths.moveOn).description = `
  Only take this pathway when we get windows like "Tuesdays" instead of single options like "tomorrow" or "next Tuesday". We want the availability to apply to at least a few windows.
  These are great examples of answers: "Saturdays and Sundays", "Monday and Wednesday afternoon", "Monday mornings", and "Thursday evenings".
  These are insufficient answers because there aren't enough options: "Tomorrow", "How about this Saturday at 9?".
  I don't know is an acceptable answer.
  Examples: "I don't know", "I'm not sure", "I don't want to tell you that", "I don't remember"
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

export const DEXA_SCAN_PATHWAY_TESTS: PathwayTest[] = questionListToPathwayTests(
  DEXA_SCAN_QUESTION_LIST,
  DefaultEndNode,
);
