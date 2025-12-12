// Spaces are tokens, taking more time to process, changing model behavior.
export default function trimPromptWhitespace(prompt: string): string {
  // If you are using this system for python for some reason and have stumbled on this file I'm sorry.
  // on newline get rid of all spaces, otherwise shrink spaces to just one, also trim the ends
  return prompt
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}
