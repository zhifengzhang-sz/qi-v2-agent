/**
 * @qi/tools - Tool Registry Implementation
 *
 * Manages tool registration, discovery, and metadata with proper QiCore Result<T> patterns.
 */

import {
  failure,
  flatMap,
  type QiError,
  type Result,
  success,
  systemError,
  validationError,
} from '@qi/base';
import {
  type ITool,
  type IToolRegistry,
  type RegistryChangeEvent,
  RegistryEventType,
  type RegistryStats,
  type ToolContext,
  type ToolDiscoveryQuery,
  type ToolMetadata,
  type ToolRegistrationOptions,
  type ToolValidationResult,
} from '../interfaces/index.js';

/**
 * Default registration options
 */
const DEFAULT_REGISTRATION_OPTIONS: ToolRegistrationOptions = {
  override: false,
  validateOnRegistration: true,
  enableMetrics: true,
};

/**
 * Tool registry implementation with QiCore patterns
 */
export class ToolRegistry implements IToolRegistry {
  private readonly tools = new Map<string, ITool>();
  private readonly metadata = new Map<string, ToolMetadata>();
  private readonly eventListeners = new Set<(event: RegistryChangeEvent) => void>();

  register<TInput, TOutput>(
    tool: ITool<TInput, TOutput>,
    metadata: ToolMetadata,
    options: ToolRegistrationOptions = DEFAULT_REGISTRATION_OPTIONS
  ): Result<void, QiError> {
    // Check for name conflicts
    if (this.tools.has(metadata.name) && !options.override) {
      return failure(
        validationError(
          `Tool '${metadata.name}' is already registered. Use override option to replace.`
        )
      );
    }

    // Validate tool implementation if requested
    if (options.validateOnRegistration) {
      const validationResult = this.validate(tool, metadata);
      return flatMap((validation) => {
        if (!validation.valid) {
          return failure(
            validationError(`Tool validation failed: ${validation.errors.join(', ')}`)
          );
        }

        // Ensure tool name matches metadata
        if (tool.name !== metadata.name) {
          return failure(
            validationError(
              `Tool name '${tool.name}' does not match metadata name '${metadata.name}'`
            )
          );
        }

        // Register the tool
        this.tools.set(metadata.name, tool);
        this.metadata.set(metadata.name, metadata);

        // Emit registration event
        this.emitEvent({
          type: RegistryEventType.TOOL_REGISTERED,
          toolName: metadata.name,
          metadata: metadata,
          timestamp: Date.now(),
        });

        return success(undefined);
      }, validationResult);
    }

    // Skip validation - register directly
    this.tools.set(metadata.name, tool);
    this.metadata.set(metadata.name, metadata);

    this.emitEvent({
      type: RegistryEventType.TOOL_REGISTERED,
      toolName: metadata.name,
      metadata: metadata,
      timestamp: Date.now(),
    });

    return success(undefined);
  }

  async unregister(toolName: string): Promise<Result<void, QiError>> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return failure(validationError(`Tool '${toolName}' is not registered`));
    }

    // Call cleanup if available
    if (tool.cleanup) {
      const cleanupResult = await tool.cleanup();
      return flatMap(() => {
        this.tools.delete(toolName);
        this.metadata.delete(toolName);

        this.emitEvent({
          type: RegistryEventType.TOOL_UNREGISTERED,
          toolName,
          timestamp: Date.now(),
        });

        return success(undefined);
      }, cleanupResult);
    }

    // No cleanup needed
    this.tools.delete(toolName);
    this.metadata.delete(toolName);

    this.emitEvent({
      type: RegistryEventType.TOOL_UNREGISTERED,
      toolName,
      timestamp: Date.now(),
    });

    return success(undefined);
  }

  get<TInput, TOutput>(toolName: string): Result<ITool<TInput, TOutput>, QiError> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return failure(validationError(`Tool '${toolName}' not found`));
    }
    return success(tool as ITool<TInput, TOutput>);
  }

  has(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  getMetadata(toolName: string): Result<ToolMetadata, QiError> {
    const metadata = this.metadata.get(toolName);
    if (!metadata) {
      return failure(validationError(`Metadata for tool '${toolName}' not found`));
    }
    return success(metadata);
  }

  discover(query: ToolDiscoveryQuery): Result<readonly ToolMetadata[], QiError> {
    const allMetadata = Array.from(this.metadata.values());

    let filtered = allMetadata;

    // Filter by name (exact match)
    if (query.name) {
      filtered = filtered.filter((meta) => meta.name === query.name);
    }

    // Filter by category
    if (query.category) {
      filtered = filtered.filter((meta) => meta.category === query.category);
    }

    // Filter by tags (must have all specified tags)
    if (query.tags && query.tags.length > 0) {
      filtered = filtered.filter((meta) => query.tags?.every((tag) => meta.tags.includes(tag)));
    }

    // Filter by capabilities
    if (query.capabilities) {
      filtered = filtered.filter((meta) => {
        const tool = this.tools.get(meta.name);
        if (!tool) return false;

        const caps = query.capabilities!;
        if (caps.concurrent !== undefined && tool.isConcurrencySafe !== caps.concurrent) {
          return false;
        }
        if (caps.readOnly !== undefined && tool.isReadOnly !== caps.readOnly) {
          return false;
        }

        return true;
      });
    }

    return success(filtered);
  }

  listAll(): readonly ToolMetadata[] {
    return Array.from(this.metadata.values());
  }

  listByCategory(category: string): readonly ToolMetadata[] {
    return this.listAll().filter((meta) => meta.category === category);
  }

  listByTag(tag: string): readonly ToolMetadata[] {
    return this.listAll().filter((meta) => meta.tags.includes(tag));
  }

  validate<TInput, TOutput>(
    tool: ITool<TInput, TOutput>,
    metadata: ToolMetadata
  ): Result<ToolValidationResult, QiError> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate required properties
    if (!tool.name || typeof tool.name !== 'string') {
      errors.push('Tool must have a valid name');
    }

    if (!tool.description || typeof tool.description !== 'string') {
      errors.push('Tool must have a description');
    }

    if (!tool.version || typeof tool.version !== 'string') {
      errors.push('Tool must have a version');
    }

    if (!tool.inputSchema) {
      errors.push('Tool must have an input schema');
    }

    if (typeof tool.execute !== 'function') {
      errors.push('Tool must have an execute method');
    }

    if (typeof tool.validate !== 'function') {
      errors.push('Tool must have a validate method');
    }

    if (typeof tool.checkPermissions !== 'function') {
      errors.push('Tool must have a checkPermissions method');
    }

    if (typeof tool.isReadOnly !== 'boolean') {
      errors.push('Tool must specify isReadOnly property');
    }

    if (typeof tool.isConcurrencySafe !== 'boolean') {
      errors.push('Tool must specify isConcurrencySafe property');
    }

    // Validate metadata consistency
    if (tool.name !== metadata.name) {
      errors.push('Tool name must match metadata name');
    }

    if (tool.version !== metadata.version) {
      warnings.push('Tool version differs from metadata version');
    }

    return success({
      valid: errors.length === 0,
      errors,
      warnings,
    });
  }

  getStats(): RegistryStats {
    const tools = this.listAll();
    const categoryCounts = new Map<string, number>();
    const tagCounts = new Map<string, number>();
    let concurrentSafeCount = 0;
    let readOnlyCount = 0;

    for (const metadata of tools) {
      // Count by category
      const currentCount = categoryCounts.get(metadata.category) || 0;
      categoryCounts.set(metadata.category, currentCount + 1);

      // Count by tags
      for (const tag of metadata.tags) {
        const currentTagCount = tagCounts.get(tag) || 0;
        tagCounts.set(tag, currentTagCount + 1);
      }

      // Count capabilities
      const tool = this.tools.get(metadata.name);
      if (tool) {
        if (tool.isConcurrencySafe) concurrentSafeCount++;
        if (tool.isReadOnly) readOnlyCount++;
      }
    }

    return {
      totalTools: tools.length,
      categoryCounts,
      tagCounts,
      concurrentSafeCount,
      readOnlyCount,
    };
  }

  async clear(): Promise<Result<void, QiError>> {
    const cleanupPromises: Promise<Result<void, QiError>>[] = [];

    // Cleanup all tools
    for (const tool of this.tools.values()) {
      if (tool.cleanup) {
        cleanupPromises.push(tool.cleanup());
      }
    }

    // Wait for all cleanups
    const results = await Promise.all(cleanupPromises);

    // Check for cleanup failures
    const failures = results.filter((result) => result.tag === 'failure');
    if (failures.length > 0) {
      return failure(systemError(`Some tool cleanups failed: ${failures.length} failures`));
    }

    // Clear all data
    this.tools.clear();
    this.metadata.clear();

    // Emit clear event
    this.emitEvent({
      type: RegistryEventType.REGISTRY_CLEARED,
      timestamp: Date.now(),
    });

    return success(undefined);
  }

  async checkPermissions(
    toolNames: readonly string[],
    context: ToolContext
  ): Promise<Result<ReadonlyMap<string, boolean>, QiError>> {
    const results = new Map<string, boolean>();

    for (const toolName of toolNames) {
      const toolResult = this.get(toolName);
      if (toolResult.tag === 'success') {
        const tool = toolResult.value;
        const permissionResult = tool.checkPermissions({} as any, context);
        if (permissionResult.tag === 'success') {
          results.set(toolName, permissionResult.value.allowed);
        } else {
          results.set(toolName, false);
        }
      } else {
        results.set(toolName, false);
      }
    }

    return success(results);
  }

  getConcurrentSafeTools(toolNames: readonly string[]): Result<readonly string[], QiError> {
    const concurrentSafe: string[] = [];

    for (const toolName of toolNames) {
      const tool = this.tools.get(toolName);
      if (tool?.isConcurrencySafe) {
        concurrentSafe.push(toolName);
      }
    }

    return success(concurrentSafe);
  }

  getSequentialTools(toolNames: readonly string[]): Result<readonly string[], QiError> {
    const sequential: string[] = [];

    for (const toolName of toolNames) {
      const tool = this.tools.get(toolName);
      if (tool && !tool.isConcurrencySafe) {
        sequential.push(toolName);
      }
    }

    return success(sequential);
  }

  onRegistryChange(listener: (event: RegistryChangeEvent) => void): () => void {
    this.eventListeners.add(listener);

    return () => {
      this.eventListeners.delete(listener);
    };
  }

  /**
   * Emit registry event to all listeners
   */
  private emitEvent(event: RegistryChangeEvent): void {
    for (const listener of this.eventListeners) {
      // Fire and forget - don't let listener errors affect registry
      listener(event);
    }
  }
}
