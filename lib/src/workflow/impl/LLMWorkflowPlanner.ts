/**
 * @qi/workflow - LLM-Based Workflow Planner
 *
 * Replaces template-based workflow generation with LLM structured output
 * for dynamic workflow planning based on natural language input
 */

import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import type { QiError, Result } from '@qi/base';
import { create, failure, fromAsyncTryCatch, match, success } from '@qi/base';
import { z } from 'zod';
import { createQiLogger, type SimpleLogger } from '../../utils/QiCoreLogger.js';
import type {
  ProcessingContext,
  WorkflowContext,
  WorkflowEdgeSpec,
  WorkflowExtractionResult,
  WorkflowNodeSpec,
  WorkflowSpec,
} from '../interfaces/index.js';

/**
 * Zod schema for LLM workflow generation
 */
const WorkflowPlanSchema = z.object({
  name: z.string().describe('A descriptive name for the workflow'),
  description: z.string().describe('Detailed description of what this workflow accomplishes'),
  mode: z
    .enum(['analytical', 'creative', 'problem-solving', 'informational', 'general'])
    .describe('The type of cognitive processing this workflow performs'),
  nodes: z
    .array(
      z.object({
        id: z.string().describe('Unique identifier for the node'),
        name: z.string().describe('Human-readable name for the node'),
        type: z
          .enum(['input', 'processing', 'tool', 'reasoning', 'output', 'decision', 'validation'])
          .describe('The type of processing this node performs'),
        description: z.string().describe('What this node does in the workflow'),
        requiredTools: z
          .array(z.string())
          .optional()
          .describe('List of tools this node needs to execute'),
        dependencies: z
          .array(z.string())
          .optional()
          .describe('IDs of nodes that must complete before this node can run'),
      })
    )
    .min(3)
    .describe('List of workflow nodes - must have at least input, processing, and output'),
  estimatedComplexity: z
    .enum(['simple', 'medium', 'complex'])
    .describe('Estimated complexity level for resource planning'),
  estimatedDuration: z
    .number()
    .min(1000)
    .max(300000)
    .describe('Estimated execution time in milliseconds'),
});

type WorkflowPlan = z.infer<typeof WorkflowPlanSchema>;

/**
 * LLM providers configuration
 */
interface LLMConfig {
  provider: 'openai' | 'anthropic';
  model?: string;
  apiKey?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Workflow planning error factory
 */
const createWorkflowPlannerError = (
  code: string,
  message: string,
  category: 'VALIDATION' | 'SYSTEM' = 'SYSTEM',
  context: Record<string, unknown> = {}
): QiError => create(code, message, category, context);

/**
 * LLM-based workflow planner
 */
export class LLMWorkflowPlanner {
  private llm: ChatOpenAI | ChatAnthropic;
  private logger: SimpleLogger;
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = {
      model: config.provider === 'openai' ? 'gpt-4o-mini' : 'claude-3-haiku-20240307',
      maxTokens: 4000,
      temperature: 0.1, // Low temperature for consistent structured output
      ...config,
    };

    this.logger = createQiLogger({
      name: 'LLMWorkflowPlanner',
      level: 'info',
    });

    // Initialize LLM based on provider
    if (config.provider === 'openai') {
      this.llm = new ChatOpenAI({
        model: this.config.model,
        apiKey: this.config.apiKey,
        maxTokens: this.config.maxTokens,
        temperature: this.config.temperature,
      });
    } else {
      this.llm = new ChatAnthropic({
        model: this.config.model,
        apiKey: this.config.apiKey,
        maxTokens: this.config.maxTokens,
        temperature: this.config.temperature,
      });
    }
  }

  /**
   * Generate workflow plan using LLM with structured output
   */
  async generateWorkflowPlan(
    input: string,
    context?: WorkflowContext
  ): Promise<Result<WorkflowPlan, QiError>> {
    this.logger.info('🤖 Generating LLM-based workflow plan', undefined, {
      component: 'LLMWorkflowPlanner',
      method: 'generateWorkflowPlan',
      inputLength: input.length,
      provider: this.config.provider,
      model: this.config.model,
    });

    const prompt = this.buildWorkflowPlanningPrompt(input, context);

    const result = await fromAsyncTryCatch(
      async () => {
        const response = await this.llm.invoke([{ role: 'user', content: prompt }]);
        const content = response.content.toString();

        // Parse the JSON response
        let jsonContent: string;
        if (content.includes('```json')) {
          const matches = content.match(/```json\n([\s\S]*?)\n```/);
          jsonContent = matches?.[1] || content;
        } else {
          jsonContent = content;
        }

        const parsedPlan = JSON.parse(jsonContent);

        // Validate against schema
        const validatedPlan = WorkflowPlanSchema.parse(parsedPlan);

        this.logger.info('✅ LLM workflow plan generated successfully', undefined, {
          component: 'LLMWorkflowPlanner',
          method: 'generateWorkflowPlan',
          planName: validatedPlan.name,
          nodeCount: validatedPlan.nodes.length,
          complexity: validatedPlan.estimatedComplexity,
        });

        return validatedPlan;
      },
      (error) =>
        createWorkflowPlannerError(
          'LLM_GENERATION_FAILED',
          `Failed to generate workflow plan: ${error instanceof Error ? error.message : String(error)}`,
          'SYSTEM',
          {
            input: input.substring(0, 100),
            provider: this.config.provider,
            model: this.config.model,
          }
        )
    );

    return result;
  }

  /**
   * Convert LLM-generated plan to WorkflowSpec
   */
  planToWorkflowSpec(plan: WorkflowPlan, input: string): WorkflowSpec {
    // Generate edges based on dependencies
    const edges: WorkflowEdgeSpec[] = [];

    for (const node of plan.nodes) {
      if (node.dependencies && node.dependencies.length > 0) {
        for (const dependency of node.dependencies) {
          edges.push({
            from: dependency,
            to: node.id,
          });
        }
      }
    }

    // If no dependencies specified, create linear flow
    if (edges.length === 0) {
      for (let i = 0; i < plan.nodes.length - 1; i++) {
        edges.push({
          from: plan.nodes[i].id,
          to: plan.nodes[i + 1].id,
        });
      }
    }

    // Convert to WorkflowNodeSpec format
    const nodes: WorkflowNodeSpec[] = plan.nodes.map((node) => ({
      id: node.id,
      name: node.name,
      type: node.type,
      parameters: new Map<string, unknown>([
        ['description', node.description],
        ['generated_by_llm', true],
      ]),
      requiredTools: node.requiredTools || [],
      conditions: [],
      dependencies: node.dependencies || [],
    }));

    const workflowSpec: WorkflowSpec = {
      id: `llm_workflow_${Date.now()}`,
      name: plan.name,
      description: plan.description,
      nodes,
      edges,
      parameters: new Map<string, unknown>([
        ['mode', plan.mode],
        ['input', input],
        ['complexity', plan.estimatedComplexity],
        ['estimated_duration', plan.estimatedDuration],
        ['generated_by', 'llm_planner'],
        ['generated_at', new Date().toISOString()],
        ['provider', this.config.provider],
        ['model', this.config.model],
      ]),
      steps: nodes,
    };

    return workflowSpec;
  }

  /**
   * Build the prompt for workflow planning
   */
  private buildWorkflowPlanningPrompt(input: string, context?: WorkflowContext): string {
    const contextInfo = context
      ? `
Context Information:
- Session ID: ${context.sessionId}
- Available Tools: ${context.availableTools?.join(', ') || 'none specified'}
- Mode: ${context.mode || 'not specified'}
- Resource Limits: ${context.resourceLimits ? JSON.stringify(context.resourceLimits) : 'default'}
`
      : '';

    return `You are a workflow planning AI that generates structured workflows for task execution.

Given a user's request, create a workflow plan that breaks down the task into logical steps.

User Request: "${input}"
${contextInfo}

Requirements:
1. Create 3-7 workflow nodes that logically break down the task
2. Each node should have a clear purpose and type
3. Dependencies should create a logical execution order
4. Choose appropriate tools for each node if needed
5. Estimate complexity and duration realistically

Available Node Types:
- input: Process and validate user input
- processing: Transform, analyze, or manipulate data
- tool: Execute specific tools or external systems
- reasoning: Apply logical analysis or decision making
- output: Format and present final results
- decision: Make conditional choices in the workflow
- validation: Verify results or conditions

Available Workflow Modes:
- analytical: Systematic analysis and investigation
- creative: Generation and synthesis of new content
- problem-solving: Diagnosis and resolution of issues
- informational: Research and knowledge gathering
- general: Basic task processing

Respond with ONLY a JSON object following this exact structure:

\`\`\`json
{
  "name": "Workflow Name",
  "description": "Detailed description of workflow purpose",
  "mode": "analytical|creative|problem-solving|informational|general",
  "nodes": [
    {
      "id": "unique_node_id",
      "name": "Node Name",
      "type": "input|processing|tool|reasoning|output|decision|validation",
      "description": "What this node does",
      "requiredTools": ["tool1", "tool2"],
      "dependencies": ["previous_node_id"]
    }
  ],
  "estimatedComplexity": "simple|medium|complex",
  "estimatedDuration": 5000
}
\`\`\``;
  }

  /**
   * Extract workflow with fallback to template-based approach
   */
  async extractWorkflowWithFallback(
    input: string,
    context?: ProcessingContext
  ): Promise<WorkflowExtractionResult> {
    const startTime = Date.now();

    const extractionResult = await fromAsyncTryCatch(
      async (): Promise<WorkflowExtractionResult> => {
        // Convert ProcessingContext to WorkflowContext
        const workflowContext: WorkflowContext = {
          sessionId: context?.sessionId || 'llm-session',
          userId: context?.userId,
          metadata: context?.metadata,
          environmentContext: context?.environmentContext,
          availableTools: ['text-processing', 'analysis', 'web-search'], // Default tools
          mode: 'intelligent', // LLM mode
        };

        // Try LLM-based generation first
        const planResult = await this.generateWorkflowPlan(input, workflowContext);

        return match(
          (plan) => {
            const workflowSpec = this.planToWorkflowSpec(plan, input);

            const result: WorkflowExtractionResult = {
              success: true,
              workflowSpec,
              mode: plan.mode,
              pattern: plan.mode,
              confidence: 0.9, // High confidence for LLM-generated workflows
              extractionMethod: 'llm-based',
              metadata: new Map<string, string>([
                ['provider', this.config.provider],
                ['model', this.config.model || ''],
                ['complexity', plan.estimatedComplexity],
                ['nodeCount', plan.nodes.length.toString()],
                ['extractionTime', (Date.now() - startTime).toString()],
              ]),
            };

            return result;
          },
          (error) => {
            // Fallback to simple template-based approach
            this.logger.warn('🔄 LLM generation failed, falling back to template', undefined, {
              component: 'LLMWorkflowPlanner',
              method: 'extractWorkflowWithFallback',
              errorMessage: error.message,
            });

            return this.createFallbackWorkflow(input, startTime);
          },
          planResult
        );
      },
      (error: unknown): QiError => ({
        code: 'WORKFLOW_EXTRACTION_FAILED',
        message: `Workflow extraction failed: ${error instanceof Error ? error.message : String(error)}`,
        category: 'SYSTEM',
        context: { input: input.substring(0, 100), extractionTime: Date.now() - startTime },
      })
    );

    if (extractionResult.tag === 'success') {
      return extractionResult.value;
    } else {
      // Fallback for any unexpected errors
      this.logger.error('❌ Workflow extraction failed completely', undefined, {
        component: 'LLMWorkflowPlanner',
        method: 'extractWorkflowWithFallback',
        errorMessage: extractionResult.error.message,
      });

      return this.createFallbackWorkflow(input, startTime);
    }
  }

  /**
   * Create a simple fallback workflow when LLM generation fails
   */
  private createFallbackWorkflow(input: string, startTime: number): WorkflowExtractionResult {
    const mode = this.detectSimpleMode(input);

    const fallbackSpec: WorkflowSpec = {
      id: `fallback_workflow_${Date.now()}`,
      name: `Fallback ${mode} workflow`,
      description: `Simple ${mode} workflow for: ${input.substring(0, 100)}`,
      nodes: [
        {
          id: 'input',
          name: 'Input Processing',
          type: 'input',
          parameters: new Map([['task', input]]),
          requiredTools: [],
          conditions: [],
          dependencies: [],
        },
        {
          id: 'processing',
          name: 'Processing',
          type: 'processing',
          parameters: new Map([['mode', mode]]),
          requiredTools: [],
          conditions: [],
          dependencies: ['input'],
        },
        {
          id: 'output',
          name: 'Output Generation',
          type: 'output',
          parameters: new Map(),
          requiredTools: [],
          conditions: [],
          dependencies: ['processing'],
        },
      ],
      edges: [
        { from: 'input', to: 'processing' },
        { from: 'processing', to: 'output' },
      ],
      parameters: new Map<string, unknown>([
        ['mode', mode],
        ['fallback', true],
        ['input', input],
        ['generated_at', new Date().toISOString()],
      ]),
      steps: [],
    };

    return {
      success: true,
      workflowSpec: fallbackSpec,
      mode,
      pattern: mode,
      confidence: 0.5, // Lower confidence for fallback
      extractionMethod: 'template-based',
      metadata: new Map<string, string>([
        ['fallback', 'true'],
        ['extractionTime', (Date.now() - startTime).toString()],
      ]),
    };
  }

  /**
   * Simple mode detection for fallback
   */
  private detectSimpleMode(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('analyze') || inputLower.includes('study')) {
      return 'analytical';
    } else if (inputLower.includes('create') || inputLower.includes('generate')) {
      return 'creative';
    } else if (inputLower.includes('fix') || inputLower.includes('solve')) {
      return 'problem-solving';
    } else if (inputLower.includes('explain') || inputLower.includes('tell me')) {
      return 'informational';
    }

    return 'general';
  }
}
