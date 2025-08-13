/**
 * @qi/tools - Tool Registry Interface
 *
 * Defines the interface for managing and discovering tools in the system.
 * Provides registration, lookup, and metadata management capabilities.
 */

import type { QiError, Result } from '@qi/base';
import type { ITool, ToolContext, ToolMetadata } from './ITool.js';

/**
 * Tool discovery criteria for filtering and searching
 */
export interface ToolDiscoveryQuery {
  readonly name?: string;
  readonly category?: string;
  readonly tags?: readonly string[];
  readonly capabilities?: {
    readonly concurrent?: boolean;
    readonly readOnly?: boolean;
    readonly streaming?: boolean;
    readonly cacheable?: boolean;
  };
  readonly permissions?: {
    readonly requiresFileAccess?: boolean;
    readonly requiresNetworkAccess?: boolean;
    readonly requiresSystemAccess?: boolean;
  };
}

/**
 * Tool registration options
 */
export interface ToolRegistrationOptions {
  readonly override?: boolean;
  readonly validateOnRegistration?: boolean;
  readonly enableMetrics?: boolean;
}

/**
 * Registry statistics
 */
export interface RegistryStats {
  readonly totalTools: number;
  readonly categoryCounts: ReadonlyMap<string, number>;
  readonly tagCounts: ReadonlyMap<string, number>;
  readonly concurrentSafeCount: number;
  readonly readOnlyCount: number;
}

/**
 * Tool validation result
 */
export interface ToolValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

/**
 * Core tool registry interface
 *
 * Manages the lifecycle of tools in the system including registration,
 * discovery, validation, and cleanup.
 */
export interface IToolRegistry {
  /**
   * Register a tool in the registry
   *
   * @param tool Tool implementation to register
   * @param metadata Tool metadata for discovery
   * @param options Registration options
   * @returns Result indicating success or failure
   */
  register<TInput, TOutput>(
    tool: ITool<TInput, TOutput>,
    metadata: ToolMetadata,
    options?: ToolRegistrationOptions
  ): Result<void, QiError>;

  /**
   * Unregister a tool from the registry
   *
   * @param toolName Name of tool to unregister
   * @returns Result indicating success or failure
   */
  unregister(toolName: string): Promise<Result<void, QiError>>;

  /**
   * Get a tool by name
   *
   * @param toolName Name of the tool
   * @returns Result containing tool or error if not found
   */
  get<TInput, TOutput>(toolName: string): Result<ITool<TInput, TOutput>, QiError>;

  /**
   * Check if a tool is registered
   *
   * @param toolName Name of the tool
   * @returns Whether the tool is registered
   */
  has(toolName: string): boolean;

  /**
   * Get tool metadata
   *
   * @param toolName Name of the tool
   * @returns Result containing metadata or error
   */
  getMetadata(toolName: string): Result<ToolMetadata, QiError>;

  /**
   * Discover tools matching criteria
   *
   * @param query Discovery query criteria
   * @returns Result containing matching tools
   */
  discover(query: ToolDiscoveryQuery): Result<readonly ToolMetadata[], QiError>;

  /**
   * List all registered tools
   *
   * @returns Array of all tool metadata
   */
  listAll(): readonly ToolMetadata[];

  /**
   * List tools by category
   *
   * @param category Category name
   * @returns Tools in the specified category
   */
  listByCategory(category: string): readonly ToolMetadata[];

  /**
   * List tools by tag
   *
   * @param tag Tag name
   * @returns Tools with the specified tag
   */
  listByTag(tag: string): readonly ToolMetadata[];

  /**
   * Validate a tool implementation
   *
   * @param tool Tool to validate
   * @param metadata Associated metadata
   * @returns Validation result
   */
  validate<TInput, TOutput>(
    tool: ITool<TInput, TOutput>,
    metadata: ToolMetadata
  ): Result<ToolValidationResult, QiError>;

  /**
   * Get registry statistics
   *
   * @returns Current registry statistics
   */
  getStats(): RegistryStats;

  /**
   * Clear all tools from registry
   *
   * @returns Result indicating success or failure
   */
  clear(): Promise<Result<void, QiError>>;

  /**
   * Check if tools can execute in given context
   *
   * @param toolNames Array of tool names to check
   * @param context Execution context
   * @returns Map of tool names to permission results
   */
  checkPermissions(
    toolNames: readonly string[],
    context: ToolContext
  ): Promise<Result<ReadonlyMap<string, boolean>, QiError>>;

  /**
   * Get tools that can be executed concurrently
   *
   * @param toolNames Array of tool names
   * @returns Tools that are safe for concurrent execution
   */
  getConcurrentSafeTools(toolNames: readonly string[]): Result<readonly string[], QiError>;

  /**
   * Get tools that require sequential execution
   *
   * @param toolNames Array of tool names
   * @returns Tools that must be executed sequentially
   */
  getSequentialTools(toolNames: readonly string[]): Result<readonly string[], QiError>;

  /**
   * Subscribe to registry change events
   *
   * @param listener Event listener function
   * @returns Unsubscribe function
   */
  onRegistryChange(listener: (event: RegistryChangeEvent) => void): () => void;
}

/**
 * Registry change event types
 */
export enum RegistryEventType {
  TOOL_REGISTERED = 'tool_registered',
  TOOL_UNREGISTERED = 'tool_unregistered',
  REGISTRY_CLEARED = 'registry_cleared',
}

/**
 * Registry change event
 */
export interface RegistryChangeEvent {
  readonly type: RegistryEventType;
  readonly toolName?: string;
  readonly metadata?: ToolMetadata;
  readonly timestamp: number;
}
