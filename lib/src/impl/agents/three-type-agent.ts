// Three-Type Classification Agent Implementation
//
// Enhanced agent that implements the new three-type input classification system:
// - Command processing for system functions
// - Prompt processing for simple conversational inputs  
// - Workflow processing for complex task orchestration

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
  ProcessingEvent,
  ConversationState,
  InputClassificationResult,
  WorkflowExtractionResult
} from '../../core/interfaces.js';

export class ThreeTypeAgent implements IAgent {
  private inputClassifier: IInputClassifier;
  private commandHandler: ICommandHandler;
  private workflowExtractor: IWorkflowExtractor;
  private patternMatcher: IPatternMatcher;  // For backward compatibility
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
    this.patternMatcher = config.patternMatcher;
    this.workflowEngine = config.workflowEngine;
    this.modelProvider = config.modelProvider;
    this.toolProvider = config.toolProvider;
    this.memoryProvider = config.memoryProvider;
    this.domainConfig = config.domain;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('Three-type agent already initialized');
      return;
    }

    console.log('🤖 Initializing Three-Type Classification Agent...');

    try {
      // Initialize components if needed
      await this.initializeComponents();
      
      this.isInitialized = true;
      console.log('✅ Three-type agent initialized successfully');
    } catch (error) {
      console.error('❌ Three-type agent initialization failed:', error);
      throw error;
    }
  }

  async process(request: AgentRequest): Promise<AgentResponse> {
    this.ensureInitialized();

    const startTime = Date.now();
    
    try {
      // Stage 1: Classify input type (command/prompt/workflow)
      const classificationResult = await this.inputClassifier.classifyInput(
        request.input, 
        undefined,
        request.context
      );

      // Route based on input type
      switch (classificationResult.type) {
        case 'command':
          return await this.handleCommand(request, classificationResult, startTime);
        case 'prompt':
          return await this.handlePrompt(request, classificationResult, startTime);
        case 'workflow':
          return await this.handleWorkflow(request, classificationResult, startTime);
        default:
          throw new Error(`Unknown input type: ${classificationResult.type}`);
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
      // Classify input type
      const classificationResult = await this.inputClassifier.classifyInput(
        request.input,
        undefined,
        request.context
      );

      yield {
        content: '',
        inputType: classificationResult.type,
        currentStage: 'input-classification',
        isComplete: false
      };

      // Route based on input type
      switch (classificationResult.type) {
        case 'command':
          yield* this.streamCommand(request, classificationResult);
          break;
        case 'prompt':
          yield* this.streamPrompt(request, classificationResult);
          break;
        case 'workflow':
          yield* this.streamWorkflow(request, classificationResult);
          break;
      }

      // Final completion chunk
      yield {
        content: '',
        inputType: classificationResult.type,
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

  // ============================================================================
  // Interface Methods
  // ============================================================================

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

    // Check input classifier
    try {
      const startTime = Date.now();
      const testResult = await this.inputClassifier.classifyInput('test input');
      const latency = Date.now() - startTime;
      
      components.set('inputClassifier', {
        status: 'healthy',
        latency,
        details: `Classified as: ${testResult.type} (${testResult.confidence.toFixed(2)})`
      });
    } catch (error) {
      components.set('inputClassifier', {
        status: 'unhealthy',
        details: error instanceof Error ? error.message : String(error)
      });
      overallStatus = 'unhealthy';
    }

    // Check command handler
    try {
      const commands = this.commandHandler.getAvailableCommands();
      components.set('commandHandler', {
        status: 'healthy',
        details: `${commands.length} commands available`
      });
    } catch (error) {
      components.set('commandHandler', {
        status: 'degraded',
        details: error instanceof Error ? error.message : String(error)
      });
      if (overallStatus === 'healthy') overallStatus = 'degraded';
    }

    // Check workflow extractor
    try {
      const modes = this.workflowExtractor.getSupportedModes();
      components.set('workflowExtractor', {
        status: 'healthy',
        details: `${modes.length} workflow modes supported`
      });
    } catch (error) {
      components.set('workflowExtractor', {
        status: 'degraded',
        details: error instanceof Error ? error.message : String(error)
      });
      if (overallStatus === 'healthy') overallStatus = 'degraded';
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

    return {
      status: overallStatus,
      components,
      timestamp: new Date()
    };
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up Three-Type Agent...');
    
    try {
      // Cleanup memory provider
      if (this.memoryProvider) {
        await this.memoryProvider.cleanup();
      }

      this.isInitialized = false;
      console.log('✅ Three-type agent cleanup complete');
    } catch (error) {
      console.error('❌ Three-type agent cleanup failed:', error);
      throw error;
    }
  }

  // ============================================================================
  // Three-Type Input Handlers
  // ============================================================================

  private async handleCommand(
    request: AgentRequest, 
    classification: InputClassificationResult, 
    startTime: number
  ): Promise<AgentResponse> {
    const commandName = this.extractCommandName(request.input);
    const parameters = this.parseCommandParameters(request.input);
    
    const commandRequest = {
      commandName,
      parameters,
      rawInput: request.input,
      context: request.context
    };

    const result = await this.commandHandler.executeCommand(commandRequest);

    return {
      success: result.status === 'success',
      content: result.content,
      inputType: 'command',
      toolsUsed: [],
      performance: {
        totalTime: Date.now() - startTime,
        nodeExecutionTimes: new Map([['command', Date.now() - startTime]]),
        toolExecutionTime: 0,
        reasoningTime: 0
      },
      metadata: new Map<string, unknown>([
        ['totalTime', Date.now() - startTime],
        ['commandName', commandName],
        ['commandStatus', result.status],
        ['classificationConfidence', classification.confidence],
        ['detectionMethod', classification.detectionMethod]
      ]),
      error: result.status !== 'success' ? result.content : undefined
    };
  }

  private async handlePrompt(
    request: AgentRequest, 
    classification: InputClassificationResult, 
    startTime: number
  ): Promise<AgentResponse> {
    // Direct LLM processing for simple prompts
    const modelRequest = {
      messages: [{ role: 'user' as const, content: request.input, metadata: new Map() }],
      configuration: {
        id: 'ollama-qwen2.5-coder',
        name: 'ollama-qwen2.5-coder',
        providerId: 'ollama',
        modelId: 'qwen2.5-coder:7b',
        parameters: {
          temperature: 0.7,
          maxTokens: 2048
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

    const result = await this.modelProvider.invoke(modelRequest);

    return {
      success: true,
      content: result.content,
      inputType: 'prompt',
      toolsUsed: [],
      performance: {
        totalTime: Date.now() - startTime,
        nodeExecutionTimes: new Map([['llm-processing', Date.now() - startTime]]),
        toolExecutionTime: 0,
        reasoningTime: Date.now() - startTime
      },
      metadata: new Map<string, unknown>([
        ['totalTime', Date.now() - startTime],
        ['tokenUsage', result.usage],
        ['finishReason', result.finishReason],
        ['classificationConfidence', classification.confidence],
        ['detectionMethod', classification.detectionMethod]
      ])
    };
  }

  private async handleWorkflow(
    request: AgentRequest, 
    classification: InputClassificationResult, 
    startTime: number
  ): Promise<AgentResponse> {
    // Extract workflow specification
    const workflowResult = await this.workflowExtractor.extractWorkflow(
      request.input, 
      request.context
    );

    // Convert to cognitive pattern for workflow engine compatibility
    const pattern = this.createPatternFromWorkflowMode(workflowResult.mode);
    
    // Get or create workflow for the pattern
    let workflow = this.workflowEngine.getCompiledWorkflow(pattern.name);
    if (!workflow) {
      workflow = this.workflowEngine.createWorkflow(pattern);
    }

    // Create initial workflow state
    const initialState = this.createInitialState(request, pattern);

    // Execute workflow
    const result = await this.workflowEngine.execute(workflow, initialState);

    // Save to memory if enabled
    if (this.memoryProvider && request.options?.sessionId) {
      await this.saveToMemory(request, result, request.options.sessionId);
    }

    return {
      success: true,
      content: result.finalState.output,
      inputType: 'workflow',
      workflowMode: workflowResult.mode,
      toolsUsed: result.finalState.toolResults.map(tr => tr.toolName),
      performance: result.performance,
      metadata: new Map<string, unknown>([
        ['totalTime', Date.now() - startTime],
        ['classificationConfidence', classification.confidence],
        ['workflowExtractionConfidence', workflowResult.confidence],
        ['detectionMethod', classification.detectionMethod],
        ['extractionMethod', workflowResult.extractionMethod],
        ['executionPath', result.executionPath]
      ])
    };
  }

  // ============================================================================
  // Stream Handlers
  // ============================================================================

  private async *streamCommand(
    request: AgentRequest, 
    classification: InputClassificationResult
  ): AsyncIterableIterator<AgentStreamChunk> {
    yield {
      content: 'Executing command...',
      inputType: 'command',
      currentStage: 'command-execution',
      isComplete: false
    };

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
      currentStage: 'llm-processing',
      isComplete: false
    };

    const result = await this.handlePrompt(request, classification, Date.now());
    
    yield {
      content: result.content,
      inputType: 'prompt',
      currentStage: 'llm-completed',
      isComplete: true
    };
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

    // Extract workflow
    const workflowResult = await this.workflowExtractor.extractWorkflow(
      request.input, 
      request.context
    );

    yield {
      content: '',
      inputType: 'workflow',
      workflowMode: workflowResult.mode,
      currentStage: 'workflow-execution',
      isComplete: false
    };

    // Execute workflow with streaming
    const pattern = this.createPatternFromWorkflowMode(workflowResult.mode);
    let workflow = this.workflowEngine.getCompiledWorkflow(pattern.name);
    if (!workflow) {
      workflow = this.workflowEngine.createWorkflow(pattern);
    }

    const initialState = this.createInitialState(request, pattern);

    for await (const chunk of this.workflowEngine.stream(workflow, initialState)) {
      yield {
        content: chunk.state.output,
        inputType: 'workflow',
        workflowMode: workflowResult.mode,
        currentStage: chunk.nodeId,
        isComplete: chunk.isComplete,
        error: chunk.error ? chunk.error.error : undefined
      };

      if (chunk.error) {
        return;
      }
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async initializeComponents(): Promise<void> {
    // Components are initialized by their constructors
    console.log('🔧 Three-type classification components initialized');
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Three-type agent not initialized. Call initialize() first.');
    }
  }

  private extractCommandName(input: string): string {
    const match = input.trim().match(/^\/(\w+)/);
    return match ? match[1] : 'unknown';
  }

  private parseCommandParameters(input: string): Map<string, unknown> {
    const parameters = new Map<string, unknown>();
    
    // Simple parameter parsing
    const parts = input.trim().split(/\s+/);
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      if (part.startsWith('--')) {
        const key = part.substring(2);
        if (i + 1 < parts.length && !parts[i + 1].startsWith('--')) {
          parameters.set(key, parts[i + 1]);
          i++; // Skip next part as it's the value
        } else {
          parameters.set(key, true); // Boolean flag
        }
      }
    }
    
    return parameters;
  }

  private createPatternFromWorkflowMode(mode: string): CognitivePattern {
    // Map workflow modes to cognitive patterns for backward compatibility
    const modeToPatternMap: Record<string, string> = {
      'editing': 'creative',
      'debugging': 'problem-solving',
      'planning': 'analytical',
      'creation': 'creative'
    };

    const patternName = modeToPatternMap[mode] || 'conversational';
    const patterns = this.patternMatcher.getAvailablePatterns();
    const pattern = patterns.find(p => p.name === patternName);
    
    if (!pattern) {
      // Fallback pattern
      return {
        name: patternName,
        description: `Generated pattern for ${mode} workflow`,
        purpose: `Handle ${mode} tasks`,
        characteristics: [mode],
        abstractKeywords: [mode],
        contextWeight: 0.7
      };
    }
    
    return pattern;
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
    result: any,
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
        ['toolsUsed', result.finalState.toolResults.map((tr: any) => tr.toolName)]
      ])
    };

    await this.memoryProvider.addProcessingEvent(event);
  }
}