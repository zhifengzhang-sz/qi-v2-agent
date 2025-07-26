# Interactive Command Handler Component Interface

## Overview

The Interactive Command Handler Component manages long-running conversational sessions where users can interact with the AI assistant through natural language. It handles session lifecycle, user input processing, and real-time streaming responses from the Smart Router Container.

## Component Responsibilities

- **Session Management**: Create, maintain, and destroy interactive chat sessions
- **Input Processing**: Capture and validate user input in real-time
- **Response Streaming**: Handle and display streaming responses from Smart Router
- **Context Preservation**: Maintain conversation context across interactions
- **UI State Management**: Manage interactive UI components and state

## Public Interface

### IInteractiveCommandHandler

```typescript
interface IInteractiveCommandHandler extends ICommandHandler {
  /**
   * Initialize interactive command handler
   * @param config Handler configuration
   */
  initialize(config: InteractiveHandlerConfig): Promise<void>;
  
  /**
   * Start interactive session
   * @param command Initial command that triggered interactive mode
   * @param context Execution context
   * @returns Session handle for management
   */
  startSession(command: ParsedCommand, context: ExecutionContext): Promise<InteractiveSession>;
  
  /**
   * Process user input in active session
   * @param sessionId Session identifier
   * @param input User input message
   * @returns Response stream
   */
  processInput(sessionId: string, input: string): AsyncIterableIterator<ResponseChunk>;
  
  /**
   * End interactive session
   * @param sessionId Session to terminate
   * @param reason Termination reason
   */
  endSession(sessionId: string, reason: SessionEndReason): Promise<void>;
  
  /**
   * Get active sessions
   * @returns List of currently active sessions
   */
  getActiveSessions(): InteractiveSession[];
  
  /**
   * Get session state
   * @param sessionId Session identifier
   * @returns Current session state
   */
  getSessionState(sessionId: string): SessionState;
  
  /**
   * Save session to persistent storage
   * @param sessionId Session to save
   * @param location Storage location
   */
  saveSession(sessionId: string, location: string): Promise<void>;
  
  /**
   * Load session from persistent storage
   * @param location Storage location
   * @returns Restored session
   */
  loadSession(location: string): Promise<InteractiveSession>;
}
```

## Data Contracts

### Session Management

```typescript
interface InteractiveSession {
  /**
   * Unique session identifier
   */
  id: string;
  
  /**
   * Session metadata
   */
  metadata: SessionMetadata;
  
  /**
   * Current session state
   */
  state: SessionState;
  
  /**
   * Conversation history
   */
  conversation: ConversationHistory;
  
  /**
   * Session configuration
   */
  config: SessionConfig;
  
  /**
   * Session metrics
   */
  metrics: SessionMetrics;
}

interface SessionMetadata {
  /**
   * Session creation time
   */
  createdAt: Date;
  
  /**
   * Last activity time
   */
  lastActivity: Date;
  
  /**
   * Session name/title
   */
  title: string;
  
  /**
   * User identifier
   */
  userId?: string;
  
  /**
   * Session tags for organization
   */
  tags: string[];
  
  /**
   * Initial command that started session
   */
  initialCommand: ParsedCommand;
}

enum SessionState {
  INITIALIZING = 'initializing',
  ACTIVE = 'active',
  WAITING_INPUT = 'waiting_input',
  PROCESSING = 'processing',
  PAUSED = 'paused',
  ENDING = 'ending',
  ENDED = 'ended',
  ERROR = 'error'
}

interface ConversationHistory {
  /**
   * Message thread
   */
  messages: ConversationMessage[];
  
  /**
   * Total message count
   */
  messageCount: number;
  
  /**
   * Conversation context
   */
  context: ConversationContext;
  
  /**
   * Summary of conversation so far
   */
  summary?: string;
}

interface ConversationMessage {
  /**
   * Message identifier
   */
  id: string;
  
  /**
   * Message timestamp
   */
  timestamp: Date;
  
  /**
   * Message role
   */
  role: MessageRole;
  
  /**
   * Message content
   */
  content: string;
  
  /**
   * Message metadata
   */
  metadata: MessageMetadata;
  
  /**
   * Message status
   */
  status: MessageStatus;
}

enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system'
}

interface MessageMetadata {
  /**
   * Message source
   */
  source: MessageSource;
  
  /**
   * Processing time (ms)
   */
  processingTime?: number;
  
  /**
   * Token count
   */
  tokens?: number;
  
  /**
   * Tools used for response
   */
  toolsUsed?: string[];
  
  /**
   * Confidence score
   */
  confidence?: number;
}

enum MessageSource {
  DIRECT_INPUT = 'direct_input',
  SMART_ROUTER = 'smart_router',
  SYSTEM_GENERATED = 'system_generated',
  ERROR_HANDLER = 'error_handler'
}

enum MessageStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

interface ConversationContext {
  /**
   * Current working directory
   */
  workingDirectory: string;
  
  /**
   * Active files in context
   */
  activeFiles: string[];
  
  /**
   * Environment variables
   */
  environment: Record<string, string>;
  
  /**
   * Session variables
   */
  variables: Record<string, any>;
  
  /**
   * Recent tool outputs
   */
  toolOutputs: ToolOutput[];
}

interface ToolOutput {
  /**
   * Tool name
   */
  toolName: string;
  
  /**
   * Output data
   */
  output: any;
  
  /**
   * Output timestamp
   */
  timestamp: Date;
  
  /**
   * Success status
   */
  success: boolean;
}

enum SessionEndReason {
  USER_EXIT = 'user_exit',
  TIMEOUT = 'timeout',
  ERROR = 'error',
  SYSTEM_SHUTDOWN = 'system_shutdown',
  RESOURCE_LIMIT = 'resource_limit'
}
```

### Response Streaming

```typescript
interface ResponseChunk {
  /**
   * Chunk identifier
   */
  id: string;
  
  /**
   * Chunk type
   */
  type: ChunkType;
  
  /**
   * Chunk content
   */
  content: string;
  
  /**
   * Chunk metadata
   */
  metadata: ChunkMetadata;
  
  /**
   * Chunk timestamp
   */
  timestamp: Date;
}

enum ChunkType {
  TEXT = 'text',
  STATUS = 'status',
  TOOL_START = 'tool_start',
  TOOL_OUTPUT = 'tool_output',
  TOOL_END = 'tool_end',
  ERROR = 'error',
  COMPLETE = 'complete',
  THINKING = 'thinking'
}

interface ChunkMetadata {
  /**
   * Message ID this chunk belongs to
   */
  messageId: string;
  
  /**
   * Sequence number within message
   */
  sequence: number;
  
  /**
   * Whether this is the final chunk
   */
  final: boolean;
  
  /**
   * Processing source
   */
  source: string;
  
  /**
   * Additional metadata
   */
  [key: string]: any;
}

interface StreamingState {
  /**
   * Whether currently streaming
   */
  isStreaming: boolean;
  
  /**
   * Current message being streamed
   */
  currentMessageId?: string;
  
  /**
   * Stream start time
   */
  streamStartTime?: Date;
  
  /**
   * Chunks received
   */
  chunksReceived: number;
  
  /**
   * Total content length
   */
  contentLength: number;
  
  /**
   * Streaming performance metrics
   */
  streamingMetrics: StreamingMetrics;
}

interface StreamingMetrics {
  /**
   * Average chunk size
   */
  averageChunkSize: number;
  
  /**
   * Chunks per second
   */
  chunksPerSecond: number;
  
  /**
   * Latency statistics
   */
  latency: LatencyStats;
  
  /**
   * Throughput statistics
   */
  throughput: ThroughputStats;
}

interface LatencyStats {
  /**
   * First chunk latency (ms)
   */
  firstChunk: number;
  
  /**
   * Average inter-chunk latency (ms)
   */
  averageInterChunk: number;
  
  /**
   * Maximum latency (ms)
   */
  maximum: number;
  
  /**
   * 95th percentile latency (ms)
   */
  p95: number;
}

interface ThroughputStats {
  /**
   * Tokens per second
   */
  tokensPerSecond: number;
  
  /**
   * Characters per second
   */
  charactersPerSecond: number;
  
  /**
   * Peak throughput
   */
  peak: number;
  
  /**
   * Average throughput
   */
  average: number;
}
```

### Input Processing

```typescript
interface InputProcessor {
  /**
   * Process raw user input
   * @param input Raw input string
   * @param context Current context
   * @returns Processed input
   */
  processInput(input: string, context: InputContext): Promise<ProcessedInput>;
  
  /**
   * Validate input
   * @param input Input to validate
   * @returns Validation result
   */
  validateInput(input: string): InputValidationResult;
  
  /**
   * Get input suggestions
   * @param partial Partial input
   * @param context Current context
   * @returns Input suggestions
   */
  getSuggestions(partial: string, context: InputContext): Promise<InputSuggestion[]>;
}

interface ProcessedInput {
  /**
   * Original raw input
   */
  raw: string;
  
  /**
   * Processed/normalized input
   */
  processed: string;
  
  /**
   * Input metadata
   */
  metadata: InputMetadata;
  
  /**
   * Input validation result
   */
  validation: InputValidationResult;
}

interface InputContext {
  /**
   * Current session
   */
  session: InteractiveSession;
  
  /**
   * Recent conversation
   */
  recentMessages: ConversationMessage[];
  
  /**
   * Available commands
   */
  availableCommands: string[];
  
  /**
   * Environment state
   */
  environment: Record<string, any>;
}

interface InputMetadata {
  /**
   * Input length
   */
  length: number;
  
  /**
   * Input language (if detected)
   */
  language?: string;
  
  /**
   * Intent classification
   */
  intent?: InputIntent;
  
  /**
   * Processing timestamp
   */
  processedAt: Date;
}

interface InputIntent {
  /**
   * Detected intent
   */
  intent: string;
  
  /**
   * Intent confidence
   */
  confidence: number;
  
  /**
   * Intent parameters
   */
  parameters: Record<string, any>;
}

interface InputValidationResult {
  /**
   * Whether input is valid
   */
  valid: boolean;
  
  /**
   * Validation errors
   */
  errors: InputError[];
  
  /**
   * Validation warnings
   */
  warnings: string[];
  
  /**
   * Suggested corrections
   */
  suggestions: string[];
}

interface InputError {
  /**
   * Error code
   */
  code: InputErrorCode;
  
  /**
   * Error message
   */
  message: string;
  
  /**
   * Error position in input
   */
  position?: number;
  
  /**
   * Suggested fix
   */
  suggestion?: string;
}

enum InputErrorCode {
  EMPTY_INPUT = 'EMPTY_INPUT',
  TOO_LONG = 'TOO_LONG',
  INVALID_CHARACTERS = 'INVALID_CHARACTERS',
  RATE_LIMITED = 'RATE_LIMITED',
  CONTEXT_ERROR = 'CONTEXT_ERROR'
}

interface InputSuggestion {
  /**
   * Suggested text
   */
  text: string;
  
  /**
   * Suggestion description
   */
  description: string;
  
  /**
   * Suggestion type
   */
  type: SuggestionType;
  
  /**
   * Relevance score
   */
  relevance: number;
}

enum SuggestionType {
  COMMAND = 'command',
  FILE_PATH = 'file_path',
  VARIABLE = 'variable',
  HISTORY = 'history',
  TEMPLATE = 'template'
}
```

## Configuration Contract

### InteractiveHandlerConfig

```typescript
interface InteractiveHandlerConfig {
  /**
   * Session management settings
   */
  session: SessionManagementConfig;
  
  /**
   * Input processing configuration
   */
  input: InputProcessingConfig;
  
  /**
   * Response streaming configuration
   */
  streaming: ResponseStreamingConfig;
  
  /**
   * UI interaction settings
   */
  ui: UIInteractionConfig;
  
  /**
   * Performance and resource limits
   */
  performance: InteractivePerformanceConfig;
}

interface SessionManagementConfig {
  /**
   * Maximum concurrent sessions
   */
  maxConcurrentSessions: number;
  
  /**
   * Session timeout (ms)
   */
  sessionTimeout: number;
  
  /**
   * Session idle timeout (ms)
   */
  idleTimeout: number;
  
  /**
   * Whether to auto-save sessions
   */
  autoSave: boolean;
  
  /**
   * Auto-save interval (ms)
   */
  autoSaveInterval: number;
  
  /**
   * Maximum conversation history length
   */
  maxHistoryLength: number;
  
  /**
   * Session storage configuration
   */
  storage: SessionStorageConfig;
}

interface SessionStorageConfig {
  /**
   * Storage type
   */
  type: StorageType;
  
  /**
   * Storage location
   */
  location: string;
  
  /**
   * Encryption settings
   */
  encryption: EncryptionConfig;
  
  /**
   * Retention policy
   */
  retention: RetentionPolicy;
}

enum StorageType {
  MEMORY = 'memory',
  FILE_SYSTEM = 'file_system',
  DATABASE = 'database'
}

interface EncryptionConfig {
  /**
   * Whether to encrypt stored sessions
   */
  enabled: boolean;
  
  /**
   * Encryption algorithm
   */
  algorithm: string;
  
  /**
   * Key derivation method
   */
  keyDerivation: string;
}

interface RetentionPolicy {
  /**
   * Maximum age for stored sessions (ms)
   */
  maxAge: number;
  
  /**
   * Maximum number of stored sessions
   */
  maxSessions: number;
  
  /**
   * Cleanup interval (ms)
   */
  cleanupInterval: number;
}

interface InputProcessingConfig {
  /**
   * Input validation settings
   */
  validation: InputValidationConfig;
  
  /**
   * Input preprocessing settings
   */
  preprocessing: InputPreprocessingConfig;
  
  /**
   * Rate limiting configuration
   */
  rateLimiting: RateLimitingConfig;
  
  /**
   * Auto-completion settings
   */
  autoCompletion: AutoCompletionConfig;
}

interface InputValidationConfig {
  /**
   * Maximum input length
   */
  maxLength: number;
  
  /**
   * Minimum input length
   */
  minLength: number;
  
  /**
   * Allowed characters regex
   */
  allowedCharacters: string;
  
  /**
   * Whether to sanitize input
   */
  sanitize: boolean;
}

interface InputPreprocessingConfig {
  /**
   * Whether to trim whitespace
   */
  trimWhitespace: boolean;
  
  /**
   * Whether to normalize unicode
   */
  normalizeUnicode: boolean;
  
  /**
   * Whether to expand abbreviations
   */
  expandAbbreviations: boolean;
  
  /**
   * Custom preprocessing rules
   */
  customRules: PreprocessingRule[];
}

interface PreprocessingRule {
  /**
   * Rule name
   */
  name: string;
  
  /**
   * Pattern to match
   */
  pattern: string;
  
  /**
   * Replacement string
   */
  replacement: string;
  
  /**
   * Rule priority
   */
  priority: number;
}

interface RateLimitingConfig {
  /**
   * Whether to enable rate limiting
   */
  enabled: boolean;
  
  /**
   * Maximum requests per minute
   */
  requestsPerMinute: number;
  
  /**
   * Burst allowance
   */
  burstLimit: number;
  
  /**
   * Rate limit reset interval (ms)
   */
  resetInterval: number;
}

interface AutoCompletionConfig {
  /**
   * Whether to enable auto-completion
   */
  enabled: boolean;
  
  /**
   * Minimum characters before suggestions
   */
  minChars: number;
  
  /**
   * Maximum suggestions to show
   */
  maxSuggestions: number;
  
  /**
   * Suggestion sources
   */
  sources: SuggestionSource[];
}

enum SuggestionSource {
  COMMAND_HISTORY = 'command_history',
  FILE_PATHS = 'file_paths',
  BUILT_IN_COMMANDS = 'built_in_commands',
  CONTEXT_VARIABLES = 'context_variables'
}

interface ResponseStreamingConfig {
  /**
   * Streaming buffer size
   */
  bufferSize: number;
  
  /**
   * Chunk delivery interval (ms)
   */
  chunkInterval: number;
  
  /**
   * Maximum streaming timeout (ms)
   */
  streamingTimeout: number;
  
  /**
   * Whether to batch small chunks
   */
  batchSmallChunks: boolean;
  
  /**
   * Minimum chunk size for batching
   */
  minChunkSize: number;
}

interface UIInteractionConfig {
  /**
   * Terminal interaction settings
   */
  terminal: TerminalConfig;
  
  /**
   * Display preferences
   */
  display: DisplayConfig;
  
  /**
   * Input capture settings
   */
  inputCapture: InputCaptureConfig;
  
  /**
   * Keyboard shortcuts
   */
  shortcuts: KeyboardShortcuts;
}

interface TerminalConfig {
  /**
   * Whether to use raw mode
   */
  rawMode: boolean;
  
  /**
   * Whether to capture ctrl+c
   */
  captureCtrlC: boolean;
  
  /**
   * Terminal encoding
   */
  encoding: string;
  
  /**
   * ANSI color support
   */
  colorSupport: boolean;
}

interface DisplayConfig {
  /**
   * Whether to show typing indicators
   */
  showTypingIndicator: boolean;
  
  /**
   * Whether to show message timestamps
   */
  showTimestamps: boolean;
  
  /**
   * Whether to show token counts
   */
  showTokenCounts: boolean;
  
  /**
   * Message display format
   */
  messageFormat: MessageDisplayFormat;
}

enum MessageDisplayFormat {
  SIMPLE = 'simple',
  DETAILED = 'detailed',
  COMPACT = 'compact',
  DEBUG = 'debug'
}

interface InputCaptureConfig {
  /**
   * Input timeout (ms)
   */
  timeout: number;
  
  /**
   * Whether to echo input
   */
  echo: boolean;
  
  /**
   * Line editing support
   */
  lineEditing: boolean;
  
  /**
   * History size
   */
  historySize: number;
}

interface KeyboardShortcuts {
  /**
   * Exit session shortcut
   */
  exit: string;
  
  /**
   * Clear screen shortcut
   */
  clear: string;
  
  /**
   * Show help shortcut
   */
  help: string;
  
  /**
   * Save session shortcut
   */
  save: string;
  
  /**
   * Custom shortcuts
   */
  custom: Record<string, string>;
}

interface InteractivePerformanceConfig {
  /**
   * Memory limit per session (bytes)
   */
  memoryLimitPerSession: number;
  
  /**
   * Maximum processing time per input (ms)
   */
  maxProcessingTime: number;
  
  /**
   * Resource monitoring interval (ms)
   */
  monitoringInterval: number;
  
  /**
   * Performance metrics collection
   */
  metricsCollection: MetricsCollectionConfig;
}

interface MetricsCollectionConfig {
  /**
   * Whether to collect metrics
   */
  enabled: boolean;
  
  /**
   * Metrics sampling rate
   */
  samplingRate: number;
  
  /**
   * Metrics retention period (ms)
   */
  retentionPeriod: number;
  
  /**
   * Metrics export configuration
   */
  export: MetricsExportConfig;
}

interface MetricsExportConfig {
  /**
   * Whether to export metrics
   */
  enabled: boolean;
  
  /**
   * Export format
   */
  format: 'json' | 'csv' | 'prometheus';
  
  /**
   * Export interval (ms)
   */
  interval: number;
  
  /**
   * Export destination
   */
  destination: string;
}
```

## Implementation Strategies

### Session Manager Implementation

```typescript
class InteractiveCommandHandler implements IInteractiveCommandHandler {
  private sessions: Map<string, InteractiveSession>;
  private smartRouterClient: ISmartRouterClient;
  private inputProcessor: InputProcessor;
  private streamManager: StreamManager;
  private config: InteractiveHandlerConfig;
  
  constructor(
    config: InteractiveHandlerConfig,
    smartRouterClient: ISmartRouterClient
  ) {
    this.config = config;
    this.sessions = new Map();
    this.smartRouterClient = smartRouterClient;
    this.inputProcessor = new InputProcessor(config.input);
    this.streamManager = new StreamManager(config.streaming);
  }
  
  async startSession(command: ParsedCommand, context: ExecutionContext): Promise<InteractiveSession> {
    // Check session limits
    if (this.sessions.size >= this.config.session.maxConcurrentSessions) {
      throw new SessionError('Maximum concurrent sessions reached');
    }
    
    // Create new session
    const session: InteractiveSession = {
      id: this.generateSessionId(),
      metadata: {
        createdAt: new Date(),
        lastActivity: new Date(),
        title: this.generateSessionTitle(command),
        tags: [],
        initialCommand: command
      },
      state: SessionState.INITIALIZING,
      conversation: {
        messages: [],
        messageCount: 0,
        context: this.createInitialContext(context)
      },
      config: this.createSessionConfig(),
      metrics: this.createInitialMetrics()
    };
    
    this.sessions.set(session.id, session);
    
    // Initialize session
    await this.initializeSession(session);
    
    return session;
  }
  
  async *processInput(sessionId: string, input: string): AsyncIterableIterator<ResponseChunk> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SessionError(`Session not found: ${sessionId}`);
    }
    
    // Update session state
    session.state = SessionState.PROCESSING;
    session.metadata.lastActivity = new Date();
    
    try {
      // Process input
      const processedInput = await this.inputProcessor.processInput(input, {
        session,
        recentMessages: session.conversation.messages.slice(-5),
        availableCommands: [],
        environment: session.conversation.context.environment
      });
      
      // Validate input
      if (!processedInput.validation.valid) {
        yield this.createErrorChunk(processedInput.validation.errors[0].message);
        return;
      }
      
      // Add user message to conversation
      const userMessage = this.createUserMessage(processedInput);
      session.conversation.messages.push(userMessage);
      session.conversation.messageCount++;
      
      // Send to Smart Router and stream response
      const responseStream = this.smartRouterClient.processMessage({
        message: processedInput.processed,
        context: session.conversation.context,
        sessionId: session.id
      });
      
      let assistantMessage = this.createAssistantMessage();
      let fullContent = '';
      
      for await (const chunk of responseStream) {
        // Update full content
        if (chunk.type === ChunkType.TEXT) {
          fullContent += chunk.content;
        }
        
        // Yield chunk to UI
        yield chunk;
        
        // Update streaming metrics
        this.updateStreamingMetrics(session, chunk);
      }
      
      // Complete assistant message
      assistantMessage.content = fullContent;
      assistantMessage.status = MessageStatus.COMPLETED;
      session.conversation.messages.push(assistantMessage);
      session.conversation.messageCount++;
      
      // Update session state
      session.state = SessionState.WAITING_INPUT;
      
    } catch (error) {
      session.state = SessionState.ERROR;
      yield this.createErrorChunk(`Processing error: ${error.message}`);
    }
  }
  
  private createUserMessage(processedInput: ProcessedInput): ConversationMessage {
    return {
      id: this.generateMessageId(),
      timestamp: new Date(),
      role: MessageRole.USER,
      content: processedInput.processed,
      metadata: {
        source: MessageSource.DIRECT_INPUT,
        tokens: this.estimateTokens(processedInput.processed)
      },
      status: MessageStatus.COMPLETED
    };
  }
  
  private createAssistantMessage(): ConversationMessage {
    return {
      id: this.generateMessageId(),
      timestamp: new Date(),
      role: MessageRole.ASSISTANT,
      content: '',
      metadata: {
        source: MessageSource.SMART_ROUTER
      },
      status: MessageStatus.PROCESSING
    };
  }
}
```

### Stream Management

```typescript
class StreamManager {
  private activeStreams: Map<string, StreamingState>;
  private config: ResponseStreamingConfig;
  
  constructor(config: ResponseStreamingConfig) {
    this.config = config;
    this.activeStreams = new Map();
  }
  
  async *processStream(
    sourceStream: AsyncIterableIterator<ResponseChunk>,
    sessionId: string
  ): AsyncIterableIterator<ResponseChunk> {
    const streamState: StreamingState = {
      isStreaming: true,
      streamStartTime: new Date(),
      chunksReceived: 0,
      contentLength: 0,
      streamingMetrics: this.createInitialStreamingMetrics()
    };
    
    this.activeStreams.set(sessionId, streamState);
    
    try {
      let buffer: ResponseChunk[] = [];
      
      for await (const chunk of sourceStream) {
        streamState.chunksReceived++;
        streamState.contentLength += chunk.content.length;
        
        if (this.config.batchSmallChunks && chunk.content.length < this.config.minChunkSize) {
          buffer.push(chunk);
          
          if (buffer.length >= this.config.bufferSize) {
            yield this.mergeBatchedChunks(buffer);
            buffer = [];
          }
        } else {
          // Flush any buffered chunks first
          if (buffer.length > 0) {
            yield this.mergeBatchedChunks(buffer);
            buffer = [];
          }
          
          yield chunk;
        }
        
        // Update metrics
        this.updateStreamingMetrics(streamState, chunk);
      }
      
      // Flush remaining buffer
      if (buffer.length > 0) {
        yield this.mergeBatchedChunks(buffer);
      }
      
    } finally {
      streamState.isStreaming = false;
      this.activeStreams.delete(sessionId);
    }
  }
  
  private mergeBatchedChunks(chunks: ResponseChunk[]): ResponseChunk {
    return {
      id: chunks[0].id,
      type: ChunkType.TEXT,
      content: chunks.map(c => c.content).join(''),
      metadata: {
        ...chunks[0].metadata,
        sequence: chunks[0].metadata.sequence,
        final: chunks[chunks.length - 1].metadata.final
      },
      timestamp: chunks[chunks.length - 1].timestamp
    };
  }
}
```

### Input Processing

```typescript
class InputProcessor {
  private config: InputProcessingConfig;
  private rateLimiter: RateLimiter;
  
  constructor(config: InputProcessingConfig) {
    this.config = config;
    this.rateLimiter = new RateLimiter(config.rateLimiting);
  }
  
  async processInput(input: string, context: InputContext): Promise<ProcessedInput> {
    // Rate limiting check
    if (!this.rateLimiter.allowRequest(context.session.id)) {
      throw new InputError('Rate limit exceeded', InputErrorCode.RATE_LIMITED);
    }
    
    // Validate input
    const validation = this.validateInput(input);
    
    // Preprocess input
    let processed = input;
    if (this.config.preprocessing.trimWhitespace) {
      processed = processed.trim();
    }
    
    if (this.config.preprocessing.normalizeUnicode) {
      processed = processed.normalize('NFC');
    }
    
    // Apply custom preprocessing rules
    for (const rule of this.config.preprocessing.customRules.sort((a, b) => b.priority - a.priority)) {
      processed = processed.replace(new RegExp(rule.pattern, 'g'), rule.replacement);
    }
    
    return {
      raw: input,
      processed,
      metadata: {
        length: processed.length,
        processedAt: new Date()
      },
      validation
    };
  }
  
  validateInput(input: string): InputValidationResult {
    const errors: InputError[] = [];
    const warnings: string[] = [];
    
    if (input.length === 0) {
      errors.push({
        code: InputErrorCode.EMPTY_INPUT,
        message: 'Input cannot be empty'
      });
    }
    
    if (input.length > this.config.validation.maxLength) {
      errors.push({
        code: InputErrorCode.TOO_LONG,
        message: `Input exceeds maximum length of ${this.config.validation.maxLength} characters`
      });
    }
    
    if (this.config.validation.allowedCharacters) {
      const regex = new RegExp(this.config.validation.allowedCharacters);
      if (!regex.test(input)) {
        errors.push({
          code: InputErrorCode.INVALID_CHARACTERS,
          message: 'Input contains invalid characters'
        });
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions: []
    };
  }
}
```

## Error Handling

```typescript
enum SessionErrorCode {
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_LIMIT_EXCEEDED = 'SESSION_LIMIT_EXCEEDED',
  SESSION_TIMEOUT = 'SESSION_TIMEOUT',
  STREAMING_ERROR = 'STREAMING_ERROR',
  INPUT_PROCESSING_ERROR = 'INPUT_PROCESSING_ERROR'
}

class SessionError extends Error {
  constructor(
    message: string,
    public code: SessionErrorCode = SessionErrorCode.INPUT_PROCESSING_ERROR,
    public sessionId?: string
  ) {
    super(message);
    this.name = 'SessionError';
  }
}
```

## Performance Requirements

- **Session Startup**: <500ms for new session creation
- **Input Processing**: <100ms for input validation and preprocessing
- **Streaming Latency**: <50ms for first chunk delivery
- **Memory Usage**: <50MB per active session
- **Concurrent Sessions**: Support 10+ concurrent interactive sessions

## Testing Contract

```typescript
interface InteractiveCommandHandlerTestSuite {
  /**
   * Test session lifecycle
   */
  testSessionLifecycle(testCases: SessionTestCase[]): TestResults;
  
  /**
   * Test input processing
   */
  testInputProcessing(testCases: InputTestCase[]): TestResults;
  
  /**
   * Test response streaming
   */
  testResponseStreaming(testCases: StreamTestCase[]): TestResults;
  
  /**
   * Test session persistence
   */
  testSessionPersistence(testCases: PersistenceTestCase[]): TestResults;
}
```

This Interactive Command Handler provides comprehensive session management, real-time input processing, and streaming response capabilities, enabling rich conversational experiences with the AI assistant while maintaining performance and reliability standards.