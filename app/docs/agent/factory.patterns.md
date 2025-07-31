# qi-v2 Agent Factory Patterns

## Overview

The qi-v2 Agent uses a factory pattern for creation and configuration. This provides flexible dependency injection, clear configuration management, and consistent agent instantiation across different use cases.

## Factory Architecture

### Core Factory Function

```typescript
export function createAgent(
  stateManager: IStateManager,           // Required dependency
  config: AgentFactoryConfig            // Configuration with optional dependencies
): QiCodeAgent {
  
  // Extract core agent configuration
  const agentConfig: AgentConfig = {
    domain: config.domain,
    enableCommands: config.enableCommands ?? true,
    enablePrompts: config.enablePrompts ?? true,
    enableWorkflows: config.enableWorkflows ?? true,
    sessionPersistence: config.sessionPersistence ?? false
  };

  // Extract optional dependencies
  const dependencies = {
    classifier: config.classifier,
    commandHandler: config.commandHandler,
    promptHandler: config.promptHandler,
    workflowEngine: config.workflowEngine,
    workflowExtractor: config.workflowExtractor
  };

  // Create agent with dependency injection
  return new QiCodeAgent(stateManager, agentConfig, dependencies);
}
```

### Factory Configuration Interface

```typescript
export interface AgentFactoryConfig extends AgentConfig {
  // Optional dependencies injected through factory
  readonly classifier?: IClassifier;
  readonly commandHandler?: ICommandHandler;
  readonly promptHandler?: IPromptHandler;
  readonly workflowEngine?: IWorkflowEngine;
  readonly workflowExtractor?: IWorkflowExtractor;
}

interface AgentConfig {
  readonly domain: string;                    // Agent domain/purpose
  readonly enableCommands?: boolean;          // Enable command processing
  readonly enablePrompts?: boolean;           // Enable prompt processing
  readonly enableWorkflows?: boolean;         // Enable workflow processing
  readonly sessionPersistence?: boolean;     // Persist sessions
  readonly configPath?: string;               // Config file path
  readonly providers?: {                      // Provider configurations
    readonly modelProvider?: string;
    readonly toolProvider?: string;
    readonly memoryProvider?: string;
  };
  readonly timeouts?: {                       // Timeout configurations
    readonly commandTimeout?: number;
    readonly promptTimeout?: number;
    readonly workflowTimeout?: number;
  };
  readonly retries?: {                        // Retry configurations
    readonly maxRetries?: number;
    readonly retryDelay?: number;
  };
}
```

## Usage Patterns

### 1. Basic Agent Creation

```typescript
import { createStateManager } from '../state/index.js';
import { createAgent } from './index.js';
import { InputClassifier } from '../classifier/impl/input-classifier.js';

// Create required dependencies
const stateManager = createStateManager();
const classifier = new InputClassifier();

// Create basic agent
const agent = createAgent(stateManager, {
  domain: 'coding-assistant',
  classifier
});

await agent.initialize();
```

### 2. Fully Configured Agent

```typescript
import { createStateManager } from '../state/index.js';
import { createAgent } from './index.js';
import { InputClassifier } from '../classifier/impl/input-classifier.js';
import { BuiltInCommandHandler } from '../command/impl/built-in-command-handler.js';
import { OllamaPromptHandler } from '../prompt/impl/ollama-prompt-handler.js';
import { LangGraphWorkflowEngine } from '../workflow/impl/langgraph-workflow-engine.js';
import { NLPWorkflowExtractor } from '../workflow/impl/nlp-workflow-extractor.js';

// Create all dependencies
const stateManager = createStateManager();
const classifier = new InputClassifier({
  defaultMethod: 'rule-based',
  confidenceThreshold: 0.8,
  commandPrefix: '/'
});

const commandHandler = new BuiltInCommandHandler();
const promptHandler = new OllamaPromptHandler({
  modelUrl: 'http://localhost:11434',
  defaultModel: 'qwen2.5:7b'
});

const workflowEngine = new LangGraphWorkflowEngine();
const workflowExtractor = new NLPWorkflowExtractor();

// Create fully configured agent
const agent = createAgent(stateManager, {
  domain: 'advanced-coding-assistant',
  classifier,
  commandHandler,
  promptHandler,
  workflowEngine,
  workflowExtractor,
  enableCommands: true,
  enablePrompts: true,
  enableWorkflows: true,
  sessionPersistence: true,
  timeouts: {
    commandTimeout: 10000,
    promptTimeout: 30000,
    workflowTimeout: 300000
  },
  retries: {
    maxRetries: 3,
    retryDelay: 1000
  }
});

await agent.initialize();
```

### 3. Minimal Agent (Commands Only)

```typescript
// Create agent with only command support
const agent = createAgent(stateManager, {
  domain: 'status-agent',
  classifier: new InputClassifier(),
  enableCommands: true,
  enablePrompts: false,
  enableWorkflows: false
});

// This agent can only handle:
// - Built-in state commands (/status, /model, /config)
// - Custom commands through CommandHandler (if provided)
// - Prompts and workflows will gracefully degrade
```

### 4. Development vs Production Configuration

```typescript
// Development configuration
const devAgent = createAgent(stateManager, {
  domain: 'dev-assistant',
  classifier: new InputClassifier(),
  commandHandler: new BuiltInCommandHandler(),
  enableCommands: true,
  enablePrompts: true,
  enableWorkflows: false, // Disable complex workflows in dev
  timeouts: {
    commandTimeout: 5000,   // Shorter timeouts for dev
    promptTimeout: 15000
  }
});

// Production configuration
const prodAgent = createAgent(stateManager, {
  domain: 'prod-assistant',
  classifier: new InputClassifier(),
  commandHandler: new BuiltInCommandHandler(),
  promptHandler: new OllamaPromptHandler(),
  workflowEngine: new LangGraphWorkflowEngine(),
  workflowExtractor: new NLPWorkflowExtractor(),
  enableCommands: true,
  enablePrompts: true,
  enableWorkflows: true,
  sessionPersistence: true,
  timeouts: {
    commandTimeout: 30000,  // Longer timeouts for prod
    promptTimeout: 60000,
    workflowTimeout: 600000
  },
  retries: {
    maxRetries: 5,
    retryDelay: 2000
  }
});
```

## Configuration Patterns

### 1. Environment-Based Configuration

```typescript
interface EnvironmentConfig {
  development: AgentFactoryConfig;
  testing: AgentFactoryConfig;
  production: AgentFactoryConfig;
}

const environmentConfig: EnvironmentConfig = {
  development: {
    domain: 'dev-assistant',
    enableCommands: true,
    enablePrompts: true,
    enableWorkflows: false,
    timeouts: { commandTimeout: 5000, promptTimeout: 15000 }
  },
  testing: {
    domain: 'test-assistant',
    enableCommands: true,
    enablePrompts: false,
    enableWorkflows: false,
    timeouts: { commandTimeout: 1000, promptTimeout: 5000 }
  },
  production: {
    domain: 'prod-assistant', 
    enableCommands: true,
    enablePrompts: true,
    enableWorkflows: true,
    sessionPersistence: true,
    timeouts: { commandTimeout: 30000, promptTimeout: 60000, workflowTimeout: 600000 }
  }
};

// Create agent based on environment
const env = process.env.NODE_ENV || 'development';
const config = environmentConfig[env];

const agent = createAgent(stateManager, {
  ...config,
  classifier: new InputClassifier(),
  // Add environment-specific dependencies
});
```

### 2. Builder Pattern Extension

```typescript
class AgentBuilder {
  private config: Partial<AgentFactoryConfig> = {};
  private stateManager?: IStateManager;

  withStateManager(stateManager: IStateManager): AgentBuilder {
    this.stateManager = stateManager;
    return this;
  }

  withDomain(domain: string): AgentBuilder {
    this.config.domain = domain;
    return this;
  }

  withClassifier(classifier: IClassifier): AgentBuilder {
    this.config.classifier = classifier;
    return this;
  }

  withCommandHandler(handler: ICommandHandler): AgentBuilder {
    this.config.commandHandler = handler;
    return this;
  }

  withPromptHandler(handler: IPromptHandler): AgentBuilder {
    this.config.promptHandler = handler;
    return this;
  }

  withWorkflowEngine(engine: IWorkflowEngine): AgentBuilder {
    this.config.workflowEngine = engine;
    return this;
  }

  enableFeatures(features: {
    commands?: boolean;
    prompts?: boolean;
    workflows?: boolean;
  }): AgentBuilder {
    this.config.enableCommands = features.commands;
    this.config.enablePrompts = features.prompts;
    this.config.enableWorkflows = features.workflows;
    return this;
  }

  withTimeouts(timeouts: {
    command?: number;
    prompt?: number;
    workflow?: number;
  }): AgentBuilder {
    this.config.timeouts = {
      commandTimeout: timeouts.command,
      promptTimeout: timeouts.prompt,
      workflowTimeout: timeouts.workflow
    };
    return this;
  }

  build(): QiCodeAgent {
    if (!this.stateManager) {
      throw new Error('StateManager is required');
    }
    
    if (!this.config.domain) {
      throw new Error('Domain is required');
    }

    return createAgent(this.stateManager, this.config as AgentFactoryConfig);
  }
}

// Usage
const agent = new AgentBuilder()
  .withStateManager(stateManager)
  .withDomain('coding-assistant')
  .withClassifier(new InputClassifier())
  .withCommandHandler(new BuiltInCommandHandler())
  .enableFeatures({ commands: true, prompts: true, workflows: false })
  .withTimeouts({ command: 10000, prompt: 30000 })
  .build();
```

### 3. Configuration File Pattern

```typescript
// agent.config.json
{
  "domain": "qi-code-assistant",
  "features": {
    "commands": true,
    "prompts": true,  
    "workflows": true
  },
  "timeouts": {
    "command": 10000,
    "prompt": 30000,
    "workflow": 300000
  },
  "retries": {
    "maxRetries": 3,
    "retryDelay": 1000
  },
  "providers": {
    "modelProvider": "ollama",
    "toolProvider": "mcp",
    "memoryProvider": "file"
  },
  "sessionPersistence": true
}
```

```typescript
// Configuration loader
import fs from 'fs/promises';

async function loadAgentConfig(configPath?: string): Promise<AgentFactoryConfig> {
  const path = configPath || './agent.config.json';
  
  try {
    const configData = await fs.readFile(path, 'utf-8');
    const config = JSON.parse(configData);
    
    return {
      domain: config.domain,
      enableCommands: config.features?.commands ?? true,
      enablePrompts: config.features?.prompts ?? true,
      enableWorkflows: config.features?.workflows ?? true,
      sessionPersistence: config.sessionPersistence ?? false,
      timeouts: {
        commandTimeout: config.timeouts?.command,
        promptTimeout: config.timeouts?.prompt,
        workflowTimeout: config.timeouts?.workflow
      },
      retries: {
        maxRetries: config.retries?.maxRetries,
        retryDelay: config.retries?.retryDelay
      },
      providers: config.providers
    };
  } catch (error) {
    console.warn(`Failed to load config from ${path}, using defaults`);
    return { domain: 'default-agent' };
  }
}

// Usage
const config = await loadAgentConfig('./config/agent.config.json');
const agent = createAgent(stateManager, {
  ...config,
  classifier: new InputClassifier(),
  // Add runtime dependencies that can't be serialized
});
```

## Dependency Injection Patterns

### 1. Constructor Injection (Current)

```typescript
// Dependencies injected through factory
const agent = createAgent(stateManager, {
  domain: 'assistant',
  classifier: new InputClassifier(),    // Injected
  promptHandler: new PromptHandler(),   // Injected  
  workflowEngine: new WorkflowEngine()  // Injected
});
```

### 2. Service Locator Pattern (Future)

```typescript
interface ServiceLocator {
  resolve<T>(serviceName: string): T;
  register<T>(serviceName: string, service: T): void;
}

class AgentServiceLocator implements ServiceLocator {
  private services = new Map<string, any>();

  register<T>(serviceName: string, service: T): void {
    this.services.set(serviceName, service);
  }

  resolve<T>(serviceName: string): T {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service ${serviceName} not found`);
    }
    return service;
  }
}

// Register services
const serviceLocator = new AgentServiceLocator();
serviceLocator.register('classifier', new InputClassifier());
serviceLocator.register('promptHandler', new OllamaPromptHandler());
serviceLocator.register('workflowEngine', new LangGraphWorkflowEngine());

// Create agent with service locator
function createAgentWithServices(
  stateManager: IStateManager,
  config: AgentConfig,
  serviceLocator: ServiceLocator
): QiCodeAgent {
  
  const dependencies = {
    classifier: serviceLocator.resolve<IClassifier>('classifier'),
    promptHandler: serviceLocator.resolve<IPromptHandler>('promptHandler'),
    workflowEngine: serviceLocator.resolve<IWorkflowEngine>('workflowEngine')
  };

  return new QiCodeAgent(stateManager, config, dependencies);
}
```

### 3. Plugin-Based Injection (Future)

```typescript
interface AgentPlugin {
  name: string;
  version: string;
  dependencies: string[];
  initialize(agent: QiCodeAgent): Promise<void>;
  shutdown(): Promise<void>;
}

class PromptHandlerPlugin implements AgentPlugin {
  name = 'prompt-handler';
  version = '1.0.0';
  dependencies = ['classifier'];

  async initialize(agent: QiCodeAgent): Promise<void> {
    const handler = new OllamaPromptHandler();
    agent.registerHandler('prompt', handler);
  }

  async shutdown(): Promise<void> {
    // Cleanup plugin resources
  }
}

// Plugin-based agent creation
async function createAgentWithPlugins(
  stateManager: IStateManager,
  config: AgentConfig,
  plugins: AgentPlugin[]
): Promise<QiCodeAgent> {
  
  const agent = new QiCodeAgent(stateManager, config);
  
  // Initialize plugins in dependency order
  const sortedPlugins = sortPluginsByDependencies(plugins);
  for (const plugin of sortedPlugins) {
    await plugin.initialize(agent);
  }
  
  return agent;
}
```

## Testing Patterns

### 1. Mock Factory

```typescript
// Create agent with mocked dependencies for testing
function createMockAgent(overrides: Partial<AgentFactoryConfig> = {}): QiCodeAgent {
  const mockStateManager = {
    getCurrentModel: jest.fn().mockReturnValue('mock-model'),
    getCurrentSession: jest.fn().mockReturnValue({ id: 'mock-session' }),
    addConversationEntry: jest.fn()
  } as jest.Mocked<IStateManager>;

  const mockClassifier = {
    classify: jest.fn().mockResolvedValue({
      type: 'prompt',
      confidence: 0.9,
      method: 'mock'
    })
  } as jest.Mocked<IClassifier>;

  return createAgent(mockStateManager, {
    domain: 'test-agent',
    classifier: mockClassifier,
    enableCommands: true,
    enablePrompts: false,
    enableWorkflows: false,
    ...overrides
  });
}

// Usage in tests
describe('Agent Factory', () => {
  test('should create agent with mocked dependencies', async () => {
    const agent = createMockAgent();
    await agent.initialize();
    
    expect(agent.getStatus().isInitialized).toBe(true);
    expect(agent.getStatus().domain).toBe('test-agent');
  });
});
```

### 2. Test Configuration Factory

```typescript
// Test-specific configurations
const testConfigurations = {
  minimal: {
    domain: 'test-minimal',
    enableCommands: true,
    enablePrompts: false,
    enableWorkflows: false
  },
  
  commandsOnly: {
    domain: 'test-commands',
    enableCommands: true,
    enablePrompts: false,
    enableWorkflows: false,
    classifier: new InputClassifier()
  },
  
  fullFeatures: {
    domain: 'test-full',
    enableCommands: true,
    enablePrompts: true,
    enableWorkflows: true,
    classifier: new InputClassifier(),
    commandHandler: new MockCommandHandler(),
    promptHandler: new MockPromptHandler(),
    workflowEngine: new MockWorkflowEngine()
  }
};

function createTestAgent(
  configName: keyof typeof testConfigurations,
  stateManager?: IStateManager
): QiCodeAgent {
  
  const mockStateManager = stateManager || createMockStateManager();
  const config = testConfigurations[configName];
  
  return createAgent(mockStateManager, config);
}
```

## Performance Patterns

### 1. Lazy Initialization

```typescript
class LazyAgentFactory {
  private agentCache = new Map<string, QiCodeAgent>();
  
  createAgent(
    key: string,
    stateManager: IStateManager,
    config: AgentFactoryConfig
  ): QiCodeAgent {
    
    // Return cached agent if available
    const cached = this.agentCache.get(key);
    if (cached) {
      return cached;
    }
    
    // Create new agent
    const agent = createAgent(stateManager, config);
    this.agentCache.set(key, agent);
    
    return agent;
  }
  
  clearCache(): void {
    this.agentCache.clear();
  }
}
```

### 2. Dependency Caching

```typescript
class DependencyCache {
  private static classifierCache = new WeakMap<any, IClassifier>();
  private static handlerCache = new WeakMap<any, ICommandHandler>();
  
  static getCachedClassifier(config: any): IClassifier {
    let classifier = this.classifierCache.get(config);
    if (!classifier) {
      classifier = new InputClassifier(config);
      this.classifierCache.set(config, classifier);
    }
    return classifier;
  }
  
  static getCachedHandler(config: any): ICommandHandler {
    let handler = this.handlerCache.get(config);
    if (!handler) {
      handler = new BuiltInCommandHandler(config);
      this.handlerCache.set(config, handler);
    }
    return handler;
  }
}

// Usage with cached dependencies
const agent = createAgent(stateManager, {
  domain: 'cached-agent',
  classifier: DependencyCache.getCachedClassifier(classifierConfig),
  commandHandler: DependencyCache.getCachedHandler(handlerConfig)
});
```

## Error Handling Patterns

### 1. Validation in Factory

```typescript
function createAgent(
  stateManager: IStateManager,
  config: AgentFactoryConfig
): QiCodeAgent {
  
  // Validate required parameters
  if (!stateManager) {
    throw new Error('StateManager is required for agent creation');
  }
  
  if (!config.domain) {
    throw new Error('Agent domain must be specified');
  }
  
  // Validate configuration consistency
  if (config.enablePrompts && !config.classifier) {
    console.warn('Prompt processing enabled but no classifier provided - prompts may fail');
  }
  
  if (config.enableWorkflows && (!config.workflowEngine || !config.workflowExtractor)) {
    console.warn('Workflow processing enabled but components missing - workflows will fail');
  }
  
  // Create agent with validated configuration
  return new QiCodeAgent(stateManager, extractAgentConfig(config), extractDependencies(config));
}
```

### 2. Factory Error Recovery

```typescript
function createAgentWithFallback(
  stateManager: IStateManager,
  config: AgentFactoryConfig
): QiCodeAgent {
  
  try {
    // Try to create fully configured agent
    return createAgent(stateManager, config);
  } catch (error) {
    console.warn(`Failed to create full agent: ${error.message}, falling back to minimal configuration`);
    
    // Fallback to minimal agent
    return createAgent(stateManager, {
      domain: config.domain || 'fallback-agent',
      classifier: new InputClassifier(), // Always provide classifier
      enableCommands: true,
      enablePrompts: false,
      enableWorkflows: false
    });
  }
}
```

---

The factory pattern provides flexible, testable, and maintainable agent creation while supporting various configuration patterns and use cases. It enables clear separation between agent construction and business logic while providing consistent dependency injection across the application.