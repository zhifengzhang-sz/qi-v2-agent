// Command Handler Abstractions - Technology Agnostic
//
// Based on docs/agents/v1/agent.abstractions.md
// These interfaces contain no dependencies on specific packages or frameworks
// and can be implemented using any technology stack.

import type { ProcessingContext } from './cognitive-patterns.js';

/**
 * Command parameter validation
 */
export interface CommandParameterValidation {
  readonly pattern?: string;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly allowedValues?: readonly unknown[];
}

/**
 * Command parameter definition
 */
export interface CommandParameter {
  readonly name: string;
  readonly description: string;
  readonly type: 'string' | 'number' | 'boolean' | 'array';
  readonly required: boolean;
  readonly defaultValue?: unknown;
  readonly validation?: CommandParameterValidation;
}

/**
 * Command definition
 */
export interface CommandDefinition {
  readonly name: string;
  readonly description: string;
  readonly usage: string;
  readonly category: string;
  readonly parameters: readonly CommandParameter[];
  readonly aliases?: readonly string[];
}

/**
 * Command request
 */
export interface CommandRequest {
  readonly commandName: string;
  readonly parameters: ReadonlyMap<string, unknown>;
  readonly rawInput: string;
  readonly context?: ProcessingContext;
}

/**
 * Command result
 */
export interface CommandResult {
  readonly status: 'success' | 'error' | 'help' | 'not_found';
  readonly content: string;
  readonly data?: unknown;
  readonly suggestions?: readonly string[];
  readonly metadata: ReadonlyMap<string, unknown>;
  readonly output: string;
  readonly commandName: string;
  readonly success: boolean;
}

/**
 * Command executor function type
 */
export type CommandExecutor = (request: CommandRequest) => Promise<CommandResult>;

/**
 * Abstract command handler interface
 */
export interface ICommandHandler {
  getAvailableCommands(): readonly CommandDefinition[];
  executeCommand(request: CommandRequest): Promise<CommandResult>;
  validateCommand(commandName: string, parameters: ReadonlyMap<string, unknown>): Promise<boolean>;
  registerCommand(definition: CommandDefinition, handler: CommandExecutor): void;
  unregisterCommand(commandName: string): void;
}