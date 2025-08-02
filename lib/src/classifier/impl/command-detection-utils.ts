// Shared Command Detection Utilities
//
// Provides centralized command detection that all classification methods can use
// to avoid expensive LLM calls for obvious commands like "/help"

import type { ClassificationResult } from '../abstractions/index.js';

/**
 * Configuration for command detection
 */
export interface CommandDetectionConfig {
  commandPrefix: string;
}

/**
 * Default command detection configuration
 */
export const DEFAULT_COMMAND_CONFIG: CommandDetectionConfig = {
  commandPrefix: '/',
};

/**
 * Detects if input is a command and returns immediately if so.
 * This should be called first by all classification methods to avoid
 * expensive LLM processing for obvious commands.
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

  // Check if input starts with command prefix
  if (!trimmedInput.startsWith(config.commandPrefix)) {
    return null;
  }

  // Extract command details
  const commandName = extractCommandName(trimmedInput, config);
  const commandArgs = extractCommandArgs(trimmedInput, config);

  // Return command classification result immediately
  return {
    type: 'command',
    confidence: 1.0,
    method: 'rule-based',
    extractedData: new Map<string, unknown>([
      ['command', commandName],
      ['args', commandArgs],
    ]),
    metadata: new Map<string, unknown>([
      ['commandName', commandName],
      ['detectionStage', 'command-detection'],
      ['detectedBy', 'shared-command-detection'],
      ['timestamp', new Date().toISOString()],
    ]),
  };
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
