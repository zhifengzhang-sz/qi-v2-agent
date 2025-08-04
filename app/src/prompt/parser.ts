/**
 * Simple Input Parser for qi-prompt
 *
 * Routes input based on simple rule:
 * - Starts with `/` → Command
 * - Anything else → Prompt
 */

export type InputType = 'command' | 'prompt';

export interface ParsedInput {
  type: InputType;
  raw: string;
  content: string; // Input without the leading `/` for commands
}

/**
 * Parse input to determine if it's a command or prompt
 */
export function parseInput(input: string): ParsedInput {
  const trimmed = input.trim();
  
  if (trimmed.startsWith('/')) {
    return {
      type: 'command',
      raw: input,
      content: trimmed.slice(1) // Remove the leading `/`
    };
  }
  
  return {
    type: 'prompt',
    raw: input,
    content: trimmed
  };
}

/**
 * Check if input is a command
 */
export function isCommand(input: string): boolean {
  return input.trim().startsWith('/');
}

/**
 * Check if input is a prompt
 */
export function isPrompt(input: string): boolean {
  return !input.trim().startsWith('/');
}