import nullThrows from 'capital-t-null-throws';
import createSimpleRetryQuestions from '../util/createSimpleRetryQuestions';
import { DefaultEndNode } from '../util/Node';
import { Pathway } from '../util/Pathway';
import Question from '../util/Question';
import SimpleRetryQuestion from '../util/SimpleRetryQuestion';
import { PathwayTest } from '.';
import questionListToPathwayTests from '../util/questionListToPathwayTests';
import questionListToSegments from '../util/questionListToSegments';

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
    moveOn: ['You are Jiahan Ericsson, you agree.'],
    retry: ["You have no idea who this is or why they're calling."],
    followUp: ['You have no idea who Jiahan Ericsson is and you think this is a wrong number.'],
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
    moveOn: ['There was a misunderstanding but you are Jiahan Ericsson and you want to confirm.'],
    giveUp: ['You are not the right person, this is probably a wrong number.'],
  },
});

confirmWrongName.addGiveUp({
  nodePrompt:
    'Apologize for not being able to connect with the correct patient, and politely hang up the call.',
  condition: 'User was not the patient or an authorized user.',
});

confirmName.addFollowUp({
  condition: `Follow this pathway if the patient has said no, they aren't "{{patient_full_name}}", or they say their name and it is something completely different than {{patient_full_name}}.`,
  followUpQuestions: [confirmWrongName],
});

// rewrite this because followup needs to be reconfigured
nullThrows(confirmName.params.replyPaths.moveOn).condition = `
  The patient has agreed that they are {{patient_full_name}} or otherwise confirmed in any way.
  Remember that this is the written transcript of a phone call, so names can frequently be incorrectly transcribed.
  If the patient says they are the correct person, even if the name is different, that is fine.
  Examples: "Speaking." "This is her" "Yes, this is [name]"
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
  moveOnCondition: `
    The date the patient just said converts to the same month day and year as "{{patient_dob}}".
    The entire date must match and they must say day, month, and year. Just the month and day is not enough.
    Remember that this is a transcript of a spoken conversation, so if the response sounds similar to the date but is not exactly the same that is good enough.
  `,
  tests: {
    moveOn: [
      'Your birthday is 01/01/1999 and you want to say it as consise as possible',
      'Your birthday is 01/01/1999 and you want to say it as clearly as possible',
    ],
    retry: [
      'Your birthday is 03/04/1999',
      "Your birthday is 01/01/1999 but you don't want to give all of that information in a single message",
      'Why are they asking something like that to you?',
    ],
  },
});

// only move forward if we match the date of birth correctly
nullThrows(confirmDOB.params.replyPaths.retry).condition = `
  The date the patient just said is a different date than "{{patient_dob}}".
  Also if the date the patient said doesn't have a day, month, and year.
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
    moveOn: ["You haven't had a DEXA scan before"],
    retry: ["You are confused what a DEXA scan is and why they're asking"],
    followUp: ['You had a DEXA scan two years ago.'],
  },
});

hasHadPreviousDEXAScan.addFollowUp({
  condition: `
    If the user says yes, they have had a DEXA scan before.
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
    moveOn: [
      "You haven't had any fractures.",
      'You broke your arm five months ago but you are okay.',
    ],
    retry: ['You are confused why they are asking you this'],
  },
});

const height = new SimpleRetryQuestion({
  title: 'Height',
  allowIDontKnow: false,
  prompt: `
    "Now, a couple of quick health details. What is your current height?"
    If the patient asks about limits, the usual limit is maximum six feet, but these numbers vary between centers so we have to verify and get back to them.
  `,
  moveOnCondition: `
  The patient has given us their height in a way that makes sense.
  Within a foot answers are fine, (for example: "five foot something", "five feet", "around five feet").
  Meters and centimeters are also fine, convert them to feet when thinking about them.
`,
  tests: {
    moveOn: [
      "You know that you're around five feet tall but don't know more than that.",
      'You know your exactly five foot three inches.',
    ],
    retry: [
      "You haven't checked your height in so long, you have no idea",
      "You don't want to give this person your height, that's private",
      "You're confused why they're asking you this.",
    ],
  },
});

const weight = new SimpleRetryQuestion({
  title: 'Weight',
  allowIDontKnow: false,
  prompt: `
    "And what is your current weight?"
    If the patient asks about limits, the usual limit is 350 pounds, but these numbers vary between centers so we have to verify and get back to them.
  `,
  moveOnCondition: `
  The patient has given us their weight in a way that makes sense.
  Within one hundred pound answers are fine, (for example: "two hundred something", "like two fifty", "one sixty two").
  Kilograms are also fine, convert them to feet when thinking about them.
`,
  tests: {
    moveOn: [
      "You know you're around two hundred pounds but you don't know any more specific than that",
      'You know you are exactly one hundred and twenty three pounds',
    ],
    retry: [
      "You haven't checked your weight in so long, you have no idea",
      "You don't want to give this person your weight, that's private",
      "You're confused why they're asking you this.",
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
    moveOn: [
      'You use a walker sometimes but only when your tired',
      'You use a cane',
      "You don't use any of these",
      "You don't use any of these and are sort of annoyed they assumed you did",
    ],
    retry: ['You are confused why they are asking you this'],
  },
});

const metalInBody = new SimpleRetryQuestion({
  title: 'Metal In Body',
  allowIDontKnow: true,
  prompt: `
    "Do you have any metal in your body?"
  `,
  tests: {
    moveOn: ['You have no metal in your body', 'You have no idea if you have metal in your body'],
    retry: ['You are confused why they are asking you this'],
    followUp: ['You have a knee replacement.'],
  },
});

metalInBody.addFollowUp({
  condition: `
    If the user says they do have metal in their body, if they answered affirmatively.
    For example: "Yes" "Yeah" "I Do"
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
  moveOnCondition: `
  The patient has said yes, no, or they don't know.
  Examples: "Yes" "No" "I don't know"
  `,
  tests: {
    moveOn: [
      "You don't know any imaging centers and want them to find one for you",
      'You have no preference',
    ],
    retry: ["You have no idea why they're asking you this"],
    followUp: ["You know Sunset Imaging is down the street and it's where you always go"],
  },
});

centerNearYou.addFollowUp({
  condition: `
    If the user says yes, that they do have a prefered imaging center location.
    Also if they name a specific center or allude to the fact that they know a center nearby.
    For example: "Yes" "Yeah" "I Do" "I know there's one down the street"
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
nullThrows(centerNearYou.params.replyPaths.moveOn).condition += `
  The patient asks you for an opinion on what center to pick or asks a question about centers nearby.
  Examples: "Where is the nearest center?" "Can you find one for me?"
`;

const schedulingPreference = new SimpleRetryQuestion({
  title: 'Scheduling Preference',
  allowIDontKnow: true,
  prompt: `
    If the above response was a question relevant to imaging center location, succinctly answer the question then ask:
    "Are there specific days or times that usually work best for your appointment? For example, Monday mornings?"

    For the days/times try to get windows like "Tuesdays" instead of single options like "tomorrow". We want the availability to apply to at least a few windows.
    These are great examples of answers: "Saturdays and Sundays", "Monday and Wednesday afternoon", "Monday mornings", and "Thursday evenings".
    These are insufficient answers because there aren't enough options: "Tomorrow", "How about this Saturday at 9?".
  `,
  tests: {
    moveOn: [
      "You don't know your schedule but you can call back later with it.",
      'Some specific week day in the morning or afternoon works for you.',
    ],
    retry: [
      'You only know one specific day and time that works but not a range.',
      "You don't understand why they're asking you this",
    ],
  },
});

// only continue when we have a window
nullThrows(schedulingPreference.params.replyPaths.moveOn).condition = `
  Take this pathway when we get windows like "Tuesdays" instead of single options like "tomorrow" or "next Tuesday". We want the availability to apply to at least a few windows.
  These are great examples of answers: "Saturdays and Sundays", "Monday and Wednesday afternoon", "Monday mornings", and "Thursday evenings".
  These are insufficient answers because there aren't enough options: "Tomorrow", "How about this Saturday at 9?".
  I don't know is an acceptable answer.
  Examples: "I don't know", "I'm not sure", "I don't want to tell you that", "I don't remember", "I don't know my schedule right now"
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

export const DEXA_SCAN_PATHWAY: Pathway = {
  globalPrompt,
  voicemailMessage,
  segments: questionListToSegments(DEXA_SCAN_QUESTION_LIST, DefaultEndNode),
};

export const DEXA_SCAN_PATHWAY_TESTS: PathwayTest[] = questionListToPathwayTests(
  DEXA_SCAN_QUESTION_LIST,
  DefaultEndNode,
);
