/**
 * @qi/workflow - Qi Workflow Extractor Implementation
 *
 * LangChain structured output workflow extractor adapted for app layer
 */

import {
  create,
  type ErrorCategory,
  failure,
  flatMap,
  fromAsyncTryCatch,
  match,
  type QiError,
  type Result,
  success,
} from '@qi/base';
import type {
  IWorkflowExtractor,
  IWorkflowExtractorConfig,
  ProcessingContext,
  WorkflowExtractionMethod,
  WorkflowExtractionResult,
  WorkflowMode,
  WorkflowSpec,
} from '../interfaces/index.js';
import type {
  IDecompositionStrategy,
  WorkflowContext,
} from '../strategies/IDecompositionStrategy.js';

/**
 * Workflow extractor error factory using QiCore patterns
 */
const _createWorkflowExtractorError = (
  code: string,
  message: string,
  category: ErrorCategory,
  context: Record<string, unknown> = {}
): QiError => create(code, message, category, context);

// JSON Schema for workflow specification (replacing broken Zod schemas)
const _WorkflowSpecSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    description: { type: 'string' },
    nodes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          type: {
            type: 'string',
            enum: ['input', 'processing', 'tool', 'reasoning', 'output', 'decision', 'validation'],
          },
          parameters: { type: 'object' },
          requiredTools: { type: 'array', items: { type: 'string' } },
          conditions: { type: 'array' },
          dependencies: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'name', 'type', 'parameters'],
      },
    },
    edges: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          condition: { type: 'object' },
          priority: { type: 'number' },
        },
        required: ['from', 'to'],
      },
    },
    parameters: { type: 'object' },
    steps: { type: 'array' },
  },
  required: ['id', 'name', 'description', 'nodes', 'edges', 'parameters', 'steps'],
};

export class QiWorkflowExtractor implements IWorkflowExtractor {
  private supportedModes: readonly WorkflowMode[];
  private strategies: readonly IDecompositionStrategy[];
  private templateModes: readonly string[];
  private defaultMethod?: WorkflowExtractionMethod;

  constructor(config: IWorkflowExtractorConfig) {
    this.supportedModes = config.supportedModes;
    this.strategies = config.strategies;
    this.templateModes = config.templateModes || [];
    this.defaultMethod = config.defaultMethod;
  }

  /**
   * Analyze complexity using QiCore Result patterns
   */
  private analyzeComplexityWithQiCore(
    input: string,
    context?: ProcessingContext
  ): Result<{ detectedMode: string; confidence: number }> {
    if (!input || input.trim().length === 0) {
      return failure(
        _createWorkflowExtractorError('INVALID_INPUT', 'Input cannot be empty', 'VALIDATION')
      );
    }

    // Simple rule-based mode detection
    const inputLower = input.toLowerCase();
    let detectedMode = 'general';
    let confidence = 0.5;

    if (
      inputLower.includes('analyze') ||
      inputLower.includes('study') ||
      inputLower.includes('examine')
    ) {
      detectedMode = 'analytical';
      confidence = 0.8;
    } else if (
      inputLower.includes('create') ||
      inputLower.includes('generate') ||
      inputLower.includes('design')
    ) {
      detectedMode = 'creative';
      confidence = 0.8;
    } else if (
      inputLower.includes('fix') ||
      inputLower.includes('solve') ||
      inputLower.includes('debug')
    ) {
      detectedMode = 'problem-solving';
      confidence = 0.8;
    }

    return success({ detectedMode, confidence });
  }

  /**
   * Generate workflow from template using QiCore patterns
   */
  private generateWorkflowFromTemplate(
    input: string,
    mode: string,
    pattern: string
  ): Result<WorkflowSpec> {
    // Generate a simple workflow based on the mode
    const workflowId = `workflow_${Date.now()}`;
    const nodes = this.getTemplateNodesForMode(mode, input);
    const edges = this.getTemplateEdgesForNodes(nodes);

    const workflowSpec: WorkflowSpec = {
      id: workflowId,
      name: `${mode} workflow for: ${input.substring(0, 50)}...`,
      description: `Auto-generated ${mode} workflow`,
      nodes,
      edges,
      parameters: new Map([
        ['mode', mode],
        ['pattern', pattern],
        ['generated_at', new Date().toISOString()],
      ]),
      steps: nodes,
    };

    return success(workflowSpec);
  }

  /**
   * Get template nodes for a specific mode
   */
  private getTemplateNodesForMode(mode: string, input: string) {
    const baseNodes = [
      {
        id: 'input_node',
        name: 'Input Processing',
        type: 'input' as const,
        parameters: new Map([['task', input]]),
        requiredTools: [],
        conditions: [],
        dependencies: [],
      },
    ];

    switch (mode) {
      case 'analytical':
        return [
          ...baseNodes,
          {
            id: 'analysis_node',
            name: 'Data Analysis',
            type: 'processing' as const,
            parameters: new Map(),
            requiredTools: ['analysis-tools'],
            conditions: [],
            dependencies: ['input_node'],
          },
          {
            id: 'reasoning_node',
            name: 'Reasoning',
            type: 'reasoning' as const,
            parameters: new Map(),
            requiredTools: [],
            conditions: [],
            dependencies: ['analysis_node'],
          },
          {
            id: 'output_node',
            name: 'Output Results',
            type: 'output' as const,
            parameters: new Map(),
            requiredTools: [],
            conditions: [],
            dependencies: ['reasoning_node'],
          },
        ];

      case 'creative':
        return [
          ...baseNodes,
          {
            id: 'ideation_node',
            name: 'Ideation',
            type: 'processing' as const,
            parameters: new Map(),
            requiredTools: ['creation-tools'],
            conditions: [],
            dependencies: ['input_node'],
          },
          {
            id: 'creation_node',
            name: 'Creation',
            type: 'processing' as const,
            parameters: new Map(),
            requiredTools: ['creation-tools'],
            conditions: [],
            dependencies: ['ideation_node'],
          },
          {
            id: 'output_node',
            name: 'Output Results',
            type: 'output' as const,
            parameters: new Map(),
            requiredTools: [],
            conditions: [],
            dependencies: ['creation_node'],
          },
        ];

      case 'problem-solving':
        return [
          ...baseNodes,
          {
            id: 'diagnosis_node',
            name: 'Problem Diagnosis',
            type: 'processing' as const,
            parameters: new Map(),
            requiredTools: ['diagnostic-tools'],
            conditions: [],
            dependencies: ['input_node'],
          },
          {
            id: 'solution_node',
            name: 'Solution Generation',
            type: 'processing' as const,
            parameters: new Map(),
            requiredTools: ['diagnostic-tools'],
            conditions: [],
            dependencies: ['diagnosis_node'],
          },
          {
            id: 'output_node',
            name: 'Output Results',
            type: 'output' as const,
            parameters: new Map(),
            requiredTools: [],
            conditions: [],
            dependencies: ['solution_node'],
          },
        ];

      default:
        return [
          ...baseNodes,
          {
            id: 'processing_node',
            name: 'General Processing',
            type: 'processing' as const,
            parameters: new Map(),
            requiredTools: [],
            conditions: [],
            dependencies: ['input_node'],
          },
          {
            id: 'output_node',
            name: 'Output Results',
            type: 'output' as const,
            parameters: new Map(),
            requiredTools: [],
            conditions: [],
            dependencies: ['processing_node'],
          },
        ];
    }
  }

  /**
   * Generate edges based on node dependencies
   */
  private getTemplateEdgesForNodes(nodes: any[]) {
    const edges = [];

    for (const node of nodes) {
      for (const dependency of node.dependencies) {
        edges.push({
          from: dependency,
          to: node.id,
          condition: undefined,
        });
      }
    }

    return edges;
  }

  /**
   * Get pattern for a given mode
   */
  private getPatternForMode(mode: string): string {
    return mode; // Pattern is same as mode for template-based
  }

  async extractWorkflow(
    input: string,
    method: WorkflowExtractionMethod,
    context: WorkflowContext
  ): Promise<WorkflowExtractionResult> {
    const startTime = Date.now();

    // Extract based on the specified method
    switch (method.method) {
      case 'strategy-based':
        return this.extractWithStrategy(input, method, context, startTime);

      case 'template-based':
        return this.extractWithTemplate(input, method, context, startTime);

      case 'hybrid':
        return this.extractWithHybrid(input, method, context, startTime);

      default:
        return {
          success: false,
          mode: 'error',
          pattern: 'error',
          confidence: 0,
          extractionMethod: method.method,
          error: `Unsupported extraction method: ${method.method}`,
          metadata: new Map([
            ['errorCode', 'UNSUPPORTED_METHOD'],
            ['extractionTime', (Date.now() - startTime).toString()],
          ]),
        };
    }
  }

  /**
   * Extract workflow using research-based strategies (ReAct, ReWOO, ADaPT)
   */
  private async extractWithStrategy(
    input: string,
    method: WorkflowExtractionMethod,
    context: WorkflowContext,
    startTime: number
  ): Promise<WorkflowExtractionResult> {
    // Get the strategy to use
    const strategy =
      method.strategy || (method.strategyName ? this.findStrategy(method.strategyName) : null);

    if (!strategy) {
      return {
        success: false,
        mode: 'error',
        pattern: 'error',
        confidence: 0,
        extractionMethod: 'strategy-based',
        error: 'No strategy specified or strategy not found',
        metadata: new Map([
          ['errorCode', 'NO_STRATEGY'],
          ['extractionTime', (Date.now() - startTime).toString()],
        ]),
      };
    }

    // Use QiCore fromAsyncTryCatch for async operations
    const strategyResult = await fromAsyncTryCatch(
      async () => strategy.decompose(input, context),
      (error) =>
        create(
          'STRATEGY_EXECUTION_FAILED',
          `Strategy ${strategy.name} execution failed: ${error instanceof Error ? error.message : String(error)}`,
          'SYSTEM',
          { strategyName: strategy.name, input }
        )
    );

    return match(
      (workflowSpec) =>
        ({
          success: true,
          workflowSpec,
          mode: strategy.name,
          pattern: strategy.category,
          confidence: 0.9, // High confidence for research-based strategies
          extractionMethod: 'strategy-based' as const,
          metadata: new Map([
            ['strategyName', strategy.name],
            ['strategySource', strategy.source],
            ['extractionTime', (Date.now() - startTime).toString()],
            ['nodeCount', workflowSpec.nodes.length.toString()],
            ['edgeCount', workflowSpec.edges.length.toString()],
          ]),
        }) as WorkflowExtractionResult,
      (error) =>
        ({
          success: false,
          mode: strategy.name,
          pattern: strategy.category,
          confidence: 0,
          extractionMethod: 'strategy-based' as const,
          error: error.message,
          metadata: new Map([
            ['errorCode', error.code],
            ['strategyName', strategy.name],
            ['extractionTime', (Date.now() - startTime).toString()],
          ]),
        }) as WorkflowExtractionResult,
      strategyResult
    );
  }

  /**
   * Extract workflow using template-based approach
   */
  private async extractWithTemplate(
    input: string,
    method: WorkflowExtractionMethod,
    context: WorkflowContext,
    startTime: number
  ): Promise<WorkflowExtractionResult> {
    // Use the old template-based logic
    const analysisResult = this.analyzeComplexityWithQiCore(input, context);

    return match(
      (analysis) => {
        const mode = analysis.detectedMode;
        const pattern = method.templateMode || mode;

        const workflowResult = this.generateWorkflowFromTemplate(input, mode, pattern);

        return match(
          (workflowSpec) =>
            ({
              success: true,
              workflowSpec,
              mode,
              pattern,
              confidence: 0.7,
              extractionMethod: 'template-based' as const,
              metadata: new Map([
                ['extractionTime', (Date.now() - startTime).toString()],
                ['nodeCount', workflowSpec.nodes.length.toString()],
                ['edgeCount', workflowSpec.edges.length.toString()],
              ]),
            }) as WorkflowExtractionResult,
          (error) =>
            ({
              success: false,
              mode,
              pattern,
              confidence: 0,
              extractionMethod: 'template-based' as const,
              error: error.message,
              metadata: new Map([
                ['errorCode', error.code],
                ['extractionTime', (Date.now() - startTime).toString()],
              ]),
            }) as WorkflowExtractionResult,
          workflowResult
        );
      },
      (error) => ({
        success: false,
        mode: 'error',
        pattern: 'error',
        confidence: 0,
        extractionMethod: 'template-based' as const,
        error: error.message,
        metadata: new Map([
          ['errorCode', error.code],
          ['extractionTime', (Date.now() - startTime).toString()],
        ]),
      }),
      analysisResult
    );
  }

  /**
   * Extract workflow using hybrid approach (strategy first, template fallback)
   */
  private async extractWithHybrid(
    input: string,
    method: WorkflowExtractionMethod,
    context: WorkflowContext,
    startTime: number
  ): Promise<WorkflowExtractionResult> {
    // Try strategy-based first if provider is available
    if (method.promptProvider && method.strategyName) {
      const strategyResult = await this.extractWithStrategy(input, method, context, startTime);
      if (strategyResult.success) {
        return strategyResult;
      }
    }

    // Fallback to template-based
    return this.extractWithTemplate(input, method, context, startTime);
  }

  /**
   * Find strategy by name
   */
  private findStrategy(name: string): IDecompositionStrategy | null {
    return this.strategies.find((strategy) => strategy.name === name) || null;
  }

  getSupportedModes(): readonly WorkflowMode[] {
    return this.supportedModes;
  }

  getAvailableStrategies(): readonly IDecompositionStrategy[] {
    return this.strategies;
  }

  async validateWorkflowSpec(spec: WorkflowSpec): Promise<boolean> {
    // Basic validation
    if (!spec.id || !spec.name || !spec.nodes || spec.nodes.length === 0) {
      return false;
    }

    // Validate nodes
    for (const node of spec.nodes) {
      if (!node.id || !node.name || !node.type) {
        return false;
      }
    }

    return true;
  }

  async getWorkflowTemplates(mode: string): Promise<readonly WorkflowSpec[]> {
    // Return empty array for now - templates could be loaded from config
    return [];
  }
}
