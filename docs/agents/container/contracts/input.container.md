# Input Container Interface Contract

## Container Overview

The Input Container provides the user interaction interface for the qi-v2-agent system. The CLI implementation serves as the primary interface, handling raw user commands and text input.

## Interface Definition

### Core Interface
```typescript
interface InputContainer extends Agent<RawInput, ParsedRequest> {
  // Core processing
  process(input: RawInput): Promise<ParsedRequest>;
  
  // Command handling
  handleCommand(command: string[]): CommandResult;
  
  // Mode management
  selectMode(mode: CognitiveMode): void;
  cycleMode(): CognitiveMode;
  getCurrentMode(): CognitiveMode;
  
  // Session management
  initializeSession(): SessionContext;
  terminateSession(): void;
  
  // Validation
  validate(input: RawInput): ValidationResult;
  getCapabilities(): InputContainerCapabilities;
}
```

### Input Types
```typescript
interface RawInput {
  commandLine: string[];
  text?: string;
  options?: CommandOptions;
  environment?: EnvironmentContext;
}

interface CommandOptions {
  mode?: CognitiveMode;
  verbose?: boolean;
  help?: boolean;
  version?: boolean;
  config?: string;
}

interface EnvironmentContext {
  workingDirectory: string;
  environmentVariables: Record<string, string>;
  terminalInfo?: TerminalInfo;
}
```

### Output Types
```typescript
interface ParsedRequest {
  commandType: CommandType;
  userText?: string;
  currentMode?: CognitiveMode;
  context: SessionContext;
  options: ProcessedOptions;
}

type CommandType = 'static' | 'interactive' | 'workflow';

interface SessionContext {
  sessionId: string;
  userId?: string;
  currentMode: CognitiveMode;
  conversationHistory: ConversationEntry[];
  preferences: UserPreferences;
}

interface ProcessedOptions {
  explicitMode?: CognitiveMode;
  outputFormat?: 'text' | 'json' | 'markdown';
  verbose: boolean;
  debug: boolean;
}
```

## Command Classification

### Static Commands
Commands handled entirely within the Input Container:
```typescript
interface StaticCommand {
  pattern: string | RegExp;
  handler: (args: string[]) => CommandResult;
  description: string;
}

// Examples:
const staticCommands: StaticCommand[] = [
  { pattern: '--help', handler: showHelp, description: 'Show help information' },
  { pattern: '--version', handler: showVersion, description: 'Show version' },
  { pattern: 'config --show', handler: showConfig, description: 'Display configuration' },
  { pattern: 'servers --list', handler: listServers, description: 'List MCP servers' },
  { pattern: '/exit', handler: exitSession, description: 'Exit session' }
];
```

### Interactive Commands
Commands requiring pattern recognition and workflow execution:
```typescript
interface InteractiveCommand {
  userInput: string;
  requiresPatternRecognition: true;
  requiresWorkflowExecution: true;
}

// Examples:
// qi unified
// qi chat
// qi "analyze this architecture"
```

### Workflow Commands
Commands with pre-defined workflows:
```typescript
interface WorkflowCommand {
  command: string;
  workflowType: string;
  parameters: WorkflowParameters;
}

// Examples:
// qi edit file.js "fix bug"
// qi analyze src/
// qi explain "dependency injection"
```

## Mode Management

### Mode Selection Patterns
```typescript
interface ModeSelection {
  // Explicit flag-based selection
  explicitMode(mode: CognitiveMode): void;
  
  // Interactive cycling (Ctrl+Tab)
  cycleMode(): CognitiveMode;
  
  // Auto-detection via Pattern Recognition Container
  detectMode(userInput: string, currentMode?: CognitiveMode): Promise<CognitiveMode>;
}

// Mode cycling order
const MODE_CYCLE_ORDER: CognitiveMode[] = [
  'generic',
  'planning', 
  'coding',
  'information',
  'debugging'
];
```

### Mode Context Persistence
```typescript
interface ModeContext {
  currentMode: CognitiveMode;
  modeHistory: ModeHistoryEntry[];
  autoDetectionEnabled: boolean;
  explicitModeOverride?: CognitiveMode;
}

interface ModeHistoryEntry {
  mode: CognitiveMode;
  timestamp: Date;
  trigger: 'explicit' | 'auto-detection' | 'cycling';
  confidence?: number;
}
```

## Error Handling

### Input Validation Errors
```typescript
interface InputValidationError extends Error {
  type: 'validation';
  field: keyof RawInput;
  reason: string;
  suggestion?: string;
}

// Example validation rules
const validationRules = {
  commandLine: (cmd: string[]) => cmd.length > 0,
  text: (text?: string) => !text || text.length <= 10000,
  mode: (mode?: CognitiveMode) => !mode || VALID_MODES.includes(mode)
};
```

### Command Processing Errors
```typescript
interface CommandProcessingError extends Error {
  type: 'command_processing';
  command: string;
  stage: 'parsing' | 'validation' | 'routing';
  recovery?: RecoveryAction;
}

interface RecoveryAction {
  type: 'suggest_alternative' | 'request_clarification' | 'fallback_mode';
  suggestion: string;
}
```

### Container Integration Errors
```typescript
interface ContainerIntegrationError extends Error {
  type: 'container_integration';
  targetContainer: 'pattern_recognition' | 'workflow_executor';
  operation: string;
  retryable: boolean;
}
```

## Performance Requirements

### Response Time Targets
- **Command Parsing**: < 50ms
- **Mode Selection**: < 10ms (explicit), < 300ms (via Pattern Recognition)
- **Session Initialization**: < 100ms
- **UI Rendering**: 16ms frame rate for smooth streaming

### Memory Usage
- **Session Context**: < 10MB per active session
- **Command History**: < 1MB per session
- **Mode State**: < 1KB per session

### Throughput
- **Commands per Second**: 100+ for static commands
- **Concurrent Sessions**: 50+ simultaneous sessions
- **Memory per Session**: < 50MB total

## CLI Implementation Specifics

### Command Line Interface
```typescript
interface CLIImplementation extends InputContainer {
  // CLI-specific methods
  renderOutput(output: string | UIComponent): void;
  captureInput(): Promise<string>;
  displayProgress(progress: ProgressInfo): void;
  
  // Terminal integration
  setupTerminal(): void;
  configureColors(): void;
  handleSignals(): void;
}

interface UIComponent {
  type: 'text' | 'table' | 'progress' | 'interactive';
  content: any;
  style?: UIStyle;
}
```

### Keyboard Shortcuts
```typescript
interface KeyboardShortcuts {
  'Ctrl+Tab': () => cycleMode();
  'Ctrl+C': () => interruptOperation();
  'Ctrl+D': () => exitSession();
  'Ctrl+L': () => clearScreen();
  'Up Arrow': () => previousCommand();
  'Down Arrow': () => nextCommand();
}
```

## Configuration

### Container Configuration
```typescript
interface InputContainerConfig {
  // Mode settings
  defaultMode: CognitiveMode;
  autoModeDetection: boolean;
  modeDisplayInPrompt: boolean;
  
  // Session settings
  sessionTimeout: number; // milliseconds
  maxHistoryEntries: number;
  persistSessionHistory: boolean;
  
  // UI settings
  colorTheme: 'light' | 'dark' | 'auto';
  promptFormat: string;
  progressIndicator: boolean;
  
  // Integration settings
  patternRecognitionTimeout: number;
  workflowExecutionTimeout: number;
  retryAttempts: number;
}
```

### Environment Variables
```bash
# Mode configuration
QI_DEFAULT_MODE=generic
QI_AUTO_MODE_DETECTION=true

# Session configuration
QI_SESSION_TIMEOUT=3600000
QI_MAX_HISTORY=100

# UI configuration
QI_COLOR_THEME=auto
QI_PROGRESS_INDICATOR=true

# Integration configuration
QI_PATTERN_RECOGNITION_TIMEOUT=5000
QI_WORKFLOW_EXECUTION_TIMEOUT=30000
```

## Testing Contract

### Unit Tests
```typescript
describe('InputContainer', () => {
  describe('command classification', () => {
    it('should classify static commands correctly');
    it('should route interactive commands to pattern recognition');
    it('should identify workflow commands with parameters');
  });
  
  describe('mode management', () => {
    it('should persist mode across interactions');
    it('should cycle through modes in correct order');
    it('should respect explicit mode overrides');
  });
  
  describe('error handling', () => {
    it('should validate input and provide helpful errors');
    it('should recover from container integration failures');
    it('should suggest alternatives for invalid commands');
  });
});
```

### Integration Tests
```typescript
describe('InputContainer Integration', () => {
  it('should communicate with Pattern Recognition Container');
  it('should handle mode detection responses correctly');
  it('should pass session context to downstream containers');
  it('should maintain session state across container calls');
});
```

## Future Implementations

### Web UI Implementation
- HTTP/WebSocket API endpoints
- Browser-based user interface
- Real-time mode switching
- Session persistence via cookies/localStorage

### REST API Implementation
- RESTful endpoints for programmatic access
- API key authentication
- Request/response logging
- Rate limiting

### gRPC Implementation
- Protocol buffer definitions
- Streaming support for real-time interactions
- Service discovery integration
- Load balancing capabilities

All implementations must conform to the InputContainer interface contract while providing implementation-specific optimizations and features.