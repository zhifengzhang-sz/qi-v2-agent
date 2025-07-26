# CLI Container Interface Contract

## Overview

The CLI Container is responsible for command-line argument parsing, user interface rendering, and managing the user interaction lifecycle. It serves as the entry point and orchestrator for all user commands.

## Container Responsibilities

- **Command Parsing**: Parse command-line arguments, flags, and options
- **User Interface**: Render terminal UI (static output or interactive components)
- **User Input**: Capture and process user input in interactive mode
- **Lifecycle Management**: Initialize, execute, and cleanup command sessions
- **Error Handling**: Present user-friendly error messages and recovery options

## Public API Interface

### ICommandLineInterface

```typescript
interface ICommandLineInterface {
  /**
   * Parse and execute a command
   * @param args Command line arguments (e.g., process.argv)
   * @returns Promise that resolves when command completes
   */
  execute(args: string[]): Promise<CommandResult>;
  
  /**
   * Get available commands and their descriptions
   * @returns Map of command names to descriptions
   */
  getAvailableCommands(): Map<string, CommandDefinition>;
  
  /**
   * Register a new command handler
   * @param command Command definition and handler
   */
  registerCommand(command: CommandDefinition): void;
}

interface CommandResult {
  success: boolean;
  exitCode: number;
  message?: string;
  data?: any;
}

interface CommandDefinition {
  name: string;
  description: string;
  options: CommandOption[];
  handler: CommandHandler;
}

interface CommandOption {
  name: string;
  alias?: string;
  description: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean';
  default?: any;
}

type CommandHandler = (options: CommandOptions) => Promise<CommandResult>;
```

## Configuration Contract

### CLIConfig

```typescript
interface CLIConfig {
  /**
   * Application metadata
   */
  app: {
    name: string;
    version: string;
    description: string;
  };
  
  /**
   * UI configuration
   */
  ui: {
    theme: 'light' | 'dark';
    progressIndicators: boolean;
    showTimestamps: boolean;
    interruptSignals: string[];  // e.g., ['SIGINT', 'SIGTERM']
  };
  
  /**
   * Smart Router container connection
   */
  smartRouter: {
    connectionTimeout: number;    // milliseconds
    responseTimeout: number;      // milliseconds
    retryAttempts: number;
  };
  
  /**
   * Command-specific settings
   */
  commands: {
    [commandName: string]: CommandConfig;
  };
}

interface CommandConfig {
  enabled: boolean;
  defaultOptions?: Record<string, any>;
  timeout?: number;
}
```

## Integration with Smart Router Container

### ISmartRouterClient

The CLI Container communicates with the Smart Router Container through this interface:

```typescript
interface ISmartRouterClient {
  /**
   * Initialize connection to Smart Router
   * @param config Smart Router configuration
   */
  initialize(config: SmartRouterConfig): Promise<void>;
  
  /**
   * Send message for processing
   * @param messages Conversation messages
   * @param options Processing options
   * @returns Streaming response
   */
  processMessage(
    messages: Message[], 
    options: ProcessingOptions
  ): AsyncIterableIterator<ResponseChunk>;
  
  /**
   * Get available tools and capabilities
   * @returns List of available tools
   */
  getCapabilities(): Promise<Capability[]>;
  
  /**
   * Health check
   * @returns Health status
   */
  healthCheck(): Promise<HealthStatus>;
  
  /**
   * Cleanup resources
   */
  cleanup(): Promise<void>;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface ProcessingOptions {
  threadId?: string;
  timeout?: number;
  stream?: boolean;
}

interface ResponseChunk {
  type: 'token' | 'tool_call' | 'status' | 'complete';
  content: string;
  metadata?: Record<string, any>;
}

interface Capability {
  name: string;
  description: string;
  parameters: Parameter[];
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  details: Record<string, any>;
}
```

## Command Types and Patterns

### Static Commands

Commands that execute once and exit:

```typescript
interface IStaticCommand {
  execute(options: CommandOptions): Promise<CommandResult>;
}

// Examples: qi config --show, qi servers --list
```

### Interactive Commands  

Commands that launch persistent UI:

```typescript
interface IInteractiveCommand {
  start(options: CommandOptions): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
}

// Examples: qi unified, qi chat
```

### Workflow Commands

Commands that execute predefined workflows:

```typescript
interface IWorkflowCommand {
  execute(
    workflow: WorkflowDefinition, 
    options: CommandOptions
  ): Promise<CommandResult>;
}

interface WorkflowDefinition {
  name: string;
  steps: WorkflowStep[];
  timeout: number;
}

// Examples: qi edit file.js "fix bug", qi analyze --complexity
```

## Error Handling Contract

### CLIError

```typescript
interface CLIError {
  code: string;
  message: string;
  details?: Record<string, any>;
  recovery?: RecoveryAction[];
}

interface RecoveryAction {
  description: string;
  command: string;
}

// Error categories:
enum ErrorCategory {
  PARSE_ERROR = 'PARSE_ERROR',           // Invalid command syntax
  CONFIG_ERROR = 'CONFIG_ERROR',         // Configuration issues
  CONNECTION_ERROR = 'CONNECTION_ERROR', // Smart Router communication
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',       // Operation timeout
  USER_ERROR = 'USER_ERROR'              // User input issues
}
```

## Lifecycle Events

### Event Contract

```typescript
interface CLIEvents {
  'command:start': (command: string, options: CommandOptions) => void;
  'command:complete': (command: string, result: CommandResult) => void;
  'command:error': (command: string, error: CLIError) => void;
  'ui:ready': () => void;
  'ui:exit': (exitCode: number) => void;
  'smartrouter:connected': () => void;
  'smartrouter:disconnected': () => void;
}
```

## Implementation Requirements

### Non-Functional Requirements

- **Performance**: Commands should start within 200ms for static, 2s for interactive
- **Memory**: Maximum 50MB memory usage for CLI operations
- **Reliability**: Graceful degradation when Smart Router is unavailable
- **Usability**: Clear error messages with actionable recovery steps

### Integration Requirements

- **Framework Agnostic**: Interface should work with Commander.js, yargs, or custom parsers
- **UI Agnostic**: Support both console output and rich terminal UI (Ink, blessed, etc.)
- **Platform Support**: Cross-platform compatibility (Windows, macOS, Linux)

## Current Implementation Gaps

### Missing Abstractions

The current implementation lacks these interface abstractions:

1. **ICommandLineInterface** - Currently using Commander.js directly
2. **ISmartRouterClient** - Currently using AgentFactory directly  
3. **Command pattern interfaces** - Each command implements its own pattern
4. **Error handling** - No standardized error contract

### Proposed Refactoring

```typescript
// Current: Direct implementation
program.command('unified').action(async (options) => {
  const agent = new AgentFactory(config);
  render(SimpleChatApp({ agentFactory: agent }));
});

// Proposed: Interface-based
const cliContainer = new CLIContainer(config);
const smartRouterClient = new SmartRouterClient(config.smartRouter);

const unifiedCommand = new InteractiveCommand({
  name: 'unified',
  smartRouterClient,
  uiRenderer: new InkRenderer()
});

cliContainer.registerCommand(unifiedCommand);
```

This refactoring would enable:
- **Container substitution**: Replace CLI or Smart Router implementations
- **Testing**: Mock Smart Router for CLI testing
- **Configuration**: Standardized configuration contracts
- **Error handling**: Consistent error handling across commands