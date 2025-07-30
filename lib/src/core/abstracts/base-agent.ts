// Abstract Agent Base Classes - Technology Agnostic
//
// Provides common functionality and patterns for agent implementations
// following the three-type classification architecture

import type {
  IAgent,
  AgentConfiguration,
  AgentRequest,
  AgentResponse,
  AgentStreamChunk,
  HealthCheckResult,
  ComponentHealth,
  DomainConfiguration,
  CommandDefinition,
  WorkflowMode,
  CognitivePattern,
  ToolDefinition,
  InputClassificationResult,
  ProcessingContext
} from '../interfaces/index.js';

/**
 * Abstract base agent providing common functionality
 */
export abstract class BaseAgent implements IAgent {
  protected config: AgentConfiguration;
  protected isInitialized = false;
  protected startTime = Date.now();

  constructor(config: AgentConfiguration) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('Agent already initialized');
      return;
    }

    console.log('🤖 Initializing Agent...');

    try {
      await this.initializeComponents();
      await this.precompileWorkflows();
      
      this.isInitialized = true;
      console.log('✅ Agent initialized successfully');
    } catch (error) {
      console.error('❌ Agent initialization failed:', error);
      throw error;
    }
  }

  abstract process(request: AgentRequest): Promise<AgentResponse>;
  abstract stream(request: AgentRequest): AsyncIterableIterator<AgentStreamChunk>;

  getDomainConfiguration(): DomainConfiguration {
    return this.config.domain;
  }

  getSupportedInputTypes(): readonly string[] {
    return this.config.inputClassifier.getSupportedTypes();
  }

  getAvailableCommands(): readonly CommandDefinition[] {
    return this.config.commandHandler.getAvailableCommands();
  }

  getSupportedWorkflowModes(): readonly WorkflowMode[] {
    return this.config.workflowExtractor.getSupportedModes();
  }

  getAvailablePatterns(): readonly CognitivePattern[] {
    return this.config.patternMatcher.getAvailablePatterns();
  }

  async getAvailableTools(): Promise<readonly ToolDefinition[]> {
    return this.config.toolProvider.getAvailableTools();
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const components = new Map<string, ComponentHealth>();
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check input classifier
    await this.checkComponent('inputClassifier', components, () => 
      this.config.inputClassifier.classifyInput('test health check')
    );

    // Check command handler
    await this.checkComponent('commandHandler', components, () =>
      Promise.resolve(this.config.commandHandler.getAvailableCommands())
    );

    // Check workflow extractor
    await this.checkComponent('workflowExtractor', components, async () =>
      this.config.workflowExtractor.getSupportedModes()
    );

    // Check model provider
    await this.checkComponent('modelProvider', components, () =>
      this.config.modelProvider.getAvailableModels()
    );

    // Check tool provider
    await this.checkComponent('toolProvider', components, () =>
      this.config.toolProvider.getAvailableTools()
    );

    // Determine overall status
    for (const health of components.values()) {
      if (health.status === 'unhealthy') {
        overallStatus = 'unhealthy';
        break;
      } else if (health.status === 'degraded' && overallStatus === 'healthy') {
        overallStatus = 'degraded';
      }
    }

    return {
      status: overallStatus,
      components,
      timestamp: new Date()
    };
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up Agent...');

    try {
      // Cleanup tool provider (MCP connections)
      if ('cleanup' in this.config.toolProvider) {
        await (this.config.toolProvider as any).cleanup();
      }

      // Cleanup memory provider
      if (this.config.memoryProvider) {
        await this.config.memoryProvider.cleanup();
      }

      this.isInitialized = false;
      console.log('✅ Agent cleanup complete');
    } catch (error) {
      console.error('❌ Agent cleanup failed:', error);
      throw error;
    }
  }

  // Protected helper methods for subclasses

  protected ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }
  }

  protected async classifyInput(input: string, context?: ProcessingContext): Promise<InputClassificationResult> {
    return this.config.inputClassifier.classifyInput(input, undefined, context);
  }

  protected createProcessingContext(request: AgentRequest): ProcessingContext {
    return {
      threadId: request.context?.threadId,
      sessionId: request.context?.sessionId || request.options?.sessionId,
      currentInputType: undefined, // Will be set after classification
      currentPattern: request.options?.forcePattern,
      userHistory: request.context?.userHistory,
      environmentContext: request.context?.environmentContext
    };
  }

  protected calculateExecutionTime(startTime: number): number {
    return Date.now() - startTime;
  }

  // Private helper methods

  private async initializeComponents(): Promise<void> {
    // Components are initialized by their constructors
    // This can be extended for additional setup
    console.log('🔧 All components initialized');
  }

  private async precompileWorkflows(): Promise<void> {
    const patterns = Array.from(this.config.domain.patterns.values())
      .map(mode => ({ name: mode.abstractPattern } as CognitivePattern));
    
    await this.config.workflowEngine.precompileWorkflows(patterns);
  }

  private async checkComponent(
    name: string,
    components: Map<string, ComponentHealth>,
    healthCheck: () => Promise<any>
  ): Promise<void> {
    try {
      const startTime = Date.now();
      await healthCheck();
      const latency = Date.now() - startTime;
      
      components.set(name, {
        status: 'healthy',
        latency,
        details: 'Component responsive'
      });
    } catch (error) {
      components.set(name, {
        status: 'unhealthy',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }
}