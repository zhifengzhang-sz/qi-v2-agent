// Three-Type Agent Abstract Base Class
//
// Implements the three-type classification routing logic:
// Input → InputClassifier → (Command|Prompt|Workflow) → Handler → Response

import type {
  AgentRequest,
  AgentResponse,
  AgentStreamChunk,
  InputClassificationResult,
  CommandRequest,
  ModelRequest,
  WorkflowState,
  WorkflowResult,
  CognitivePattern,
  ConversationState,
  ProcessingEvent,
  ModelMessage
} from '../interfaces/index.js';

import { BaseAgent } from './base-agent.js';

/**
 * Abstract three-type agent implementing the core routing logic
 */
export abstract class ThreeTypeAgent extends BaseAgent {
  
  async process(request: AgentRequest): Promise<AgentResponse> {
    this.ensureInitialized();
    const startTime = Date.now();
    
    try {
      // CORE BUSINESS LOGIC: Input → InputClassifier → (Command|Prompt|Workflow) → Handler
      const classification = await this.classifyInput(request.input, request.context);
      
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
      // CORE BUSINESS LOGIC: Input → InputClassifier → (Command|Prompt|Workflow) → Handler
      const classification = await this.classifyInput(request.input, request.context);

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

  // Abstract methods for subclasses to implement

  protected abstract handleCommand(
    request: AgentRequest,
    classification: InputClassificationResult,
    startTime: number
  ): Promise<AgentResponse>;

  protected abstract handlePrompt(
    request: AgentRequest,
    classification: InputClassificationResult,
    startTime: number
  ): Promise<AgentResponse>;

  protected abstract handleWorkflow(
    request: AgentRequest,
    classification: InputClassificationResult,
    startTime: number
  ): Promise<AgentResponse>;

  protected abstract streamCommand(
    request: AgentRequest,
    classification: InputClassificationResult
  ): AsyncIterableIterator<AgentStreamChunk>;

  protected abstract streamPrompt(
    request: AgentRequest,
    classification: InputClassificationResult
  ): AsyncIterableIterator<AgentStreamChunk>;

  protected abstract streamWorkflow(
    request: AgentRequest,
    classification: InputClassificationResult
  ): AsyncIterableIterator<AgentStreamChunk>;

  // Helper methods for subclasses

  protected createCommandRequest(
    request: AgentRequest,
    classification: InputClassificationResult
  ): CommandRequest {
    return {
      commandName: classification.extractedData.get('command') as string,
      parameters: new Map(classification.extractedData.get('args') as Array<[string, unknown]> || []),
      rawInput: request.input,
      context: request.context
    };
  }

  protected createModelRequest(
    request: AgentRequest,
    modelId = 'qwen2.5:7b'
  ): ModelRequest {
    return {
      messages: [{
        role: 'user',
        content: request.input,
        metadata: new Map()
      }],
      // TODO: ARCHITECTURAL ISSUE - Should use ConfigurationManager instead of hardcoding  
      // This should load from config/qi-config.yaml via dependency injection
      configuration: {
        id: modelId,
        name: modelId,
        providerId: 'ollama',
        modelId,
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
  }

  protected createInitialWorkflowState(
    request: AgentRequest, 
    pattern: CognitivePattern
  ): WorkflowState {
    return {
      input: request.input,
      pattern,
      domain: this.config.domain.domain,
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

  protected async saveToMemory(
    request: AgentRequest,
    result: WorkflowResult,
    sessionId: string
  ): Promise<void> {
    if (!this.config.memoryProvider) return;

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

    await this.config.memoryProvider.saveConversationState(conversationState);

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

    await this.config.memoryProvider.addProcessingEvent(event);
  }

  protected createSuccessResponse(
    inputType: 'command' | 'prompt' | 'workflow',
    content: string,
    executionTime: number,
    pattern?: CognitivePattern,
    toolsUsed: string[] = []
  ): AgentResponse {
    return {
      success: true,
      content,
      inputType,
      pattern,
      toolsUsed,
      performance: {
        totalTime: executionTime,
        nodeExecutionTimes: new Map(),
        toolExecutionTime: 0,
        reasoningTime: 0
      },
      metadata: new Map<string, unknown>([
        ['inputType', inputType],
        ['executionTime', executionTime]
      ])
    };
  }

  protected createErrorResponse(
    inputType: 'command' | 'prompt' | 'workflow',
    error: string,
    executionTime: number
  ): AgentResponse {
    return {
      success: false,
      content: `Failed: ${error}`,
      inputType,
      toolsUsed: [],
      performance: {
        totalTime: executionTime,
        nodeExecutionTimes: new Map(),
        toolExecutionTime: 0,
        reasoningTime: 0
      },
      metadata: new Map<string, unknown>([
        ['inputType', inputType],
        ['executionTime', executionTime],
        ['error', error]
      ]),
      error
    };
  }
}