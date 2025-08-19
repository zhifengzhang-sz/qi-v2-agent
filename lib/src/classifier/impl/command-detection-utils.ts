// Enhanced Command Detection Utilities - Claude Code Style
//
// Provides centralized command detection with Claude Code-style patterns:
// - Slash commands: /help, /model, /clear
// - File references: @filename, @directory/
// - Extended thinking triggers: "think", "think harder", "think more"
// - Conversation control: --continue, --resume

import type { ClassificationResult } from '../abstractions/index.js';

/**
 * Configuration for command detection
 */
export interface CommandDetectionConfig {
  commandPrefix: string;
  fileReferencePrefix: string;
  extendedThinkingTriggers: readonly string[];
  conversationControlFlags: readonly string[];
}

/**
 * Default command detection configuration with Claude Code-style patterns
 */
export const DEFAULT_COMMAND_CONFIG: CommandDetectionConfig = {
  commandPrefix: '/',
  fileReferencePrefix: '@',
  extendedThinkingTriggers: ['think', 'think harder', 'think more', 'reason', 'analyze deeply'],
  conversationControlFlags: ['--continue', '--resume', '--new'],
};

/**
 * Enhanced command detection with Claude Code-style patterns.
 * Detects slash commands, file references, thinking triggers, and conversation control flags.
 *
 * @param input - The user input to analyze
 * @param config - Command detection configuration
 * @returns Classification result if input is a command, null otherwise
 */
export function detectCommand(
  input: string,
  config: CommandDetectionConfig = DEFAULT_COMMAND_CONFIG
): ClassificationResult | null {
  const trimmedInput = input.trim();

  // 1. Check for slash commands (/help, /model, etc.)
  if (trimmedInput.startsWith(config.commandPrefix)) {
    const commandName = extractCommandName(trimmedInput, config);
    const commandArgs = extractCommandArgs(trimmedInput, config);

    return {
      type: 'command',
      confidence: 1.0,
      method: 'rule-based',
      extractedData: new Map<string, unknown>([
        ['command', commandName],
        ['args', commandArgs],
        ['commandType', 'slash'],
      ]),
      metadata: new Map<string, unknown>([
        ['commandName', commandName],
        ['commandType', 'slash'],
        ['detectionStage', 'command-detection'],
        ['detectedBy', 'enhanced-command-detection'],
        ['timestamp', new Date().toISOString()],
      ]),
    };
  }

  // 2. Check for conversation control flags (--continue, --resume)
  for (const flag of config.conversationControlFlags) {
    if (trimmedInput.startsWith(flag)) {
      const args = trimmedInput
        .substring(flag.length)
        .trim()
        .split(/\s+/)
        .filter((arg) => arg.length > 0);

      return {
        type: 'command',
        confidence: 1.0,
        method: 'rule-based',
        extractedData: new Map<string, unknown>([
          ['command', flag.substring(2)], // Remove -- prefix
          ['args', args],
          ['commandType', 'conversation-control'],
        ]),
        metadata: new Map<string, unknown>([
          ['commandName', flag],
          ['commandType', 'conversation-control'],
          ['detectionStage', 'command-detection'],
          ['detectedBy', 'enhanced-command-detection'],
          ['timestamp', new Date().toISOString()],
        ]),
      };
    }
  }

  // 3. Check for file reference patterns (@filename, @directory/)
  const fileReferenceMatch = detectFileReference(trimmedInput, config);
  if (fileReferenceMatch) {
    return {
      type: 'command',
      confidence: 0.9, // Slightly lower confidence as these might be part of larger requests
      method: 'rule-based',
      extractedData: new Map<string, unknown>([
        ['command', 'file-reference'],
        ['fileReferences', fileReferenceMatch.references],
        ['remainingText', fileReferenceMatch.remainingText],
        ['commandType', 'file-reference'],
      ]),
      metadata: new Map<string, unknown>([
        ['commandType', 'file-reference'],
        ['fileCount', fileReferenceMatch.references.length],
        ['detectionStage', 'command-detection'],
        ['detectedBy', 'enhanced-command-detection'],
        ['timestamp', new Date().toISOString()],
      ]),
    };
  }

  return null;
}

/**
 * Checks if input is a command (without returning classification result)
 *
 * @param input - The user input to check
 * @param config - Command detection configuration
 * @returns true if input is a command, false otherwise
 */
export function isCommand(
  input: string,
  config: CommandDetectionConfig = DEFAULT_COMMAND_CONFIG
): boolean {
  return input.trim().startsWith(config.commandPrefix);
}

/**
 * Extracts command name from command input
 *
 * @param input - Command input (e.g., "/help arg1 arg2")
 * @param config - Command detection configuration
 * @returns The command name (e.g., "help")
 */
export function extractCommandName(
  input: string,
  config: CommandDetectionConfig = DEFAULT_COMMAND_CONFIG
): string {
  const prefix = config.commandPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^${prefix}([a-zA-Z0-9_-]+)`);
  const match = input.match(regex);
  return match ? match[1] : 'unknown';
}

/**
 * Extracts command arguments from command input
 *
 * @param input - Command input (e.g., "/help arg1 arg2")
 * @param config - Command detection configuration
 * @returns Array of command arguments (e.g., ["arg1", "arg2"])
 */
export function extractCommandArgs(
  input: string,
  config: CommandDetectionConfig = DEFAULT_COMMAND_CONFIG
): string[] {
  const prefix = config.commandPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^${prefix}[a-zA-Z0-9_-]+\\s+(.*)$`);
  const match = input.match(regex);
  return match ? match[1].split(/\s+/).filter((arg) => arg.length > 0) : [];
}

/**
 * Detects file references in input (@filename, @directory/)
 *
 * @param input - The user input to analyze
 * @param config - Command detection configuration
 * @returns File reference match result or null
 */
export function detectFileReference(
  input: string,
  config: CommandDetectionConfig = DEFAULT_COMMAND_CONFIG
): { references: string[]; remainingText: string } | null {
  // Properly escape the prefix and construct the regex pattern
  const escapedPrefix = config.fileReferencePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const fileReferenceRegex = new RegExp(`${escapedPrefix}([\\w\\-./]+)`, 'g');
  const matches = Array.from(input.matchAll(fileReferenceRegex));

  if (matches.length === 0) {
    return null;
  }

  const references = matches.map((match) => match[1]);

  // Remove file references to get remaining text
  let remainingText = input;
  matches.forEach((match) => {
    remainingText = remainingText.replace(match[0], '').trim();
  });

  return {
    references,
    remainingText: remainingText.replace(/\s+/g, ' ').trim(),
  };
}

/**
 * Detects extended thinking triggers in input
 *
 * @param input - The user input to analyze
 * @param config - Command detection configuration
 * @returns Extended thinking match result or null
 */
export function detectExtendedThinking(
  input: string,
  config: CommandDetectionConfig = DEFAULT_COMMAND_CONFIG
): { trigger: string; intensity: number; remainingText: string } | null {
  const lowerInput = input.toLowerCase();

  // Sort triggers by length (longest first) to match more specific patterns first
  const sortedTriggers = [...config.extendedThinkingTriggers].sort((a, b) => b.length - a.length);

  for (const trigger of sortedTriggers) {
    if (lowerInput.includes(trigger.toLowerCase())) {
      // Determine thinking intensity based on both trigger and context
      let intensity = 1;

      // Check trigger itself
      if (trigger.includes('harder') || trigger.includes('more')) {
        intensity = 2;
      }
      if (trigger.includes('deeply') || trigger.includes('analyze')) {
        intensity = 3;
      }

      // Also check the full input for intensity modifiers
      if (lowerInput.includes('harder') || lowerInput.includes('more')) {
        intensity = Math.max(intensity, 2);
      }
      if (lowerInput.includes('deeply') || lowerInput.includes('thoroughly')) {
        intensity = Math.max(intensity, 3);
      }

      // Remove trigger from input to get remaining text
      const remainingText = input
        .replace(new RegExp(trigger, 'gi'), '')
        .replace(/\s+/g, ' ')
        .trim();

      return {
        trigger,
        intensity,
        remainingText,
      };
    }
  }

  return null;
}

/**
 * Enhanced version that checks for any Claude Code-style command patterns
 *
 * @param input - The user input to check
 * @param config - Command detection configuration
 * @returns true if input contains any command patterns, false otherwise
 */
export function hasClaudeCodePatterns(
  input: string,
  config: CommandDetectionConfig = DEFAULT_COMMAND_CONFIG
): boolean {
  const trimmedInput = input.trim();

  // Check slash commands
  if (trimmedInput.startsWith(config.commandPrefix)) {
    return true;
  }

  // Check conversation control flags
  for (const flag of config.conversationControlFlags) {
    if (trimmedInput.startsWith(flag)) {
      return true;
    }
  }

  // Check file references
  if (detectFileReference(trimmedInput, config)) {
    return true;
  }

  // Check extended thinking triggers
  if (detectExtendedThinking(trimmedInput, config)) {
    return true;
  }

  return false;
}
