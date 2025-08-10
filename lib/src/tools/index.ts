/**
 * Tool Registry
 * 
 * Central registry for all tools in the toolbox architecture.
 * Provides composable, single-purpose tools for workflows.
 */

// Export tool implementations
export * from './files/index.js';
export * from './parsing/index.js'; 
export * from './context/index.js';

/**
 * Generic tool interface
 */
export interface Tool<TInput = unknown, TOutput = unknown> {
  readonly name: string;
  readonly description: string;
  readonly version: string;
  execute(input: TInput): Promise<TOutput>;
  validate?(input: TInput): boolean;
  cleanup?(): Promise<void>;
}

/**
 * Tool metadata for registry management
 */
export interface ToolMetadata {
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly category: string;
  readonly dependencies: readonly string[];
  readonly tags: readonly string[];
}

/**
 * Tool Registry for managing and accessing tools
 */
export class ToolRegistry {
  private tools = new Map<string, Tool>();
  private metadata = new Map<string, ToolMetadata>();

  /**
   * Register a tool in the registry
   */
  register<T extends Tool>(tool: T, metadata: ToolMetadata): void {
    if (this.tools.has(metadata.name)) {
      throw new Error(`Tool '${metadata.name}' is already registered`);
    }

    // Validate tool implements required interface
    if (!tool.name || !tool.description || !tool.execute) {
      throw new Error(`Tool '${metadata.name}' does not implement required Tool interface`);
    }

    this.tools.set(metadata.name, tool);
    this.metadata.set(metadata.name, metadata);
  }

  /**
   * Get a tool by name
   */
  get<T extends Tool = Tool>(name: string): T | null {
    return (this.tools.get(name) as T) || null;
  }

  /**
   * Check if a tool is registered
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get tool metadata
   */
  getMetadata(name: string): ToolMetadata | null {
    return this.metadata.get(name) || null;
  }

  /**
   * List all registered tools
   */
  listTools(): ToolMetadata[] {
    return Array.from(this.metadata.values());
  }

  /**
   * List tools by category
   */
  listByCategory(category: string): ToolMetadata[] {
    return this.listTools().filter(meta => meta.category === category);
  }

  /**
   * List tools by tag
   */
  listByTag(tag: string): ToolMetadata[] {
    return this.listTools().filter(meta => meta.tags.includes(tag));
  }

  /**
   * Unregister a tool
   */
  unregister(name: string): boolean {
    const tool = this.tools.get(name);
    if (!tool) return false;

    // Call cleanup if available
    if (tool.cleanup) {
      tool.cleanup().catch(error => 
        console.warn(`Error during cleanup of tool '${name}':`, error)
      );
    }

    this.tools.delete(name);
    this.metadata.delete(name);
    return true;
  }

  /**
   * Execute a tool by name
   */
  async execute<TInput, TOutput>(
    toolName: string, 
    input: TInput
  ): Promise<TOutput> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found in registry`);
    }

    // Validate input if validator is available
    if (tool.validate && !tool.validate(input)) {
      throw new Error(`Invalid input for tool '${toolName}'`);
    }

    try {
      return await tool.execute(input) as TOutput;
    } catch (error) {
      throw new Error(`Tool '${toolName}' execution failed: ${error}`);
    }
  }

  /**
   * Clear all tools from registry
   */
  async clear(): Promise<void> {
    const cleanupPromises = Array.from(this.tools.values())
      .filter(tool => tool.cleanup)
      .map(tool => tool.cleanup!().catch(error => 
        console.warn(`Error during cleanup:`, error)
      ));

    await Promise.all(cleanupPromises);
    
    this.tools.clear();
    this.metadata.clear();
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalTools: number;
    categories: Record<string, number>;
    tags: Record<string, number>;
  } {
    const metadata = this.listTools();
    const categories: Record<string, number> = {};
    const tags: Record<string, number> = {};

    for (const meta of metadata) {
      categories[meta.category] = (categories[meta.category] || 0) + 1;
      
      for (const tag of meta.tags) {
        tags[tag] = (tags[tag] || 0) + 1;
      }
    }

    return {
      totalTools: metadata.length,
      categories,
      tags,
    };
  }
}

/**
 * Create and configure a default tool registry
 */
export function createDefaultToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  
  // Tools will be registered by the application or during initialization
  // This keeps the registry flexible and prevents circular dependencies
  
  return registry;
}