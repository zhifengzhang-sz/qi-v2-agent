// Production Agent Implementation
//
// Complete implementation of the three-type classification agent using the abstract base classes
// and production-ready components from lib/src/impl/

import type {
  AgentRequest,
  AgentResponse,
  AgentStreamChunk,
  InputClassificationResult,
  AgentConfiguration,
  WorkflowExtractionResult,
  ModelRequest
} from '../core/interfaces/index.js';

import { ThreeTypeAgent } from '../core/abstracts/index.js';

/**
 * Production-ready agent implementation using the three-type classification architecture
 */
export class ProductionAgent extends ThreeTypeAgent {

  // Command Handler Implementation
  protected async handleCommand(
    request: AgentRequest,
    classification: InputClassificationResult,
    startTime: number
  ): Promise<AgentResponse> {
    const commandRequest = this.createCommandRequest(request, classification);
    const result = await this.config.commandHandler.executeCommand(commandRequest);
    const executionTime = this.calculateExecutionTime(startTime);

    return this.createSuccessResponse(
      'command',
      result.content,
      executionTime,
      { 
        name: 'command', 
        description: 'Built-in command execution', 
        purpose: 'Execute system commands',
        characteristics: ['immediate', 'deterministic', 'system-level'],
        abstractKeywords: [], 
        contextWeight: 0 
      }
    );
  }

  // Prompt Handler Implementation
  protected async handlePrompt(
    request: AgentRequest,
    classification: InputClassificationResult,
    startTime: number
  ): Promise<AgentResponse> {
    const modelRequest = this.createModelRequest(request);
    const response = await this.config.modelProvider.invoke(modelRequest);
    const executionTime = this.calculateExecutionTime(startTime);

    return this.createSuccessResponse(
      'prompt',
      response.content,
      executionTime,
      { 
        name: 'conversational', 
        description: 'Direct conversational response', 
        purpose: 'Provide conversational interaction',
        characteristics: ['interactive', 'responsive', 'contextual'],
        abstractKeywords: [], 
        contextWeight: 0.3 
      }
    );
  }

  // Workflow Handler Implementation
  protected async handleWorkflow(
    request: AgentRequest,
    classification: InputClassificationResult,
    startTime: number
  ): Promise<AgentResponse> {
    // Extract workflow from the input
    const workflowExtraction = await this.config.workflowExtractor.extractWorkflow(
      request.input,
      request.context
    );

    if (!workflowExtraction.success) {
      return this.createErrorResponse(
        'workflow',
        workflowExtraction.error || 'Workflow extraction failed',
        this.calculateExecutionTime(startTime)
      );
    }

    // Create initial workflow state
    const initialState = this.createInitialWorkflowState(request, workflowExtraction.pattern);

    // Create executable workflow and execute through the workflow engine
    const executableWorkflow = this.config.workflowEngine.createWorkflow(workflowExtraction.pattern);
    const workflowResult = await this.config.workflowEngine.execute(
      executableWorkflow,
      initialState
    );

    const executionTime = this.calculateExecutionTime(startTime);

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

  // Streaming Command Handler
  protected async *streamCommand(
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

  // Streaming Prompt Handler
  protected async *streamPrompt(
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
      ...this.createModelRequest(request),
      // Enable streaming in configuration
      configuration: {
        ...this.createModelRequest(request).configuration,
        parameters: {
          ...this.createModelRequest(request).configuration.parameters,
          // Add streaming parameter if supported by model provider
        }
      }
    };

    try {
      for await (const chunk of this.config.modelProvider.stream(modelRequest)) {
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

  // Streaming Workflow Handler
  protected async *streamWorkflow(
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
      const workflowExtraction = await this.config.workflowExtractor.extractWorkflow(
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
      const initialState = this.createInitialWorkflowState(request, workflowExtraction.pattern);
      const executableWorkflow = this.config.workflowEngine.createWorkflow(workflowExtraction.pattern);
      
      for await (const chunk of this.config.workflowEngine.stream(executableWorkflow, initialState)) {
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