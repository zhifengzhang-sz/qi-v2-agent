// Agent Implementation - 2025 Enhanced Version
//
// Main agent coordinator with operational reliability features:
// - Rate limiting and circuit breaker protection
// - Performance monitoring and metrics collection
// - Cost tracking and usage analytics
// - Enhanced error handling and recovery

import type {
  IAgent,
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
  HealthCheckResult,
  ComponentHealth,
  ToolDefinition,
  WorkflowState,
  WorkflowResult,
  ProcessingEvent,
  ConversationState
} from '../core/interfaces.js';
import { OperationalServices, type OperationalConfig } from './operational-reliability.js';

export class Agent implements IAgent {
  private patternMatcher: IPatternMatcher;
  private workflowEngine: IWorkflowEngine;
  private modelProvider: IModelProvider;
  private toolProvider: IToolProvider;
  private memoryProvider?: IMemoryProvider;
  private domainConfig: DomainConfiguration;
  private operationalServices: OperationalServices;
  private isInitialized = false;

  constructor(config: AgentConfiguration & { operational?: OperationalConfig }) {
    this.patternMatcher = config.patternMatcher;
    this.workflowEngine = config.workflowEngine;
    this.modelProvider = config.modelProvider;
    this.toolProvider = config.toolProvider;
    this.memoryProvider = config.memoryProvider;
    this.domainConfig = config.domain;
    
    // Initialize operational services
    this.operationalServices = new OperationalServices(config.operational);
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

    // Execute with operational reliability features
    return this.operationalServices.executeWithReliability(async () => {
      const startTime = Date.now();
      
      try {
        // Detect cognitive pattern with reliability
        const patternResult = await this.operationalServices.executeWithReliability(
          () => this.patternMatcher.detectPattern(request.input, request.context),
          { provider: 'pattern-matcher' }
        );

        // Get or create workflow for the pattern
        let workflow = this.workflowEngine.getCompiledWorkflow(patternResult.pattern.name);
        if (!workflow) {
          workflow = this.workflowEngine.createWorkflow(patternResult.pattern);
        }

        // Create initial workflow state
        const initialState = this.createInitialState(request, patternResult.pattern);

        // Execute workflow with reliability
        const result = await this.operationalServices.executeWithReliability(
          () => this.workflowEngine.execute(workflow!, initialState),
          { provider: 'workflow-engine' }
        );

        // Save to memory if enabled
        if (this.memoryProvider && request.options?.sessionId) {
          await this.saveToMemory(request, result, request.options.sessionId);
        }

        return {
          content: result.finalState.output,
          pattern: patternResult.pattern,
          toolsUsed: result.finalState.toolResults.map(tr => tr.toolName),
          performance: result.performance,
          metadata: new Map<string, unknown>([
            ['totalTime', Date.now() - startTime],
            ['patternConfidence', patternResult.confidence],
            ['detectionMethod', patternResult.detectionMethod],
            ['executionPath', result.executionPath],
            ['operationalMetrics', this.operationalServices.getOperationalStatus()]
          ])
        };
      } catch (error) {
        throw new Error(
          `Agent processing failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  async *stream(request: AgentRequest): AsyncIterableIterator<AgentStreamChunk> {
    this.ensureInitialized();

    try {
      // Detect cognitive pattern
      const patternResult = await this.patternMatcher.detectPattern(
        request.input,
        request.context
      );

      yield {
        content: '',
        pattern: patternResult.pattern,
        currentStage: 'pattern-detection',
        isComplete: false
      };

      // Get or create workflow for the pattern
      let workflow = this.workflowEngine.getCompiledWorkflow(patternResult.pattern.name);
      if (!workflow) {
        workflow = this.workflowEngine.createWorkflow(patternResult.pattern);
      }

      // Create initial workflow state
      const initialState = this.createInitialState(request, patternResult.pattern);

      yield {
        content: '',
        pattern: patternResult.pattern,
        currentStage: 'workflow-execution',
        isComplete: false
      };

      // Stream workflow execution
      for await (const chunk of this.workflowEngine.stream(workflow, initialState)) {
        yield {
          content: chunk.state.output,
          pattern: patternResult.pattern,
          currentStage: chunk.nodeId,
          isComplete: chunk.isComplete,
          error: chunk.error ? chunk.error.error : undefined
        };

        if (chunk.error) {
          return; // Stop streaming on error
        }
      }

      // Final completion chunk
      yield {
        content: '',
        pattern: patternResult.pattern,
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

  getAvailablePatterns(): readonly CognitivePattern[] {
    return this.patternMatcher.getAvailablePatterns();
  }

  async getAvailableTools(): Promise<readonly ToolDefinition[]> {
    return this.toolProvider.getAvailableTools();
  }

  async healthCheck(): Promise<HealthCheckResult> {
    // Use operational services for comprehensive health check
    const operationalHealth = await this.operationalServices.healthCheck();
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

    // Add operational services status
    const opStatus = this.operationalServices.getOperationalStatus();
    components.set('operationalServices', {
      status: opStatus.circuitBreaker.state === 'OPEN' ? 'unhealthy' : 
              opStatus.performance.errorRate > 0.1 ? 'degraded' : 'healthy',
      details: `Circuit breaker: ${opStatus.circuitBreaker.state}, Error rate: ${(opStatus.performance.errorRate * 100).toFixed(1)}%`,
      errorRate: opStatus.performance.errorRate
    });

    // Update overall status based on operational health
    if (operationalHealth.status === 'unhealthy' || overallStatus === 'unhealthy') {
      overallStatus = 'unhealthy';
    } else if (operationalHealth.status === 'degraded' || overallStatus === 'degraded') {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      components,
      timestamp: new Date()
    };
  }

  // Get operational metrics (2025 enhancement)
  getOperationalMetrics(): {
    status: ReturnType<OperationalServices['getOperationalStatus']>;
    domain: string;
    patterns: string[];
    uptime: number;
  } {
    return {
      status: this.operationalServices.getOperationalStatus(),
      domain: this.domainConfig.domain,
      patterns: Array.from(this.domainConfig.patterns.keys()),
      uptime: Date.now() - (this as any).startTime || 0
    };
  }

  // Reset operational metrics
  resetMetrics(): void {
    this.operationalServices.reset();
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

      // Reset operational services
      this.operationalServices.reset();

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
      reasoning: '',
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
}