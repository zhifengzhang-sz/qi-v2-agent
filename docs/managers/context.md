# Context Manager Design & Implementation Guide

## Overview

The Context Manager is responsible for managing execution contexts, environment isolation, and contextual information flow in the qi-v2 agent system. It provides secure context isolation for sub-agents, maintains conversation contexts, and manages environment-specific data.

## Design Philosophy

### Core Principles

1. **Context Isolation**: Sub-agents operate in isolated contexts with restricted access
2. **Security Boundaries**: Strict boundaries prevent context leakage and unauthorized access
3. **Hierarchical Contexts**: Parent-child relationship with controlled inheritance
4. **Environment Awareness**: Context-aware tool execution and resource access
5. **Temporal Management**: Context lifecycle with expiration and cleanup

### Architecture Position

```
Agent → Context Manager → Isolated Contexts
     ↓                  ↓
  StateManager      Sub-Agent Contexts
     ↓                  ↓
  Global Context    Task-Specific Contexts
```

The Context Manager creates and manages isolated execution environments for different agents and tasks.

## Core Components

### 1. Context Types

#### Application Context (`AppContext`)

Global application execution context:

```typescript
interface AppContext {
  readonly sessionId: string;                  // Current session identifier
  readonly userId?: string;                    // User identifier (optional)
  readonly workspaceId?: string;              // Workspace identifier (optional)
  readonly currentDirectory: string;          // Working directory
  readonly environment: ReadonlyMap<string, string>; // Environment variables
  readonly metadata: ReadonlyMap<string, unknown>;   // Additional context
}
```

#### Conversation Context (`ConversationContext`)

Context for ongoing conversations and interactions:

```typescript
interface ConversationContext {
  readonly id: string;                        // Context identifier
  readonly parentId?: string;                 // Parent context (for sub-agents)
  readonly type: 'main' | 'sub-agent' | 'tool'; // Context type
  readonly createdAt: Date;                   // Creation timestamp
  readonly expiresAt?: Date;                  // Expiration timestamp
  readonly messages: readonly ContextMessage[]; // Message history
  readonly restrictions: SecurityRestrictions; // Security constraints
  readonly allowedOperations: readonly string[]; // Permitted operations
  readonly metadata: ReadonlyMap<string, unknown>; // Context metadata
}

interface ContextMessage {
  readonly id: string;
  readonly role: 'user' | 'assistant' | 'system';
  readonly content: string;
  readonly timestamp: Date;
  readonly metadata?: ReadonlyMap<string, unknown>;
}
```

#### Isolated Context (`IsolatedContext`)

Secure isolated context for sub-agent execution:

```typescript
interface IsolatedContext {
  readonly id: string;                        // Unique context identifier
  readonly parentContextId: string;          // Parent context reference
  readonly task: string;                      // Associated task description
  readonly allowedOperations: readonly string[]; // Permitted operations
  readonly allowedPaths: readonly string[];  // Accessible file paths
  readonly timeLimit: number;                 // Maximum execution time (ms)
  readonly memoryLimit: number;               // Memory usage limit (bytes)
  readonly boundaries: readonly string[];    // Security boundaries
  readonly createdAt: Date;                   // Creation timestamp
  readonly expiresAt: Date;                   // Expiration timestamp
}
```

### 2. Security Restrictions

```typescript
interface SecurityRestrictions {
  readonly readOnlyMode: boolean;             // Read-only access flag
  readonly allowedPaths: readonly string[];  // Accessible file paths
  readonly blockedCommands: readonly string[]; // Prohibited commands
  readonly blockedTools: readonly string[];  // Prohibited tools
  readonly requireApproval: boolean;          // Requires user approval
  readonly maxExecutionTime: number;         // Maximum execution time
  readonly maxMemoryUsage: number;           // Maximum memory usage
  readonly networkAccess: boolean;           // Network access permission
  readonly systemAccess: boolean;            // System command access
}
```

## Context Manager Interface

### Core Context Management

```typescript
interface IContextManager {
  // Application Context
  getApplicationContext(): AppContext;
  updateApplicationContext(updates: Partial<AppContext>): void;
  
  // Conversation Context
  createConversationContext(
    type: 'main' | 'sub-agent' | 'tool',
    parentId?: string
  ): ConversationContext;
  getConversationContext(id: string): ConversationContext | null;
  addMessageToContext(contextId: string, message: ContextMessage): void;
  
  // Isolated Context for Sub-Agents
  createIsolatedContext(config: IsolatedContextConfig): IsolatedContext;
  validateContextAccess(contextId: string, operation: string): boolean;
  terminateContext(contextId: string): void;
  
  // Context Lifecycle
  cleanupExpiredContexts(): Promise<number>;
  getActiveContexts(): readonly ConversationContext[];
  
  // Security and Boundaries
  enforceSecurityBoundaries(contextId: string, operation: string): Promise<boolean>;
  auditContextAccess(contextId: string, operation: string, result: boolean): void;
}

interface IsolatedContextConfig {
  readonly parentContextId: string;
  readonly task: string;
  readonly specialization: AgentSpecialization;
  readonly restrictions: SecurityRestrictions;
  readonly timeLimit?: number;
  readonly memoryLimit?: number;
}
```

## Implementation Architecture

### Directory Structure

```
src/context/
├── index.ts                    # Public API exports
├── abstractions/
│   ├── index.ts               # Interface exports
│   ├── IContextManager.ts     # Core interfaces
│   └── ContextTypes.ts        # Type definitions
└── impl/
    ├── ContextManager.ts      # Main implementation
    ├── ConversationContext.ts # Conversation context
    ├── IsolatedContext.ts     # Isolated context
    └── SecurityBoundaries.ts  # Security enforcement
```

### Implementation Details

#### 1. Core Context Manager

```typescript
export class ContextManager implements IContextManager {
  private applicationContext: AppContext;
  private conversationContexts = new Map<string, ConversationContext>();
  private isolatedContexts = new Map<string, IsolatedContext>();
  private securityBoundaries: SecurityBoundaryManager;
  private cleanupInterval: NodeJS.Timeout;
  
  constructor(initialAppContext: AppContext) {
    this.applicationContext = initialAppContext;
    this.securityBoundaries = new SecurityBoundaryManager();
    
    // Start cleanup interval for expired contexts
    this.cleanupInterval = setInterval(
      () => this.cleanupExpiredContexts(),
      60000 // Every minute
    );
  }
  
  getApplicationContext(): AppContext {
    return { ...this.applicationContext };
  }
  
  updateApplicationContext(updates: Partial<AppContext>): void {
    this.applicationContext = {
      ...this.applicationContext,
      ...updates,
      // Preserve readonly maps with proper merging
      environment: updates.environment || this.applicationContext.environment,
      metadata: updates.metadata || this.applicationContext.metadata
    };
  }
  
  createConversationContext(
    type: 'main' | 'sub-agent' | 'tool',
    parentId?: string
  ): ConversationContext {
    const contextId = this.generateContextId();
    const now = new Date();
    
    const context: ConversationContext = {
      id: contextId,
      parentId,
      type,
      createdAt: now,
      expiresAt: type === 'sub-agent' ? 
        new Date(now.getTime() + 300000) : // 5 minutes for sub-agents
        undefined, // Main contexts don't expire
      messages: [],
      restrictions: this.getDefaultRestrictions(type),
      allowedOperations: this.getAllowedOperations(type),
      metadata: new Map()
    };
    
    this.conversationContexts.set(contextId, context);
    return context;
  }
  
  createIsolatedContext(config: IsolatedContextConfig): IsolatedContext {
    const contextId = this.generateContextId();
    const now = new Date();
    
    // Validate parent context exists
    if (!this.conversationContexts.has(config.parentContextId)) {
      throw new Error(`Parent context ${config.parentContextId} not found`);
    }
    
    const isolatedContext: IsolatedContext = {
      id: contextId,
      parentContextId: config.parentContextId,
      task: config.task,
      allowedOperations: this.filterOperationsBySpecialization(
        config.specialization,
        config.restrictions
      ),
      allowedPaths: config.restrictions.allowedPaths,
      timeLimit: config.timeLimit || 300000, // 5 minutes default
      memoryLimit: config.memoryLimit || 100 * 1024 * 1024, // 100MB default
      boundaries: this.createSecurityBoundaries(config.restrictions),
      createdAt: now,
      expiresAt: new Date(now.getTime() + (config.timeLimit || 300000))
    };
    
    this.isolatedContexts.set(contextId, isolatedContext);
    this.securityBoundaries.registerContext(contextId, isolatedContext);
    
    return isolatedContext;
  }
  
  async validateContextAccess(contextId: string, operation: string): Promise<boolean> {
    const context = this.isolatedContexts.get(contextId);
    if (!context) {
      return false; // Context not found
    }
    
    // Check expiration
    if (context.expiresAt && new Date() > context.expiresAt) {
      this.terminateContext(contextId);
      return false;
    }
    
    // Check allowed operations
    if (!context.allowedOperations.includes(operation)) {
      this.auditContextAccess(contextId, operation, false);
      return false;
    }
    
    // Enforce security boundaries
    const allowed = await this.securityBoundaries.validateAccess(contextId, operation);
    this.auditContextAccess(contextId, operation, allowed);
    
    return allowed;
  }
  
  terminateContext(contextId: string): void {
    // Remove from active contexts
    this.conversationContexts.delete(contextId);
    this.isolatedContexts.delete(contextId);
    
    // Clean up security boundaries
    this.securityBoundaries.unregisterContext(contextId);
  }
  
  async cleanupExpiredContexts(): Promise<number> {
    const now = new Date();
    let cleaned = 0;
    
    // Cleanup conversation contexts
    for (const [id, context] of this.conversationContexts) {
      if (context.expiresAt && now > context.expiresAt) {
        this.terminateContext(id);
        cleaned++;
      }
    }
    
    // Cleanup isolated contexts
    for (const [id, context] of this.isolatedContexts) {
      if (now > context.expiresAt) {
        this.terminateContext(id);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} expired contexts`);
    }
    
    return cleaned;
  }
  
  private generateContextId(): string {
    return `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private getDefaultRestrictions(type: 'main' | 'sub-agent' | 'tool'): SecurityRestrictions {
    const baseRestrictions: SecurityRestrictions = {
      readOnlyMode: false,
      allowedPaths: [],
      blockedCommands: [],
      blockedTools: [],
      requireApproval: false,
      maxExecutionTime: 60000,
      maxMemoryUsage: 50 * 1024 * 1024,
      networkAccess: false,
      systemAccess: false
    };
    
    switch (type) {
      case 'main':
        return {
          ...baseRestrictions,
          networkAccess: true,
          systemAccess: true
        };
        
      case 'sub-agent':
        return {
          ...baseRestrictions,
          readOnlyMode: true,
          requireApproval: true,
          maxExecutionTime: 30000,
          blockedTools: ['AgentTool', 'SystemTool']
        };
        
      case 'tool':
        return {
          ...baseRestrictions,
          readOnlyMode: true,
          maxExecutionTime: 10000,
          maxMemoryUsage: 10 * 1024 * 1024
        };
        
      default:
        return baseRestrictions;
    }
  }
  
  private getAllowedOperations(type: 'main' | 'sub-agent' | 'tool'): string[] {
    const baseOperations = ['read', 'analyze'];
    
    switch (type) {
      case 'main':
        return [...baseOperations, 'write', 'execute', 'delegate', 'network'];
        
      case 'sub-agent':
        return [...baseOperations, 'search', 'process'];
        
      case 'tool':
        return baseOperations;
        
      default:
        return baseOperations;
    }
  }
}
```

#### 2. Security Boundary Manager

```typescript
class SecurityBoundaryManager {
  private contextBoundaries = new Map<string, Set<string>>();
  private accessAuditLog: AccessAuditEntry[] = [];
  
  registerContext(contextId: string, context: IsolatedContext): void {
    const boundaries = new Set(context.boundaries);
    
    // Add implicit boundaries based on restrictions
    if (context.allowedPaths.length > 0) {
      boundaries.add('path_restricted');
    }
    
    if (context.timeLimit < 60000) {
      boundaries.add('time_limited');
    }
    
    this.contextBoundaries.set(contextId, boundaries);
  }
  
  async validateAccess(contextId: string, operation: string): Promise<boolean> {
    const boundaries = this.contextBoundaries.get(contextId);
    if (!boundaries) {
      return false;
    }
    
    // Check various boundary conditions
    if (boundaries.has('read_only') && this.isWriteOperation(operation)) {
      return false;
    }
    
    if (boundaries.has('no_network') && this.isNetworkOperation(operation)) {
      return false;
    }
    
    if (boundaries.has('no_system') && this.isSystemOperation(operation)) {
      return false;
    }
    
    if (boundaries.has('path_restricted') && !this.isPathAllowed(contextId, operation)) {
      return false;
    }
    
    return true;
  }
  
  unregisterContext(contextId: string): void {
    this.contextBoundaries.delete(contextId);
    
    // Clean up audit log (keep last 1000 entries)
    this.accessAuditLog = this.accessAuditLog
      .filter(entry => entry.contextId !== contextId)
      .slice(-1000);
  }
  
  auditAccess(contextId: string, operation: string, allowed: boolean): void {
    this.accessAuditLog.push({
      contextId,
      operation,
      allowed,
      timestamp: new Date(),
      boundaries: Array.from(this.contextBoundaries.get(contextId) || [])
    });
  }
  
  private isWriteOperation(operation: string): boolean {
    const writeOps = ['write', 'edit', 'create', 'delete', 'modify', 'execute'];
    return writeOps.some(op => operation.toLowerCase().includes(op));
  }
  
  private isNetworkOperation(operation: string): boolean {
    const networkOps = ['fetch', 'request', 'download', 'upload', 'http', 'https'];
    return networkOps.some(op => operation.toLowerCase().includes(op));
  }
  
  private isSystemOperation(operation: string): boolean {
    const systemOps = ['system', 'shell', 'exec', 'command', 'process'];
    return systemOps.some(op => operation.toLowerCase().includes(op));
  }
  
  private isPathAllowed(contextId: string, operation: string): boolean {
    // Implementation would check if the operation path is within allowed paths
    // This is a simplified version
    return true;
  }
}

interface AccessAuditEntry {
  readonly contextId: string;
  readonly operation: string;
  readonly allowed: boolean;
  readonly timestamp: Date;
  readonly boundaries: readonly string[];
}
```

## Context Usage Patterns

### 1. Main Agent Context

```typescript
class QiCodeAgent implements IAgent {
  private contextManager: IContextManager;
  private mainContext: ConversationContext;
  
  constructor(stateManager: IStateManager, contextManager: IContextManager) {
    this.contextManager = contextManager;
    this.mainContext = contextManager.createConversationContext('main');
  }
  
  async process(request: AgentRequest): Promise<AgentResponse> {
    // Add user message to context
    this.contextManager.addMessageToContext(this.mainContext.id, {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: request.input,
      timestamp: new Date()
    });
    
    // Process request with full context access
    const response = await this.processWithContext(request);
    
    // Add response to context
    this.contextManager.addMessageToContext(this.mainContext.id, {
      id: `msg_${Date.now()}`,
      role: 'assistant',
      content: response.content,
      timestamp: new Date()
    });
    
    return response;
  }
}
```

### 2. Sub-Agent Context Isolation

```typescript
class SubAgentDelegator {
  private contextManager: IContextManager;
  
  async delegateTask(
    task: string,
    specialization: AgentSpecialization,
    parentContextId: string
  ): Promise<string> {
    
    // Create isolated context for sub-agent
    const isolatedContext = this.contextManager.createIsolatedContext({
      parentContextId,
      task,
      specialization,
      restrictions: this.getRestrictionsForSpecialization(specialization),
      timeLimit: 300000, // 5 minutes
      memoryLimit: 100 * 1024 * 1024 // 100MB
    });
    
    try {
      // Create sub-agent with isolated context
      const subAgent = new SpecializedSubAgent({
        contextId: isolatedContext.id,
        specialization,
        contextManager: this.contextManager
      });
      
      // Execute task in isolated context
      const result = await subAgent.execute(task);
      
      return result;
      
    } finally {
      // Always cleanup isolated context
      this.contextManager.terminateContext(isolatedContext.id);
    }
  }
}
```

### 3. Tool Execution with Context Validation

```typescript
class ContextAwareTool implements Tool {
  name = "ContextAwareTool";
  
  constructor(private contextManager: IContextManager) {}
  
  async execute(params: any, contextId?: string): Promise<string> {
    if (!contextId) {
      throw new Error('Context ID required for tool execution');
    }
    
    // Validate context access for this operation
    const canExecute = await this.contextManager.validateContextAccess(
      contextId,
      `tool:${this.name}:execute`
    );
    
    if (!canExecute) {
      throw new Error(`Tool execution denied for context ${contextId}`);
    }
    
    // Execute tool with context validation
    return await this.executeWithContext(params, contextId);
  }
  
  private async executeWithContext(params: any, contextId: string): Promise<string> {
    // Implementation with context-aware execution
    return "Tool executed successfully";
  }
}
```

## Memory Integration

### Context-Memory Bridge

```typescript
class ContextMemoryBridge {
  constructor(
    private contextManager: IContextManager,
    private memoryStore: MemoryStore
  ) {}
  
  async getContextualMemory(contextId: string, key: string): Promise<any> {
    const context = this.contextManager.getConversationContext(contextId);
    if (!context) {
      throw new Error(`Context ${contextId} not found`);
    }
    
    // Determine memory scope based on context type
    const scope = this.getMemoryScopeForContext(context);
    
    return await this.memoryStore.get(key, scope);
  }
  
  async setContextualMemory(
    contextId: string,
    key: string,
    value: any
  ): Promise<void> {
    const context = this.contextManager.getConversationContext(contextId);
    if (!context) {
      throw new Error(`Context ${contextId} not found`);
    }
    
    // Validate write permissions
    if (context.restrictions.readOnlyMode) {
      throw new Error('Cannot write memory in read-only context');
    }
    
    const scope = this.getMemoryScopeForContext(context);
    await this.memoryStore.set(key, value, scope);
  }
  
  private getMemoryScopeForContext(context: ConversationContext): 'user' | 'session' | 'global' {
    switch (context.type) {
      case 'main':
        return 'user';
      case 'sub-agent':
        return 'session';
      case 'tool':
        return 'session';
      default:
        return 'session';
    }
  }
}
```

## Testing Strategy

### 1. Context Isolation Tests

```typescript
describe('Context Manager', () => {
  let contextManager: ContextManager;
  
  beforeEach(() => {
    const appContext: AppContext = {
      sessionId: 'test-session',
      currentDirectory: '/test',
      environment: new Map([['NODE_ENV', 'test']]),
      metadata: new Map()
    };
    
    contextManager = new ContextManager(appContext);
  });
  
  it('should create isolated contexts with proper boundaries', async () => {
    const parentContext = contextManager.createConversationContext('main');
    
    const isolatedContext = contextManager.createIsolatedContext({
      parentContextId: parentContext.id,
      task: 'test task',
      specialization: { name: 'research', description: 'Research agent' },
      restrictions: {
        readOnlyMode: true,
        allowedPaths: ['/safe'],
        blockedCommands: ['rm', 'sudo'],
        blockedTools: ['SystemTool'],
        requireApproval: true,
        maxExecutionTime: 30000,
        maxMemoryUsage: 50 * 1024 * 1024,
        networkAccess: false,
        systemAccess: false
      }
    });
    
    expect(isolatedContext.allowedOperations).not.toContain('write');
    expect(isolatedContext.boundaries).toContain('no_system');
  });
  
  it('should enforce access validation', async () => {
    const context = contextManager.createIsolatedContext({
      parentContextId: 'parent',
      task: 'test',
      specialization: { name: 'research' },
      restrictions: { readOnlyMode: true }
    });
    
    const readAccess = await contextManager.validateContextAccess(
      context.id,
      'tool:FileReadTool:execute'
    );
    expect(readAccess).toBe(true);
    
    const writeAccess = await contextManager.validateContextAccess(
      context.id,
      'tool:FileWriteTool:execute'
    );
    expect(writeAccess).toBe(false);
  });
  
  it('should cleanup expired contexts', async () => {
    const shortLivedContext = contextManager.createIsolatedContext({
      parentContextId: 'parent',
      task: 'test',
      specialization: { name: 'research' },
      restrictions: {},
      timeLimit: 100 // 100ms
    });
    
    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 150));
    
    const cleanedCount = await contextManager.cleanupExpiredContexts();
    expect(cleanedCount).toBeGreaterThan(0);
    
    const access = await contextManager.validateContextAccess(
      shortLivedContext.id,
      'read'
    );
    expect(access).toBe(false);
  });
});
```

## Performance Considerations

### 1. Context Lifecycle Management

- Automatic cleanup of expired contexts
- Memory-efficient context storage
- Lazy loading of context data
- Batch operations for context management

### 2. Security Validation Optimization

```typescript
class OptimizedSecurityValidator {
  private validationCache = new Map<string, boolean>();
  private cacheExpiry = 60000; // 1 minute
  
  async validateWithCaching(contextId: string, operation: string): Promise<boolean> {
    const cacheKey = `${contextId}:${operation}`;
    const cached = this.validationCache.get(cacheKey);
    
    if (cached !== undefined) {
      return cached;
    }
    
    const result = await this.performValidation(contextId, operation);
    
    // Cache result with expiry
    this.validationCache.set(cacheKey, result);
    setTimeout(() => {
      this.validationCache.delete(cacheKey);
    }, this.cacheExpiry);
    
    return result;
  }
}
```

## Future Enhancements

### 1. Advanced Context Features

- **Context Inheritance**: More sophisticated parent-child context relationships
- **Context Snapshotsll**: Save and restore context states
- **Context Merging**: Combine contexts from multiple sub-agents
- **Context Analytics**: Detailed usage and performance analytics

### 2. Enhanced Security

- **Fine-grained Permissions**: More detailed access control
- **Dynamic Restrictions**: Adjust restrictions based on runtime behavior
- **Security Policies**: Configurable security policy enforcement
- **Audit Trails**: Comprehensive security audit logging

---

## Quick Reference

### Key Interfaces

- `IContextManager` - Main context management contract
- `AppContext` - Application-wide context
- `ConversationContext` - Conversation-specific context
- `IsolatedContext` - Secure sub-agent context
- `SecurityRestrictions` - Security boundary definitions

### Key Implementation

- `ContextManager` - Main context manager implementation
- `SecurityBoundaryManager` - Security enforcement
- `ContextMemoryBridge` - Context-memory integration

### Integration Pattern

```typescript
// Context manager is used by agents
const contextManager = new ContextManager(appContext);
const agent = new QiCodeAgent(stateManager, contextManager);

// Sub-agents get isolated contexts
const isolatedContext = contextManager.createIsolatedContext(config);
const subAgent = new SubAgent(isolatedContext);
```

This design provides secure, isolated execution contexts that enable safe sub-agent delegation while maintaining strict security boundaries and proper resource management.