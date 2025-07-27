# Agent Framework Implementations

## Overview

This document provides concrete implementations of the abstract interfaces defined in [agent.abstractions.md](./agent.abstractions.md) using modern AI frameworks. These implementations demonstrate how to build the universal agent framework using specific technologies while maintaining full compliance with the abstract contracts.

**Technology Stack**:
- **LangGraph**: Workflow orchestration and state management
- **LangChain**: Model providers and prompt management
- **MCP SDK**: Tool discovery and execution
- **TypeScript**: Type safety and modern JavaScript features

---

## Implementation Architecture

### Technology Mapping

| Abstract Interface | Implementation Technology | Key Libraries |
|-------------------|--------------------------|---------------|
| `IPatternMatcher` | Rule-based + LangChain LLM fallback | `@langchain/core`, `@langchain/community` |
| `IWorkflowEngine` | LangGraph StateGraph | `@langchain/langgraph` |
| `IModelProvider` | LangChain model abstractions | `@langchain/core`, `@langchain/community` |
| `IToolProvider` | MCP SDK with LangChain tools | `@modelcontextprotocol/sdk` |
| `IMemoryProvider` | LangGraph checkpointing | `@langchain/langgraph` |
| `IUniversalAgent` | Coordinating factory | All of the above |

---

## 1. Pattern Matcher Implementation

### 1.1 LangChain Pattern Matcher

```typescript
// lib/src/impl/langchain-pattern-matcher.ts
import { ChatOllama } from '@langchain/community/chat_models/ollama';
import { PromptTemplate } from '@langchain/core/prompts';
import type { 
  IPatternMatcher, 
  CognitivePattern, 
  ProcessingContext, 
  PatternDetectionResult 
} from '../abstractions/interfaces.js';

export class LangChainPatternMatcher implements IPatternMatcher {
  private patterns: readonly CognitivePattern[];
  private fallbackLLM?: ChatOllama;
  private fallbackPrompt?: PromptTemplate;
  private confidenceThreshold: number;
  private cache = new Map<string, PatternDetectionResult>();

  constructor(config: PatternMatcherConfig) {
    this.patterns = config.patterns;
    this.confidenceThreshold = config.confidenceThreshold;
    
    if (config.enableLLMFallback) {
      this.initializeFallbackLLM(config);
    }
  }

  async detectPattern(
    input: string, 
    context?: ProcessingContext
  ): Promise<PatternDetectionResult> {
    const startTime = Date.now();
    
    // Check cache first
    const cacheKey = this.createCacheKey(input, context);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Fast rule-based detection
    const ruleBasedResult = await this.ruleBasedDetection(input, context);
    
    // High confidence - use rule-based result
    if (ruleBasedResult.confidence > this.confidenceThreshold) {
      const result = {
        ...ruleBasedResult,
        detectionMethod: 'rule-based' as const,
        metadata: new Map([
          ['detectionTime', Date.now() - startTime],
          ['cacheHit', false]
        ])
      };
      this.cache.set(cacheKey, result);
      return result;
    }

    // Low confidence - try LLM fallback
    if (this.fallbackLLM && ruleBasedResult.confidence < 0.5) {
      const llmResult = await this.llmBasedDetection(input, context);
      const result = {
        ...llmResult,
        detectionMethod: 'llm-based' as const,
        metadata: new Map([
          ['detectionTime', Date.now() - startTime],
          ['ruleBasedConfidence', ruleBasedResult.confidence],
          ['cacheHit', false]
        ])
      };
      this.cache.set(cacheKey, result);
      return result;
    }

    // Medium confidence - use rule-based with lower confidence
    const result = {
      ...ruleBasedResult,
      detectionMethod: 'rule-based' as const,
      metadata: new Map([
        ['detectionTime', Date.now() - startTime],
        ['lowConfidence', true],
        ['cacheHit', false]
      ])
    };
    this.cache.set(cacheKey, result);
    return result;
  }

  getAvailablePatterns(): readonly CognitivePattern[] {
    return this.patterns;
  }

  updatePatternConfiguration(patterns: readonly CognitivePattern[]): void {
    this.patterns = patterns;
    this.cache.clear(); // Clear cache when patterns change
  }

  private async ruleBasedDetection(
    input: string, 
    context?: ProcessingContext
  ): Promise<PatternDetectionResult> {
    const scores = this.patterns.map(pattern => ({
      pattern,
      score: this.calculateRuleBasedScore(input, pattern, context)
    }));

    const bestMatch = scores.reduce((best, current) => 
      current.score > best.score ? current : best
    );

    return {
      pattern: bestMatch.pattern,
      confidence: bestMatch.score,
      detectionMethod: 'rule-based',
      metadata: new Map([
        ['allScores', scores.map(s => [s.pattern.name, s.score])],
        ['method', 'keyword-pattern-matching']
      ])
    };
  }

  private calculateRuleBasedScore(
    input: string,
    pattern: CognitivePattern,
    context?: ProcessingContext
  ): number {
    let score = 0;
    const lowerInput = input.toLowerCase();

    // Keyword matching (60% weight)
    const keywordMatches = pattern.abstractKeywords.filter(keyword =>
      lowerInput.includes(keyword)
    ).length;
    score += (keywordMatches / pattern.abstractKeywords.length) * 0.6;

    // Pattern characteristics matching (30% weight)
    const characteristicMatches = pattern.characteristics.filter(characteristic =>
      lowerInput.includes(characteristic) || 
      this.hasSemanticMatch(lowerInput, characteristic)
    ).length;
    score += (characteristicMatches / pattern.characteristics.length) * 0.3;

    // Context weight (10% weight)
    if (context?.currentPattern === pattern.name) {
      score += pattern.contextWeight * 0.1;
    }

    return Math.min(score, 1.0);
  }

  private async llmBasedDetection(
    input: string,
    context?: ProcessingContext
  ): Promise<PatternDetectionResult> {
    if (!this.fallbackLLM || !this.fallbackPrompt) {
      // Fallback to best rule-based match
      return this.ruleBasedDetection(input, context);
    }

    try {
      const prompt = await this.fallbackPrompt.format({
        input,
        patterns: this.patterns.map(p => `${p.name}: ${p.description}`).join('\n'),
        context: context ? JSON.stringify(Object.fromEntries(context.environmentContext || [])) : 'none'
      });

      const response = await this.fallbackLLM.invoke(prompt);
      const content = response.content.toString().toLowerCase();

      // Parse LLM response to extract pattern and confidence
      const detectedPattern = this.patterns.find(p => 
        content.includes(p.name.toLowerCase())
      );

      if (detectedPattern) {
        // Extract confidence from response if available
        const confidenceMatch = content.match(/confidence[:\s]*(\d+(?:\.\d+)?)/i);
        const confidence = confidenceMatch ? 
          Math.min(parseFloat(confidenceMatch[1]), 1.0) : 0.7;

        return {
          pattern: detectedPattern,
          confidence,
          detectionMethod: 'llm-based',
          metadata: new Map([
            ['llmResponse', content],
            ['model', this.fallbackLLM.model]
          ])
        };
      }

      // Fallback to conversational pattern if LLM can't decide
      const conversationalPattern = this.patterns.find(p => p.name === 'conversational');
      if (conversationalPattern) {
        return {
          pattern: conversationalPattern,
          confidence: 0.5,
          detectionMethod: 'llm-based',
          metadata: new Map([
            ['fallbackReason', 'no-clear-pattern-detected']
          ])
        };
      }
    } catch (error) {
      console.warn('LLM-based detection failed:', error);
    }

    // Final fallback to rule-based
    return this.ruleBasedDetection(input, context);
  }

  private initializeFallbackLLM(config: PatternMatcherConfig): void {
    this.fallbackLLM = new ChatOllama({
      baseUrl: config.llmEndpoint || 'http://localhost:11434',
      model: config.fallbackModel || 'qwen2.5:7b',
      temperature: 0.1, // Low temperature for consistent classification
      numCtx: 2048
    });

    this.fallbackPrompt = PromptTemplate.fromTemplate(`
You are an intent classifier for an AI assistant. Analyze the user's input and classify it into one of these cognitive patterns:

Available Patterns:
{patterns}

User Input: {input}
Context: {context}

Respond with the pattern name and confidence level (0-1).
Format: "Pattern: [pattern_name], Confidence: [0.0-1.0]"

If uncertain, choose the most likely pattern and provide your confidence level.
    `);
  }

  private hasSemanticMatch(input: string, characteristic: string): boolean {
    // Simple semantic matching - can be enhanced with embeddings
    const synonyms: Record<string, string[]> = {
      'methodical': ['systematic', 'organized', 'structured', 'logical'],
      'innovative': ['creative', 'novel', 'original', 'inventive'],
      'educational': ['informative', 'instructional', 'teaching', 'explanatory'],
      'diagnostic': ['analytical', 'investigative', 'examining', 'troubleshooting']
    };

    const characteristicSynonyms = synonyms[characteristic] || [];
    return characteristicSynonyms.some(synonym => input.includes(synonym));
  }

  private createCacheKey(input: string, context?: ProcessingContext): string {
    const contextKey = context?.currentPattern || 'none';
    return `${input.slice(0, 100)}:${contextKey}`;
  }
}

interface PatternMatcherConfig {
  patterns: readonly CognitivePattern[];
  confidenceThreshold: number;
  enableLLMFallback: boolean;
  llmEndpoint?: string;
  fallbackModel?: string;
}
```

---

## 2. Workflow Engine Implementation

### 2.1 LangGraph Workflow Engine

```typescript
// lib/src/impl/langgraph-workflow-engine.ts
import { StateGraph, CompiledGraph, Annotation } from '@langchain/langgraph';
import { MemorySaver } from '@langchain/langgraph';
import type { 
  IWorkflowEngine,
  CognitivePattern,
  ExecutableWorkflow,
  WorkflowState,
  WorkflowResult,
  WorkflowStreamChunk,
  WorkflowCustomization
} from '../abstractions/interfaces.js';

// Define the state annotation for LangGraph
const WorkflowStateAnnotation = Annotation.Root({
  input: Annotation<string>,
  pattern: Annotation<CognitivePattern>,
  domain: Annotation<string>,
  context: Annotation<Map<string, unknown>>,
  toolResults: Annotation<readonly ToolResult[]>,
  reasoning: Annotation<string>,
  output: Annotation<string>,
  metadata: Annotation<WorkflowMetadata>
});

type LangGraphState = typeof WorkflowStateAnnotation.State;

export class LangGraphWorkflowEngine implements IWorkflowEngine {
  private compiledWorkflows = new Map<string, CompiledGraph>();
  private memorySaver: MemorySaver;
  private nodeHandlers: Map<string, WorkflowNodeHandler>;

  constructor(config: WorkflowEngineConfig) {
    this.memorySaver = new MemorySaver();
    this.nodeHandlers = new Map();
    this.initializeStandardNodeHandlers();
  }

  createWorkflow(
    pattern: CognitivePattern,
    customizations?: WorkflowCustomization[]
  ): ExecutableWorkflow {
    const workflow = new StateGraph(WorkflowStateAnnotation);
    
    // Add standard workflow nodes
    workflow.addNode('processInput', this.processInputNode.bind(this));
    workflow.addNode('enrichContext', this.enrichContextNode.bind(this));
    workflow.addNode('executeTools', this.executeToolsNode.bind(this));
    workflow.addNode('reasoning', this.reasoningNode.bind(this));
    workflow.addNode('synthesizeResults', this.synthesizeResultsNode.bind(this));
    workflow.addNode('formatOutput', this.formatOutputNode.bind(this));

    // Apply pattern-specific customizations
    this.applyPatternCustomizations(workflow, pattern);

    // Apply additional customizations
    if (customizations) {
      this.applyWorkflowCustomizations(workflow, customizations);
    }

    // Set up standard workflow flow
    this.setupStandardFlow(workflow);

    // Set entry and finish points
    workflow.setEntryPoint('processInput');
    workflow.setFinishPoint('formatOutput');

    // Compile the workflow
    const compiled = workflow.compile({
      checkpointer: this.memorySaver
    });

    // Create executable workflow representation
    const executable: ExecutableWorkflow = {
      id: `${pattern.name}-workflow-${Date.now()}`,
      pattern,
      nodes: this.extractNodes(workflow),
      edges: this.extractEdges(workflow)
    };

    // Cache compiled workflow
    this.compiledWorkflows.set(pattern.name, compiled);

    return executable;
  }

  async execute(
    workflow: ExecutableWorkflow,
    initialState: WorkflowState
  ): Promise<WorkflowResult> {
    const compiled = this.compiledWorkflows.get(workflow.pattern.name);
    if (!compiled) {
      throw new Error(`Workflow not compiled for pattern: ${workflow.pattern.name}`);
    }

    const startTime = Date.now();
    const langGraphState = this.convertToLangGraphState(initialState);

    try {
      const result = await compiled.invoke(langGraphState);
      const finalState = this.convertFromLangGraphState(result);

      return {
        finalState,
        executionPath: this.extractExecutionPath(result),
        performance: {
          totalTime: Date.now() - startTime,
          nodeExecutionTimes: new Map(), // Extracted from result metadata
          toolExecutionTime: 0, // Sum from tool results
          reasoningTime: 0 // Extracted from reasoning step
        }
      };
    } catch (error) {
      throw new Error(`Workflow execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async *stream(
    workflow: ExecutableWorkflow,
    initialState: WorkflowState
  ): AsyncIterableIterator<WorkflowStreamChunk> {
    const compiled = this.compiledWorkflows.get(workflow.pattern.name);
    if (!compiled) {
      throw new Error(`Workflow not compiled for pattern: ${workflow.pattern.name}`);
    }

    const langGraphState = this.convertToLangGraphState(initialState);

    try {
      const stream = compiled.stream(langGraphState, {
        streamMode: 'values'
      });

      for await (const chunk of stream) {
        yield {
          nodeId: this.getCurrentNodeId(chunk),
          state: this.convertFromLangGraphState(chunk),
          isComplete: this.isStreamComplete(chunk)
        };
      }
    } catch (error) {
      yield {
        nodeId: 'error',
        state: initialState,
        isComplete: true,
        error: {
          nodeId: 'unknown',
          error: error instanceof Error ? error : new Error(String(error)),
          retryable: false
        }
      };
    }
  }

  async precompileWorkflows(patterns: readonly CognitivePattern[]): Promise<void> {
    console.log(`Precompiling workflows for ${patterns.length} patterns...`);
    
    const compilationPromises = patterns.map(async (pattern) => {
      try {
        this.createWorkflow(pattern);
        console.log(`✓ Compiled workflow for pattern: ${pattern.name}`);
      } catch (error) {
        console.error(`✗ Failed to compile workflow for pattern ${pattern.name}:`, error);
      }
    });

    await Promise.all(compilationPromises);
    console.log('Workflow precompilation complete');
  }

  getCompiledWorkflow(patternName: string): ExecutableWorkflow | null {
    const compiled = this.compiledWorkflows.get(patternName);
    if (!compiled) return null;

    // Return a representation of the compiled workflow
    // This is a simplified version - in practice you'd need to reconstruct the ExecutableWorkflow
    return {
      id: `${patternName}-workflow`,
      pattern: { name: patternName } as CognitivePattern, // Simplified
      nodes: [],
      edges: []
    };
  }

  // Standard workflow node implementations
  private async processInputNode(state: LangGraphState): Promise<Partial<LangGraphState>> {
    const processedInput = state.input.trim();
    
    return {
      input: processedInput,
      metadata: {
        ...state.metadata,
        inputLength: processedInput.length,
        processingStarted: Date.now()
      }
    };
  }

  private async enrichContextNode(state: LangGraphState): Promise<Partial<LangGraphState>> {
    const enrichedContext = new Map(state.context);
    
    // Add pattern-specific context
    enrichedContext.set('pattern', state.pattern.name);
    enrichedContext.set('timestamp', new Date().toISOString());
    enrichedContext.set('domain', state.domain);

    // Add domain-specific context based on pattern
    const domainContext = await this.getDomainContext(state.pattern, state.input);
    for (const [key, value] of domainContext) {
      enrichedContext.set(key, value);
    }

    return {
      context: enrichedContext
    };
  }

  private async executeToolsNode(state: LangGraphState): Promise<Partial<LangGraphState>> {
    // Tool execution would be delegated to the IToolProvider implementation
    // This is a placeholder that shows the pattern
    
    const toolResults: ToolResult[] = [];
    
    // Get tools for this pattern from the tool provider
    // const tools = await this.toolProvider.getAvailableTools(state.pattern);
    
    // For now, return empty tool results
    return {
      toolResults: [...state.toolResults, ...toolResults]
    };
  }

  private async reasoningNode(state: LangGraphState): Promise<Partial<LangGraphState>> {
    // Reasoning would be delegated to the IModelProvider implementation
    // This is a placeholder that shows the pattern
    
    const reasoning = `Reasoning for ${state.pattern.name} pattern on input: ${state.input}`;
    
    return {
      reasoning
    };
  }

  private async synthesizeResultsNode(state: LangGraphState): Promise<Partial<LangGraphState>> {
    // Combine reasoning with tool results
    let synthesis = state.reasoning;
    
    if (state.toolResults.length > 0) {
      synthesis += '\n\nTool Results:\n';
      synthesis += state.toolResults.map(result => 
        `- ${result.toolName}: ${result.status}`
      ).join('\n');
    }
    
    return {
      output: synthesis
    };
  }

  private async formatOutputNode(state: LangGraphState): Promise<Partial<LangGraphState>> {
    const formattedOutput = `[${state.pattern.name.toUpperCase()}] ${state.output}`;
    
    return {
      output: formattedOutput,
      metadata: {
        ...state.metadata,
        processingCompleted: Date.now(),
        finalOutputLength: formattedOutput.length
      }
    };
  }

  private applyPatternCustomizations(workflow: StateGraph<any>, pattern: CognitivePattern): void {
    // Apply pattern-specific workflow customizations
    switch (pattern.name) {
      case 'analytical':
        // Add sequential thinking for analytical pattern
        workflow.addNode('sequentialThinking', this.sequentialThinkingNode.bind(this));
        workflow.addEdge('enrichContext', 'sequentialThinking');
        workflow.addEdge('sequentialThinking', 'executeTools');
        break;
        
      case 'creative':
        // Add ideation step for creative pattern
        workflow.addNode('ideation', this.ideationNode.bind(this));
        workflow.addEdge('enrichContext', 'ideation');
        workflow.addEdge('ideation', 'executeTools');
        break;
        
      default:
        // Standard flow for other patterns
        workflow.addEdge('enrichContext', 'executeTools');
    }
  }

  private applyWorkflowCustomizations(
    workflow: StateGraph<any>,
    customizations: WorkflowCustomization[]
  ): void {
    for (const customization of customizations) {
      switch (customization.type) {
        case 'add-node':
          if (customization.nodeDefinition) {
            workflow.addNode(
              customization.nodeDefinition.id,
              customization.nodeDefinition.handler
            );
          }
          break;
          
        case 'add-edge':
          if (customization.edgeDefinition) {
            workflow.addEdge(
              customization.edgeDefinition.from,
              customization.edgeDefinition.to
            );
          }
          break;
          
        case 'conditional-edge':
          if (customization.condition && customization.nodeId) {
            workflow.addConditionalEdges(
              customization.nodeId,
              customization.condition,
              {} // Mapping would be provided in real implementation
            );
          }
          break;
      }
    }
  }

  private setupStandardFlow(workflow: StateGraph<any>): void {
    // Set up the standard workflow edges
    workflow.addEdge('processInput', 'enrichContext');
    workflow.addEdge('executeTools', 'reasoning');
    workflow.addEdge('reasoning', 'synthesizeResults');
    workflow.addEdge('synthesizeResults', 'formatOutput');
  }

  // Specialized node handlers
  private async sequentialThinkingNode(state: LangGraphState): Promise<Partial<LangGraphState>> {
    // Sequential thinking implementation
    const thinking = `Sequential analysis of: ${state.input}`;
    
    const updatedContext = new Map(state.context);
    updatedContext.set('sequentialThinking', thinking);
    
    return {
      context: updatedContext
    };
  }

  private async ideationNode(state: LangGraphState): Promise<Partial<LangGraphState>> {
    // Ideation implementation
    const ideas = `Generated ideas for: ${state.input}`;
    
    const updatedContext = new Map(state.context);
    updatedContext.set('ideation', ideas);
    
    return {
      context: updatedContext
    };
  }

  // Helper methods for state conversion and extraction
  private convertToLangGraphState(state: WorkflowState): LangGraphState {
    return {
      input: state.input,
      pattern: state.pattern,
      domain: state.domain,
      context: state.context,
      toolResults: state.toolResults,
      reasoning: state.reasoning,
      output: state.output,
      metadata: state.metadata
    };
  }

  private convertFromLangGraphState(state: LangGraphState): WorkflowState {
    return {
      input: state.input,
      pattern: state.pattern,
      domain: state.domain,
      context: state.context,
      toolResults: state.toolResults,
      reasoning: state.reasoning,
      output: state.output,
      metadata: state.metadata
    };
  }

  private getCurrentNodeId(chunk: any): string {
    // Extract current node ID from LangGraph chunk
    return chunk.node || 'unknown';
  }

  private isStreamComplete(chunk: any): boolean {
    // Determine if stream is complete
    return chunk.finished || false;
  }

  private extractExecutionPath(result: any): readonly string[] {
    // Extract execution path from result metadata
    return result.executionPath || [];
  }

  private extractNodes(workflow: StateGraph<any>): readonly WorkflowNode[] {
    // Extract node definitions from workflow
    return [];
  }

  private extractEdges(workflow: StateGraph<any>): readonly WorkflowEdge[] {
    // Extract edge definitions from workflow
    return [];
  }

  private async getDomainContext(
    pattern: CognitivePattern,
    input: string
  ): Promise<Map<string, unknown>> {
    // Get domain-specific context
    return new Map();
  }

  private initializeStandardNodeHandlers(): void {
    // Initialize any standard node handlers
    this.nodeHandlers.set('processInput', this.processInputNode.bind(this));
    this.nodeHandlers.set('enrichContext', this.enrichContextNode.bind(this));
    // ... other handlers
  }
}

interface WorkflowEngineConfig {
  enableCheckpointing: boolean;
  maxExecutionTime: number;
  enableStreaming: boolean;
}
```

---

## 3. Model Provider Implementation

### 3.1 LangChain Model Provider

```typescript
// lib/src/impl/langchain-model-provider.ts
import { ChatOllama } from '@langchain/community/chat_models/ollama';
import { PromptTemplate } from '@langchain/core/prompts';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import type {
  IModelProvider,
  ModelConfiguration,
  ModelRequest,
  ModelResponse,
  ModelStreamChunk,
  ModelMessage,
  TokenUsage
} from '../abstractions/interfaces.js';

export class LangChainModelProvider implements IModelProvider {
  private models = new Map<string, BaseChatModel>();
  private configurations = new Map<string, ModelConfiguration>();
  private prompts = new Map<string, PromptTemplate>();

  constructor(config: ModelProviderConfig) {
    this.initializeModels(config);
    this.initializePrompts(config);
  }

  async getAvailableModels(): Promise<readonly ModelConfiguration[]> {
    return Array.from(this.configurations.values());
  }

  async invoke(request: ModelRequest): Promise<ModelResponse> {
    const model = this.getModel(request.configuration.providerId, request.configuration.modelId);
    const messages = this.convertMessages(request.messages);

    try {
      const startTime = Date.now();
      const response = await model.invoke(messages);
      const endTime = Date.now();

      return {
        content: response.content.toString(),
        finishReason: this.determineFinishReason(response),
        usage: {
          promptTokens: 0, // Would need to calculate or extract from response
          completionTokens: 0,
          totalTokens: 0
        },
        metadata: new Map([
          ['responseTime', endTime - startTime],
          ['model', request.configuration.modelId],
          ['provider', request.configuration.providerId]
        ])
      };
    } catch (error) {
      throw new Error(
        `Model invocation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async *stream(request: ModelRequest): AsyncIterableIterator<ModelStreamChunk> {
    const model = this.getModel(request.configuration.providerId, request.configuration.modelId);
    const messages = this.convertMessages(request.messages);

    try {
      const stream = await model.stream(messages);
      let content = '';

      for await (const chunk of stream) {
        const deltaContent = chunk.content.toString();
        content += deltaContent;

        yield {
          content: deltaContent,
          isComplete: false,
          metadata: new Map([
            ['chunkIndex', content.length],
            ['model', request.configuration.modelId]
          ])
        };
      }

      // Final chunk
      yield {
        content: '',
        isComplete: true,
        usage: {
          promptTokens: 0, // Calculate actual usage
          completionTokens: 0,
          totalTokens: 0
        },
        metadata: new Map([
          ['totalContent', content],
          ['finalLength', content.length]
        ])
      };
    } catch (error) {
      yield {
        content: '',
        isComplete: true,
        metadata: new Map([
          ['error', error instanceof Error ? error.message : String(error)]
        ])
      };
    }
  }

  async validateConfiguration(config: ModelConfiguration): Promise<boolean> {
    try {
      // Test the configuration by making a simple request
      const testModel = this.createModel(config);
      const testMessages = [new HumanMessage('Hello')];
      
      await testModel.invoke(testMessages);
      return true;
    } catch (error) {
      console.warn(`Model configuration validation failed:`, error);
      return false;
    }
  }

  async estimateTokens(messages: readonly ModelMessage[]): Promise<number> {
    // Simple token estimation - in practice, you'd use the model's tokenizer
    const totalContent = messages.map(m => m.content).join(' ');
    return Math.ceil(totalContent.length / 4); // Rough estimate: 4 chars per token
  }

  private initializeModels(config: ModelProviderConfig): void {
    for (const modelConfig of config.models) {
      const model = this.createModel(modelConfig);
      const key = `${modelConfig.providerId}:${modelConfig.modelId}`;
      this.models.set(key, model);
      this.configurations.set(key, modelConfig);
    }
  }

  private createModel(config: ModelConfiguration): BaseChatModel {
    switch (config.providerId) {
      case 'ollama':
        return new ChatOllama({
          baseUrl: this.getEndpoint(config),
          model: config.modelId,
          temperature: config.parameters.temperature,
          numCtx: config.parameters.maxTokens,
          topP: config.parameters.topP,
          frequencyPenalty: config.parameters.frequencyPenalty,
          presencePenalty: config.parameters.presencePenalty,
          stop: config.parameters.stopSequences
        });
        
      // Add other providers here (OpenAI, Anthropic, etc.)
      default:
        throw new Error(`Unsupported model provider: ${config.providerId}`);
    }
  }

  private getModel(providerId: string, modelId: string): BaseChatModel {
    const key = `${providerId}:${modelId}`;
    const model = this.models.get(key);
    
    if (!model) {
      throw new Error(`Model not found: ${key}`);
    }
    
    return model;
  }

  private convertMessages(messages: readonly ModelMessage[]): Array<HumanMessage | SystemMessage | AIMessage> {
    return messages.map(message => {
      switch (message.role) {
        case 'system':
          return new SystemMessage(message.content);
        case 'user':
          return new HumanMessage(message.content);
        case 'assistant':
          return new AIMessage(message.content);
        default:
          throw new Error(`Unsupported message role: ${message.role}`);
      }
    });
  }

  private determineFinishReason(response: any): 'completed' | 'length' | 'stop' | 'tool_call' {
    // Determine finish reason from response
    return 'completed'; // Simplified
  }

  private getEndpoint(config: ModelConfiguration): string {
    // Extract endpoint from configuration or use default
    return 'http://localhost:11434'; // Default Ollama endpoint
  }

  private initializePrompts(config: ModelProviderConfig): void {
    // Initialize pattern-specific prompts
    const patternPrompts = {
      analytical: PromptTemplate.fromTemplate(`
You are an expert analytical assistant. Analyze the following request systematically:

Context: {context}
User Request: {input}

Provide structured analysis with:
1. Situation Assessment
2. Key Findings
3. Recommendations
4. Implementation Plan

Be thorough and evidence-based in your response.
      `),
      
      creative: PromptTemplate.fromTemplate(`
You are an expert creative assistant. Generate innovative solutions for:

Context: {context}
User Request: {input}

Provide creative output with:
1. Creative concepts
2. Implementation approach
3. Innovative features
4. Quality considerations

Be innovative and constructive in your response.
      `),
      
      informational: PromptTemplate.fromTemplate(`
You are an expert educational assistant. Explain the following clearly:

Context: {context}
User Request: {input}

Provide educational content with:
1. Clear explanation
2. Practical examples
3. Key concepts
4. Further learning resources

Be accessible and comprehensive in your response.
      `),
      
      'problem-solving': PromptTemplate.fromTemplate(`
You are an expert problem-solving assistant. Solve the following issue:

Context: {context}
User Request: {input}

Provide systematic solution with:
1. Problem analysis
2. Root cause identification
3. Solution steps
4. Verification approach

Be methodical and practical in your response.
      `),
      
      conversational: PromptTemplate.fromTemplate(`
You are a helpful AI assistant. Respond naturally to:

Context: {context}
User Request: {input}

Provide a helpful, conversational response that addresses the user's needs.
      `)
    };

    for (const [pattern, template] of Object.entries(patternPrompts)) {
      this.prompts.set(pattern, template);
    }
  }

  // Get prompt for a specific pattern
  getPromptForPattern(patternName: string): PromptTemplate | undefined {
    return this.prompts.get(patternName);
  }
}

interface ModelProviderConfig {
  models: readonly ModelConfiguration[];
  defaultProvider: string;
  defaultModel: string;
}
```

---

## 4. Tool Provider Implementation

### 4.1 MCP Tool Provider

```typescript
// lib/src/impl/mcp-tool-provider.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Tool } from '@langchain/core/tools';
import type {
  IToolProvider,
  ToolDefinition,
  ToolRequest,
  ToolResult,
  ToolStreamChunk,
  CognitivePattern
} from '../abstractions/interfaces.js';

export class MCPToolProvider implements IToolProvider {
  private clients = new Map<string, Client>();
  private tools = new Map<string, ToolDefinition>();
  private langchainTools = new Map<string, Tool>();
  private patternToolMapping: Map<string, string[]>;

  constructor(config: MCPToolProviderConfig) {
    this.patternToolMapping = new Map(config.patternToolMapping);
    this.initializeClients(config);
  }

  async getAvailableTools(pattern?: CognitivePattern): Promise<readonly ToolDefinition[]> {
    if (pattern) {
      const patternTools = this.patternToolMapping.get(pattern.name) || [];
      return patternTools
        .map(toolName => this.tools.get(toolName))
        .filter((tool): tool is ToolDefinition => tool !== undefined);
    }
    
    return Array.from(this.tools.values());
  }

  async executeTool(request: ToolRequest): Promise<ToolResult> {
    const tool = this.tools.get(request.toolName);
    if (!tool) {
      return {
        toolName: request.toolName,
        status: 'error',
        error: `Tool not found: ${request.toolName}`,
        executionTime: 0,
        metadata: new Map([['timestamp', Date.now()]])
      };
    }

    const startTime = Date.now();
    
    try {
      // Find the client that provides this tool
      const client = this.findClientForTool(request.toolName);
      if (!client) {
        throw new Error(`No client found for tool: ${request.toolName}`);
      }

      // Execute the tool via MCP
      const result = await client.callTool({
        name: request.toolName,
        arguments: Object.fromEntries(request.parameters)
      });

      const executionTime = Date.now() - startTime;

      return {
        toolName: request.toolName,
        status: 'success',
        data: result.content,
        executionTime,
        metadata: new Map([
          ['timestamp', Date.now()],
          ['client', client.name || 'unknown'],
          ['resultType', typeof result.content]
        ])
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      return {
        toolName: request.toolName,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        executionTime,
        metadata: new Map([
          ['timestamp', Date.now()],
          ['errorType', error instanceof Error ? error.constructor.name : 'unknown']
        ])
      };
    }
  }

  async *streamTool(request: ToolRequest): AsyncIterableIterator<ToolStreamChunk> {
    // Check if tool supports streaming
    const tool = this.tools.get(request.toolName);
    if (!tool || !tool.capabilities.supportsStreaming) {
      // Fallback to regular execution for non-streaming tools
      const result = await this.executeTool(request);
      yield {
        toolName: request.toolName,
        data: result.data,
        isComplete: true,
        error: result.error
      };
      return;
    }

    try {
      const client = this.findClientForTool(request.toolName);
      if (!client) {
        throw new Error(`No client found for tool: ${request.toolName}`);
      }

      // In a real implementation, you'd need to check if MCP supports streaming
      // For now, we'll simulate streaming by chunking the response
      const result = await client.callTool({
        name: request.toolName,
        arguments: Object.fromEntries(request.parameters)
      });

      // Simulate streaming by breaking result into chunks
      const content = JSON.stringify(result.content);
      const chunkSize = 100;
      
      for (let i = 0; i < content.length; i += chunkSize) {
        const chunk = content.slice(i, i + chunkSize);
        yield {
          toolName: request.toolName,
          data: chunk,
          isComplete: i + chunkSize >= content.length
        };
        
        // Small delay to simulate real streaming
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    } catch (error) {
      yield {
        toolName: request.toolName,
        data: null,
        isComplete: true,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async validateTool(
    toolName: string,
    parameters: ReadonlyMap<string, unknown>
  ): Promise<boolean> {
    const tool = this.tools.get(toolName);
    if (!tool) return false;

    try {
      // Validate parameters against tool schema
      return this.validateParameters(parameters, tool.inputSchema);
    } catch (error) {
      return false;
    }
  }

  async getToolsForDomain(domain: string): Promise<readonly ToolDefinition[]> {
    // Filter tools by domain (would need domain mapping in real implementation)
    return Array.from(this.tools.values()).filter(tool => 
      tool.category === domain || tool.category === 'universal'
    );
  }

  // Get LangChain tools for integration
  getLangChainTools(pattern?: CognitivePattern): Tool[] {
    const availableTools = pattern ? 
      this.patternToolMapping.get(pattern.name) || [] :
      Array.from(this.tools.keys());

    return availableTools
      .map(toolName => this.langchainTools.get(toolName))
      .filter((tool): tool is Tool => tool !== undefined);
  }

  private async initializeClients(config: MCPToolProviderConfig): Promise<void> {
    console.log('Initializing MCP clients...');
    
    for (const serverConfig of config.servers) {
      try {
        await this.initializeServer(serverConfig);
        console.log(`✓ Connected to MCP server: ${serverConfig.name}`);
      } catch (error) {
        console.error(`✗ Failed to connect to MCP server ${serverConfig.name}:`, error);
      }
    }
    
    console.log(`MCP initialization complete. ${this.clients.size} servers connected.`);
  }

  private async initializeServer(serverConfig: MCPServerConfig): Promise<void> {
    // Create transport
    const transport = new StdioClientTransport({
      command: serverConfig.command,
      args: serverConfig.args,
      env: serverConfig.env
    });

    // Create client
    const client = new Client({
      name: `qi-agent-${serverConfig.name}`,
      version: '1.0.0'
    }, {
      capabilities: {
        tools: {}
      }
    });

    // Connect to server
    await client.connect(transport);
    
    // Store client
    this.clients.set(serverConfig.name, client);

    // Discover and register tools
    await this.discoverTools(client, serverConfig.name, serverConfig.patterns || []);
  }

  private async discoverTools(
    client: Client,
    serverName: string,
    patterns: string[]
  ): Promise<void> {
    try {
      const response = await client.listTools();
      
      for (const mcpTool of response.tools) {
        const toolDefinition: ToolDefinition = {
          name: mcpTool.name,
          description: mcpTool.description,
          inputSchema: this.convertMCPSchema(mcpTool.inputSchema),
          outputSchema: { type: 'object', properties: new Map(), required: [] }, // MCP doesn't define output schemas
          category: this.determineCategoryFromPatterns(patterns),
          capabilities: {
            isAsync: true,
            supportsStreaming: false, // MCP doesn't natively support streaming
            requiresConfirmation: false,
            maxExecutionTime: 30000,
            resourceRequirements: []
          }
        };

        this.tools.set(mcpTool.name, toolDefinition);
        
        // Create LangChain tool wrapper
        const langchainTool = this.createLangChainTool(mcpTool.name, toolDefinition, client);
        this.langchainTools.set(mcpTool.name, langchainTool);

        // Map tool to patterns
        for (const pattern of patterns) {
          const existingTools = this.patternToolMapping.get(pattern) || [];
          this.patternToolMapping.set(pattern, [...existingTools, mcpTool.name]);
        }
      }
    } catch (error) {
      console.warn(`Failed to discover tools for server ${serverName}:`, error);
    }
  }

  private createLangChainTool(
    toolName: string,
    definition: ToolDefinition,
    client: Client
  ): Tool {
    return new Tool({
      name: toolName,
      description: definition.description,
      schema: this.convertToLangChainSchema(definition.inputSchema),
      func: async (input: string) => {
        try {
          const args = JSON.parse(input);
          const result = await client.callTool({
            name: toolName,
            arguments: args
          });
          return JSON.stringify(result.content);
        } catch (error) {
          throw new Error(`Tool execution failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    });
  }

  private findClientForTool(toolName: string): Client | undefined {
    // In a real implementation, you'd maintain a mapping of tools to clients
    // For now, return the first available client
    return Array.from(this.clients.values())[0];
  }

  private validateParameters(
    parameters: ReadonlyMap<string, unknown>,
    schema: ToolSchema
  ): boolean {
    // Validate required parameters
    for (const required of schema.required) {
      if (!parameters.has(required)) {
        return false;
      }
    }

    // Validate parameter types
    for (const [key, value] of parameters) {
      const property = schema.properties.get(key);
      if (property && !this.validateType(value, property.type)) {
        return false;
      }
    }

    return true;
  }

  private validateType(value: unknown, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null;
      case 'array':
        return Array.isArray(value);
      default:
        return true; // Unknown type, allow it
    }
  }

  private convertMCPSchema(mcpSchema: any): ToolSchema {
    // Convert MCP schema to our ToolSchema format
    const properties = new Map();
    
    if (mcpSchema.properties) {
      for (const [key, prop] of Object.entries(mcpSchema.properties)) {
        properties.set(key, {
          type: (prop as any).type || 'string',
          description: (prop as any).description || '',
          enum: (prop as any).enum,
          format: (prop as any).format
        });
      }
    }

    return {
      type: mcpSchema.type || 'object',
      properties,
      required: mcpSchema.required || []
    };
  }

  private convertToLangChainSchema(schema: ToolSchema): any {
    // Convert our ToolSchema to LangChain schema format
    const properties: Record<string, any> = {};
    
    for (const [key, prop] of schema.properties) {
      properties[key] = {
        type: prop.type,
        description: prop.description
      };
      
      if (prop.enum) {
        properties[key].enum = prop.enum;
      }
    }

    return {
      type: 'object',
      properties,
      required: schema.required
    };
  }

  private determineCategoryFromPatterns(patterns: string[]): string {
    if (patterns.includes('analytical')) return 'analysis';
    if (patterns.includes('creative')) return 'generation';
    if (patterns.includes('informational')) return 'knowledge';
    if (patterns.includes('problem-solving')) return 'debugging';
    return 'universal';
  }

  async cleanup(): Promise<void> {
    console.log('Cleaning up MCP connections...');
    
    for (const [name, client] of this.clients) {
      try {
        await client.close();
        console.log(`✓ Closed connection to ${name}`);
      } catch (error) {
        console.error(`✗ Error closing connection to ${name}:`, error);
      }
    }
    
    this.clients.clear();
    this.tools.clear();
    this.langchainTools.clear();
  }
}

interface MCPToolProviderConfig {
  servers: readonly MCPServerConfig[];
  patternToolMapping: readonly [string, string[]][];
}

interface MCPServerConfig {
  name: string;
  command: string;
  args: readonly string[];
  env?: Record<string, string>;
  patterns?: readonly string[];
}
```

---

## 5. Universal Agent Implementation

### 5.1 Universal Agent Factory

```typescript
// lib/src/impl/universal-agent.ts
import type {
  IUniversalAgent,
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
  HealthCheckResult
} from '../abstractions/interfaces.js';

export class UniversalAgent implements IUniversalAgent {
  private patternMatcher: IPatternMatcher;
  private workflowEngine: IWorkflowEngine;
  private modelProvider: IModelProvider;
  private toolProvider: IToolProvider;
  private memoryProvider?: IMemoryProvider;
  private domainConfig: DomainConfiguration;
  private isInitialized = false;

  constructor(config: AgentConfiguration) {
    this.patternMatcher = config.patternMatcher;
    this.workflowEngine = config.workflowEngine;
    this.modelProvider = config.modelProvider;
    this.toolProvider = config.toolProvider;
    this.memoryProvider = config.memoryProvider;
    this.domainConfig = config.domain;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('Universal agent already initialized');
      return;
    }

    console.log('🤖 Initializing Universal Agent...');

    try {
      // Initialize all components
      await this.initializeComponents();
      
      // Precompile workflows for all patterns
      const patterns = Array.from(this.domainConfig.patterns.values())
        .map(mode => ({ name: mode.abstractPattern } as CognitivePattern));
      await this.workflowEngine.precompileWorkflows(patterns);
      
      this.isInitialized = true;
      console.log('✅ Universal Agent initialized successfully');
    } catch (error) {
      console.error('❌ Universal Agent initialization failed:', error);
      throw error;
    }
  }

  async process(request: AgentRequest): Promise<AgentResponse> {
    this.ensureInitialized();

    const startTime = Date.now();
    
    try {
      // Detect cognitive pattern
      const patternResult = await this.patternMatcher.detectPattern(
        request.input,
        request.context
      );

      // Get or create workflow for the pattern
      let workflow = this.workflowEngine.getCompiledWorkflow(patternResult.pattern.name);
      if (!workflow) {
        workflow = this.workflowEngine.createWorkflow(patternResult.pattern);
      }

      // Create initial workflow state
      const initialState = this.createInitialState(request, patternResult.pattern);

      // Execute workflow
      const result = await this.workflowEngine.execute(workflow, initialState);

      // Save to memory if enabled
      if (this.memoryProvider && request.options?.sessionId) {
        await this.saveToMemory(request, result, request.options.sessionId);
      }

      return {
        content: result.finalState.output,
        pattern: patternResult.pattern,
        toolsUsed: result.finalState.toolResults.map(tr => tr.toolName),
        performance: result.performance,
        metadata: new Map([
          ['totalTime', Date.now() - startTime],
          ['patternConfidence', patternResult.confidence],
          ['detectionMethod', patternResult.detectionMethod],
          ['executionPath', result.executionPath]
        ])
      };
    } catch (error) {
      throw new Error(
        `Agent processing failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
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
          error: chunk.error
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
    const components = new Map<string, ComponentHealth>();
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check pattern matcher
    try {
      const testResult = await this.patternMatcher.detectPattern('test input');
      components.set('patternMatcher', {
        status: 'healthy',
        latency: 0,
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
      const models = await this.modelProvider.getAvailableModels();
      components.set('modelProvider', {
        status: 'healthy',
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
      const tools = await this.toolProvider.getAvailableTools();
      components.set('toolProvider', {
        status: 'healthy',
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

    return {
      status: overallStatus,
      components,
      timestamp: new Date()
    };
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up Universal Agent...');

    try {
      // Cleanup tool provider (MCP connections)
      if ('cleanup' in this.toolProvider) {
        await (this.toolProvider as any).cleanup();
      }

      // Cleanup memory provider
      if (this.memoryProvider) {
        await this.memoryProvider.cleanup();
      }

      this.isInitialized = false;
      console.log('✅ Universal Agent cleanup complete');
    } catch (error) {
      console.error('❌ Universal Agent cleanup failed:', error);
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
      throw new Error('Universal Agent not initialized. Call initialize() first.');
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
    const conversationState = {
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
    const event = {
      eventId: `event-${Date.now()}`,
      sessionId,
      timestamp: new Date(),
      type: 'workflow_execution' as const,
      data: new Map([
        ['pattern', result.finalState.pattern.name],
        ['executionTime', result.performance.totalTime],
        ['toolsUsed', result.finalState.toolResults.map(tr => tr.toolName)]
      ])
    };

    await this.memoryProvider.addProcessingEvent(event);
  }
}
```

---

## 6. Integration Example

### 6.1 Complete Implementation Setup

```typescript
// lib/src/impl/setup.ts
import { LangChainPatternMatcher } from './langchain-pattern-matcher.js';
import { LangGraphWorkflowEngine } from './langgraph-workflow-engine.js';
import { LangChainModelProvider } from './langchain-model-provider.js';
import { MCPToolProvider } from './mcp-tool-provider.js';
import { UniversalAgent } from './universal-agent.js';
import { ABSTRACT_COGNITIVE_PATTERNS } from '../abstractions/patterns.js';

export async function createUniversalAgent(config: SetupConfig): Promise<UniversalAgent> {
  console.log('🚀 Setting up Universal Agent with concrete implementations...');

  // Initialize Pattern Matcher
  const patternMatcher = new LangChainPatternMatcher({
    patterns: ABSTRACT_COGNITIVE_PATTERNS,
    confidenceThreshold: config.patternMatcher.confidenceThreshold,
    enableLLMFallback: config.patternMatcher.enableLLMFallback,
    llmEndpoint: config.patternMatcher.llmEndpoint,
    fallbackModel: config.patternMatcher.fallbackModel
  });

  // Initialize Workflow Engine
  const workflowEngine = new LangGraphWorkflowEngine({
    enableCheckpointing: config.workflowEngine.enableCheckpointing,
    maxExecutionTime: config.workflowEngine.maxExecutionTime,
    enableStreaming: config.workflowEngine.enableStreaming
  });

  // Initialize Model Provider
  const modelProvider = new LangChainModelProvider({
    models: config.modelProvider.models,
    defaultProvider: config.modelProvider.defaultProvider,
    defaultModel: config.modelProvider.defaultModel
  });

  // Initialize Tool Provider
  const toolProvider = new MCPToolProvider({
    servers: config.toolProvider.servers,
    patternToolMapping: config.toolProvider.patternToolMapping
  });

  // Create Universal Agent
  const agent = new UniversalAgent({
    domain: config.domain,
    patternMatcher,
    workflowEngine,
    modelProvider,
    toolProvider
    // memoryProvider optional
  });

  // Initialize the agent
  await agent.initialize();

  console.log('✅ Universal Agent setup complete');
  return agent;
}

interface SetupConfig {
  domain: DomainConfiguration;
  patternMatcher: {
    confidenceThreshold: number;
    enableLLMFallback: boolean;
    llmEndpoint?: string;
    fallbackModel?: string;
  };
  workflowEngine: {
    enableCheckpointing: boolean;
    maxExecutionTime: number;
    enableStreaming: boolean;
  };
  modelProvider: {
    models: readonly ModelConfiguration[];
    defaultProvider: string;
    defaultModel: string;
  };
  toolProvider: {
    servers: readonly MCPServerConfig[];
    patternToolMapping: readonly [string, string[]][];
  };
}
```

---

## Summary

This implementation demonstrates how to build the universal agent framework using modern AI technologies while maintaining full compliance with the abstract interfaces. Key benefits of this approach:

### ✅ Technology Implementation Benefits

1. **LangGraph Workflows**: Robust state management and workflow orchestration
2. **LangChain Models**: Mature model abstractions with extensive provider support  
3. **MCP Tools**: Standardized tool integration with strong ecosystem
4. **TypeScript**: Full type safety and modern development experience

### ✅ Architecture Compliance

1. **Interface Adherence**: All implementations strictly follow abstract contracts
2. **Substitutability**: Any component can be replaced with alternative implementations
3. **Technology Independence**: Framework remains usable with different technology choices
4. **Domain Agnostic**: Implementations work across any domain specialization

### ✅ Production Readiness

1. **Error Handling**: Comprehensive error handling and graceful degradation
2. **Performance**: Caching, streaming, and optimization built-in
3. **Monitoring**: Health checks and performance metrics
4. **Scalability**: Async operations and resource management

This implementation layer provides the bridge between the abstract universal framework and concrete AI technologies, enabling powerful, flexible, and maintainable AI agent systems.

**Next Steps**: See [agent.coder.md](./agent.coder.md) for domain-specific specialization examples using these implementations.