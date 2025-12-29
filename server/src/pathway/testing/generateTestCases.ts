import { GoogleGenAI } from '@google/genai';

export default async function generateTestCases(question: string, responseCue: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `## Instructions
You are generating responses that will be used to test all of the edge cases of a LLM voice agent.
You will recieve an example QUESTION and a CUE for how to respond to that QUESTION.
It's important that you keep each of these responses as consise as possible and don't say anything other than the responses.
We are mimicing a transcript of recorded audio, so try to incorrectly transcribe every once in a while by using words that sound very similar to the words you were going to use. Only do this very occasionally.

## Format
Generate 10 possible responses that make sense given the QUESTION and CUE.
Put each response on a new line.

## QUESTION
${question}

## CUE
${responseCue}`,
  });

  return response.text?.split('\n') ?? [];
}
