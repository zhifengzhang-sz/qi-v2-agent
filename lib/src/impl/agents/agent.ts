// Agent Implementation - Stateless Three-Type Classification Agent
//
// Implements the correct business logic flow:
// Input → InputClassifier → (Command|Prompt|Workflow) → Handler
//
// This is V1.0 - stateless processing (each input processed independently)
// See docs/agents/architecture-decisions.md for stateful conversation roadmap

import type {
  IAgent,
  IInputClassifier,
  ICommandHandler,
  IWorkflowExtractor,
  IPatternMatcher,
  IWorkflowEngine,
  IModelProvider,
  IToolProvider,
  IMemoryProvider,
  AgentConfiguration,
  AgentRequest,
  AgentResponse,
  AgentStreamChunk,
  DomainConfiguration,
  CognitivePattern,
  CommandDefinition,
  WorkflowMode,
  HealthCheckResult,
  ComponentHealth,
  ToolDefinition,
  WorkflowState,
  WorkflowResult,
  ProcessingEvent,
  ConversationState,
  InputClassificationResult,
  CommandRequest,
  WorkflowExtractionResult,
  ModelRequest,
  ModelMessage
} from '../../core/interfaces.js';

export class Agent implements IAgent {
  private inputClassifier: IInputClassifier;
  private commandHandler: ICommandHandler;
  private workflowExtractor: IWorkflowExtractor;
  private patternMatcher: IPatternMatcher;  // For backward compatibility with workflow engine
  private workflowEngine: IWorkflowEngine;
  private modelProvider: IModelProvider;
  private toolProvider: IToolProvider;
  private memoryProvider?: IMemoryProvider;
  private domainConfig: DomainConfiguration;
  private isInitialized = false;

  constructor(config: AgentConfiguration) {
    this.inputClassifier = config.inputClassifier;
    this.commandHandler = config.commandHandler;
    this.workflowExtractor = config.workflowExtractor;
    this.patternMatcher = config.patternMatcher;  // Kept for backward compatibility
    this.workflowEngine = config.workflowEngine;
    this.modelProvider = config.modelProvider;
    this.toolProvider = config.toolProvider;
    this.memoryProvider = config.memoryProvider;
    this.domainConfig = config.domain;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('Agent already initialized');
      return;
    }

    console.log('🤖 Initializing Agent...');

    try {
      // Initialize all components
      await this.initializeComponents();
      
      // Precompile workflows for all patterns
      const patterns = Array.from(this.domainConfig.patterns.values())
        .map(mode => ({ name: mode.abstractPattern } as CognitivePattern));
      await this.workflowEngine.precompileWorkflows(patterns);
      
      this.isInitialized = true;
      console.log('✅ Agent initialized successfully');
    } catch (error) {
      console.error('❌ Agent initialization failed:', error);
      throw error;
    }
  }

  async process(request: AgentRequest): Promise<AgentResponse> {
    this.ensureInitialized();
    const startTime = Date.now();
    
    try {
      // CORRECT BUSINESS LOGIC: Input → InputClassifier → (Command|Prompt|Workflow) → Handler
      const classification = await this.inputClassifier.classifyInput(request.input, undefined, request.context);
      
      // Route to appropriate handler based on input type
      switch (classification.type) {
        case 'command':
          return await this.handleCommand(request, classification, startTime);
          
        case 'prompt':
          return await this.handlePrompt(request, classification, startTime);
          
        case 'workflow':
          return await this.handleWorkflow(request, classification, startTime);
          
        default:
          throw new Error(`Unknown input type: ${classification.type}`);
      }
    } catch (error) {
      throw new Error(
        `Agent processing failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async *stream(request: AgentRequest): AsyncIterableIterator<AgentStreamChunk> {
    this.ensureInitialized();

    try {
      // CORRECT BUSINESS LOGIC: Input → InputClassifier → (Command|Prompt|Workflow) → Handler
      const classification = await this.inputClassifier.classifyInput(request.input, undefined, request.context);

      yield {
        content: '',
        inputType: classification.type,
        currentStage: 'input-classification',
        isComplete: false
      };

      // Route to appropriate streaming handler based on input type
      switch (classification.type) {
        case 'command':
          yield* this.streamCommand(request, classification);
          break;
          
        case 'prompt':
          yield* this.streamPrompt(request, classification);
          break;
          
        case 'workflow':
          yield* this.streamWorkflow(request, classification);
          break;
          
        default:
          throw new Error(`Unknown input type: ${classification.type}`);
      }

      // Final completion chunk
      yield {
        content: '',
        inputType: classification.type,
        currentStage: 'completed',
        isComplete: true
      };
    } catch (error) {
      yield {
        content: '',
        currentStage: 'error',
        isComplete: true,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  getDomainConfiguration(): DomainConfiguration {
    return this.domainConfig;
  }

  getSupportedInputTypes(): readonly string[] {
    return this.inputClassifier.getSupportedTypes();
  }

  getAvailableCommands(): readonly CommandDefinition[] {
    return this.commandHandler.getAvailableCommands();
  }

  getSupportedWorkflowModes(): readonly WorkflowMode[] {
    return this.workflowExtractor.getSupportedModes();
  }

  getAvailablePatterns(): readonly CognitivePattern[] {
    return this.patternMatcher.getAvailablePatterns();
  }

  async getAvailableTools(): Promise<readonly ToolDefinition[]> {
    return this.toolProvider.getAvailableTools();
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const components = new Map<string, ComponentHealth>();
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check pattern matcher
    try {
      const startTime = Date.now();
      const testResult = await this.patternMatcher.detectPattern('test input');
      const latency = Date.now() - startTime;
      
      components.set('patternMatcher', {
        status: 'healthy',
        latency,
        details: `Detected pattern: ${testResult.pattern.name}`
      });
    } catch (error) {
      components.set('patternMatcher', {
        status: 'unhealthy',
        details: error instanceof Error ? error.message : String(error)
      });
      overallStatus = 'unhealthy';
    }

    // Check model provider
    try {
      const startTime = Date.now();
      const models = await this.modelProvider.getAvailableModels();
      const latency = Date.now() - startTime;
      
      components.set('modelProvider', {
        status: 'healthy',
        latency,
        details: `${models.length} models available`
      });
    } catch (error) {
      components.set('modelProvider', {
        status: 'unhealthy',
        details: error instanceof Error ? error.message : String(error)
      });
      overallStatus = 'unhealthy';
    }

    // Check tool provider
    try {
      const startTime = Date.now();
      const tools = await this.toolProvider.getAvailableTools();
      const latency = Date.now() - startTime;
      
      components.set('toolProvider', {
        status: 'healthy',
        latency,
        details: `${tools.length} tools available`
      });
    } catch (error) {
      components.set('toolProvider', {
        status: 'degraded',
        details: error instanceof Error ? error.message : String(error)
      });
      if (overallStatus === 'healthy') {
        overallStatus = 'degraded';
      }
    }

    // Core business logic focused health check - no operational complexity yet

    return {
      status: overallStatus,
      components,
      timestamp: new Date()
    };
  }

  // Get core metrics (focus on business logic)
  getCoreMetrics(): {
    domain: string;
    patterns: string[];
    uptime: number;
  } {
    return {
      domain: this.domainConfig.domain,
      patterns: Array.from(this.domainConfig.patterns.keys()),
      uptime: Date.now() - (this as any).startTime || 0
    };
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up Agent...');

    try {
      // Cleanup tool provider (MCP connections)
      if ('cleanup' in this.toolProvider) {
        await (this.toolProvider as any).cleanup();
      }

      // Cleanup memory provider
      if (this.memoryProvider) {
        await this.memoryProvider.cleanup();
      }

      // Core cleanup focused on business logic

      this.isInitialized = false;
      console.log('✅ Agent cleanup complete');
    } catch (error) {
      console.error('❌ Agent cleanup failed:', error);
      throw error;
    }
  }

  private async initializeComponents(): Promise<void> {
    // All components are already initialized by their constructors
    // This method can be used for any additional setup if needed
    console.log('🔧 All components initialized');
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }
  }

  private createInitialState(request: AgentRequest, pattern: CognitivePattern): WorkflowState {
    return {
      input: request.input,
      pattern,
      domain: this.domainConfig.domain,
      context: new Map(Object.entries(request.context?.environmentContext || {})),
      toolResults: [],
      reasoningOutput: '',
      output: '',
      metadata: {
        startTime: Date.now(),
        processingSteps: [],
        performance: new Map()
      }
    };
  }

  private async saveToMemory(
    request: AgentRequest,
    result: WorkflowResult,
    sessionId: string
  ): Promise<void> {
    if (!this.memoryProvider) return;

    // Save conversation state
    const conversationState: ConversationState = {
      sessionId,
      messages: [
        { role: 'user' as const, content: request.input, metadata: new Map() },
        { role: 'assistant' as const, content: result.finalState.output, metadata: new Map() }
      ],
      currentPattern: result.finalState.pattern,
      context: result.finalState.context,
      lastUpdated: new Date()
    };

    await this.memoryProvider.saveConversationState(conversationState);

    // Add processing event
    const event: ProcessingEvent = {
      eventId: `event-${Date.now()}`,
      sessionId,
      timestamp: new Date(),
      type: 'workflow_execution' as const,
      data: new Map<string, unknown>([
        ['pattern', result.finalState.pattern.name],
        ['executionTime', result.performance.totalTime],
        ['toolsUsed', result.finalState.toolResults.map(tr => tr.toolName)]
      ])
    };

    await this.memoryProvider.addProcessingEvent(event);
  }

  // =============================================================================
  // Three-Type Handler Methods - Core Business Logic Implementation
  // =============================================================================

  private async handleCommand(
    request: AgentRequest,
    classification: InputClassificationResult,
    startTime: number
  ): Promise<AgentResponse> {
    const commandRequest: CommandRequest = {
      commandName: classification.extractedData.get('command') as string,
      parameters: new Map(classification.extractedData.get('args') as Array<[string, unknown]> || []),
      rawInput: request.input,
      context: request.context
    };

    const result = await this.commandHandler.executeCommand(commandRequest);
    const executionTime = Date.now() - startTime;

    return {
      success: result.success,
      content: result.content,
      inputType: 'command',
      pattern: { 
        name: 'command', 
        description: 'Built-in command execution', 
        purpose: 'Execute system commands',
        characteristics: ['immediate', 'deterministic', 'system-level'],
        abstractKeywords: [], 
        contextWeight: 0 
      },
      toolsUsed: [],
      performance: {
        totalTime: executionTime,
        nodeExecutionTimes: new Map(),
        toolExecutionTime: 0,
        reasoningTime: 0
      },
      metadata: new Map<string, unknown>([
        ['inputType', 'command'],
        ['executionTime', executionTime],
        ['commandName', result.commandName],
        ['success', result.success]
      ])
    };
  }

  private async handlePrompt(
    request: AgentRequest,
    classification: InputClassificationResult,
    startTime: number
  ): Promise<AgentResponse> {
    // For prompts, we use the model provider directly for conversational responses
    const modelRequest: ModelRequest = {
      messages: [{
        role: 'user',
        content: request.input,
        metadata: new Map()
      }],
      // TODO: ARCHITECTURAL ISSUE - Should use ConfigurationManager instead of hardcoding
      // This should load from config/qi-config.yaml via dependency injection
      configuration: {
        id: 'qwen2.5-coder:7b',
        name: 'qwen2.5-coder:7b',
        providerId: 'ollama',
        modelId: 'qwen2.5-coder:7b',
        parameters: {
          temperature: 0.1, // From qi-config.yaml
          maxTokens: 2000
        },
        capabilities: {
          supportsStreaming: true,
          supportsToolCalling: false,
          supportsSystemMessages: true,
          maxContextLength: 4096,
          supportedMessageTypes: ['user', 'assistant']
        }
      },
      context: new Map(Object.entries(request.context?.environmentContext || {}))
    };

    const response = await this.modelProvider.invoke(modelRequest);
    const executionTime = Date.now() - startTime;

    return {
      success: true,
      content: response.content,
      inputType: 'prompt',
      pattern: { 
        name: 'conversational', 
        description: 'Direct conversational response', 
        purpose: 'Provide conversational interaction',
        characteristics: ['interactive', 'responsive', 'contextual'],
        abstractKeywords: [], 
        contextWeight: 0.3 
      },
      toolsUsed: [],
      performance: {
        totalTime: executionTime,
        nodeExecutionTimes: new Map(),
        toolExecutionTime: 0,
        reasoningTime: 0
      },
      metadata: new Map<string, unknown>([
        ['inputType', 'prompt'],
        ['executionTime', executionTime],
        ['modelUsed', 'unknown'],
        ['tokenCount', response.usage?.totalTokens]
      ])
    };
  }

  private async handleWorkflow(
    request: AgentRequest,
    classification: InputClassificationResult,
    startTime: number
  ): Promise<AgentResponse> {
    // Extract workflow from the input
    const workflowExtraction = await this.workflowExtractor.extractWorkflow(
      request.input,
      request.context
    );

    if (!workflowExtraction.success) {
      return {
        success: false,
        content: `Failed to extract workflow: ${workflowExtraction.error}`,
        inputType: 'workflow',
        pattern: { 
          name: 'error', 
          description: 'Workflow extraction failed', 
          purpose: 'Handle extraction errors',
          characteristics: ['error-handling', 'fallback'],
          abstractKeywords: [], 
          contextWeight: 0 
        },
        toolsUsed: [],
        performance: {
          totalTime: Date.now() - startTime,
          nodeExecutionTimes: new Map(),
          toolExecutionTime: 0,
          reasoningTime: 0
        },
        metadata: new Map<string, unknown>([
          ['inputType', 'workflow'],
          ['extractionError', workflowExtraction.error],
          ['executionTime', Date.now() - startTime]
        ])
      };
    }

    // Create initial workflow state
    const initialState = this.createInitialState(request, workflowExtraction.pattern);

    // Create executable workflow and execute through the workflow engine
    const executableWorkflow = this.workflowEngine.createWorkflow(workflowExtraction.pattern);
    const workflowResult = await this.workflowEngine.execute(
      executableWorkflow,
      initialState
    );

    const executionTime = Date.now() - startTime;

    // Save to memory if available
    if (request.context?.sessionId) {
      await this.saveToMemory(request, workflowResult, request.context.sessionId);
    }

    return {
      success: true,
      content: workflowResult.finalState.output,
      inputType: 'workflow',
      pattern: workflowExtraction.pattern,
      toolsUsed: workflowResult.finalState.toolResults.map(tr => tr.toolName),
      performance: workflowResult.performance,
      metadata: new Map<string, unknown>([
        ['executionTime', executionTime],
        ['workflowSteps', workflowResult.finalState.metadata.processingSteps.length],
        ['classificationConfidence', classification.confidence],
        ['detectionMethod', classification.detectionMethod]
      ])
    };
  }

  private async *streamCommand(
    request: AgentRequest,
    classification: InputClassificationResult
  ): AsyncIterableIterator<AgentStreamChunk> {
    yield {
      content: '',
      inputType: 'command',
      currentStage: 'command-execution',
      isComplete: false
    };

    // Commands are typically fast, so just execute and yield result
    const result = await this.handleCommand(request, classification, Date.now());
    
    yield {
      content: result.content,
      inputType: 'command',
      currentStage: 'command-completed',
      isComplete: true
    };
  }

  private async *streamPrompt(
    request: AgentRequest,
    classification: InputClassificationResult
  ): AsyncIterableIterator<AgentStreamChunk> {
    yield {
      content: '',
      inputType: 'prompt',
      currentStage: 'model-generation',
      isComplete: false
    };

    // Stream the model response
    const modelRequest: ModelRequest = {
      messages: [{
        role: 'user',
        content: request.input,
        metadata: new Map()
      }],
      // TODO: ARCHITECTURAL ISSUE - Should use ConfigurationManager instead of hardcoding
      // This should load from config/qi-config.yaml via dependency injection
      configuration: {
        id: 'qwen2.5-coder:7b',
        name: 'qwen2.5-coder:7b',
        providerId: 'ollama',
        modelId: 'qwen2.5-coder:7b',
        parameters: {
          temperature: 0.1, // From qi-config.yaml
          maxTokens: 2000
        },
        capabilities: {
          supportsStreaming: true,
          supportsToolCalling: false,
          supportsSystemMessages: true,
          maxContextLength: 4096,
          supportedMessageTypes: ['user', 'assistant']
        }
      },
      context: request.context ? new Map(Object.entries(request.context.environmentContext || {})) : new Map(),
      options: {
        temperature: 0.7,
        maxTokens: 2000,
        stream: true
      }
    };

    try {
      for await (const chunk of this.modelProvider.stream(modelRequest)) {
        yield {
          content: chunk.content,
          inputType: 'prompt',
          currentStage: 'model-generation',
          isComplete: chunk.isComplete
        };
      }
    } catch (error) {
      yield {
        content: '',
        inputType: 'prompt',
        currentStage: 'error',
        isComplete: true,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  private async *streamWorkflow(
    request: AgentRequest,
    classification: InputClassificationResult
  ): AsyncIterableIterator<AgentStreamChunk> {
    yield {
      content: '',
      inputType: 'workflow',
      currentStage: 'workflow-extraction',
      isComplete: false
    };

    try {
      // Extract workflow
      const workflowExtraction = await this.workflowExtractor.extractWorkflow(
        request.input,
        request.context
      );

      if (!workflowExtraction.success) {
        yield {
          content: `Failed to extract workflow: ${workflowExtraction.error}`,
          inputType: 'workflow',
          currentStage: 'error',
          isComplete: true,
          error: new Error(workflowExtraction.error || 'Workflow extraction failed')
        };
        return;
      }

      yield {
        content: `Extracted workflow pattern: ${workflowExtraction.pattern.name}`,
        inputType: 'workflow',
        currentStage: 'workflow-execution',
        isComplete: false
      };

      // Create initial state and stream workflow execution
      const initialState = this.createInitialState(request, workflowExtraction.pattern);
      const executableWorkflow = this.workflowEngine.createWorkflow(workflowExtraction.pattern);
      
      for await (const chunk of this.workflowEngine.stream(executableWorkflow, initialState)) {
        yield {
          content: chunk.state.output || `Processing node: ${chunk.nodeId}`,
          inputType: 'workflow',
          currentStage: chunk.nodeId,
          isComplete: chunk.isComplete,
          error: chunk.error ? new Error(chunk.error.error.message) : undefined
        };
      }
    } catch (error) {
      yield {
        content: '',
        inputType: 'workflow',
        currentStage: 'error',
        isComplete: true,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
}