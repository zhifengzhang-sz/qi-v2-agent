// LangChain Structured Output Workflow Extractor
//
// Uses LangChain structured output with Zod schemas to convert natural language 
// into executable workflow specifications. This replaces the complex template-based
// and custom parsing logic with guaranteed valid output.

import { ChatOllama } from '@langchain/ollama';
import { z } from 'zod';
import type {
  IWorkflowExtractor,
  WorkflowExtractionResult,
  WorkflowSpec,
  WorkflowNodeSpec,
  WorkflowEdgeSpec,
  WorkflowConditionSpec,
  WorkflowMode,
  ProcessingContext,
  CognitivePattern
} from '../../core/interfaces.js';

// Zod schema for workflow condition
const WorkflowConditionSchema = z.object({
  type: z.enum(['always', 'success', 'error', 'custom']).describe('Condition type'),
  expression: z.string().optional().describe('Optional condition expression'),
  parameters: z.record(z.unknown()).optional().describe('Optional condition parameters')
});

// Zod schema for workflow node
const WorkflowNodeSchema = z.object({
  id: z.string().describe('Unique node identifier'),
  name: z.string().describe('Human-readable node name'),
  type: z.enum(['input', 'processing', 'tool', 'reasoning', 'output', 'decision', 'validation']).describe('Node type'),
  parameters: z.record(z.unknown()).describe('Node parameters'),
  requiredTools: z.array(z.string()).optional().describe('Required tools for this node'),
  conditions: z.array(WorkflowConditionSchema).optional().describe('Node execution conditions'),
  dependencies: z.array(z.string()).optional().describe('Node dependencies')
});

// Zod schema for workflow edge
const WorkflowEdgeSchema = z.object({
  from: z.string().describe('Source node ID'),
  to: z.string().describe('Target node ID'),
  condition: WorkflowConditionSchema.optional().describe('Edge condition'),
  priority: z.number().optional().describe('Edge priority')
});

// Zod schema for complete workflow specification
const WorkflowSpecSchema = z.object({
  id: z.string().describe('Unique workflow identifier'),
  name: z.string().describe('Human-readable workflow name'),
  description: z.string().describe('Workflow description'),
  nodes: z.array(WorkflowNodeSchema).describe('Workflow nodes'),
  edges: z.array(WorkflowEdgeSchema).describe('Workflow edges'),
  parameters: z.record(z.unknown()).describe('Workflow parameters'),
  steps: z.array(WorkflowNodeSchema).describe('Workflow steps (alias for nodes)')
});

export class HybridWorkflowExtractor implements IWorkflowExtractor {
  private model: ChatOllama;
  private structuredModel: any;
  private supportedModes: readonly WorkflowMode[];
  private patternMapping: Map<string, CognitivePattern>;

  constructor(config: WorkflowExtractorConfig) {
    this.supportedModes = config.supportedModes;
    this.patternMapping = new Map(config.patternMapping);

    this.model = new ChatOllama({
      baseUrl: config.baseUrl || 'http://localhost:11434',
      model: config.modelId || 'qwen2.5:7b',
      temperature: 0.2, // Slightly higher for creative workflow generation
      numCtx: 4096
    });

    // Bind structured output schema
    this.structuredModel = this.model.withStructuredOutput(WorkflowSpecSchema, {
      name: 'workflow_extraction'
    });
  }

  async extractWorkflow(
    input: string,
    context?: ProcessingContext
  ): Promise<WorkflowExtractionResult> {
    const startTime = Date.now();

    try {
      // 1. Analyze complexity and determine mode
      const analysis = this.analyzeComplexity(input, context);
      const mode = analysis.detectedMode;
      const pattern = this.getPatternForMode(mode);

      // 2. Generate workflow using LangChain structured output
      const prompt = this.buildExtractionPrompt(input, mode, context);
      const workflowSpec = await this.structuredModel.invoke(prompt);

      // 3. Post-process and validate
      const processedSpec = this.postProcessWorkflowSpec(workflowSpec);
      const isValid = await this.validateWorkflowSpec(processedSpec);

      if (!isValid) {
        return {
          success: false,
          mode,
          pattern,
          confidence: 0.1,
          extractionMethod: 'llm-based',
          error: 'Generated workflow specification failed validation',
          metadata: new Map([
            ['extractionTime', Date.now() - startTime],
            ['validationFailed', true],
            ['rawSpec', workflowSpec]
          ])
        };
      }

      return {
        success: true,
        mode,
        pattern,
        workflowSpec: processedSpec,
        confidence: 0.9, // High confidence with structured output
        extractionMethod: 'llm-based',
        metadata: new Map([
          ['extractionTime', (Date.now() - startTime).toString()],
          ['nodeCount', processedSpec.nodes.length.toString()],
          ['edgeCount', processedSpec.edges.length.toString()],
          ['complexity', analysis.level],
          ['model', this.model.model],
          ['schemaValidated', 'true']
        ])
      };

    } catch (error) {
      return {
        success: false,
        mode: 'unknown',
        pattern: this.getDefaultPattern(),
        confidence: 0.0,
        extractionMethod: 'llm-based',
        error: error instanceof Error ? error.message : String(error),
        metadata: new Map([
          ['extractionTime', (Date.now() - startTime).toString()],
          ['errorType', 'llm-extraction-failed'],
          ['errorMessage', error instanceof Error ? error.message : String(error)]
        ])
      };
    }
  }

  getSupportedModes(): readonly WorkflowMode[] {
    return this.supportedModes;
  }

  async validateWorkflowSpec(spec: WorkflowSpec): Promise<boolean> {
    try {
      // Basic validation checks
      if (!spec.id || !spec.name || !spec.nodes || spec.nodes.length === 0) {
        return false;
      }

      // Validate each node
      for (const node of spec.nodes) {
        if (!node.id || !node.name || !node.type) {
          return false;
        }

        // Validate node type
        const validTypes = ['input', 'processing', 'tool', 'reasoning', 'output', 'decision', 'validation'];
        if (!validTypes.includes(node.type)) {
          return false;
        }
      }

      // Validate edges reference existing nodes
      const nodeIds = new Set(spec.nodes.map(n => n.id));
      for (const edge of spec.edges) {
        if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
          return false;
        }
      }

      // Check for circular dependencies
      if (this.hasCircularDependencies(spec)) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  async getWorkflowTemplates(mode: string): Promise<readonly WorkflowSpec[]> {
    // For now, return empty array since we're using LLM-based generation
    // Could be extended to provide template examples for specific modes
    return [];
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  private analyzeComplexity(input: string, context?: ProcessingContext): ComplexityAnalysis {
    const wordCount = input.split(/\s+/).length;
    const lowerInput = input.toLowerCase();

    // Detect complexity indicators
    const multiStepIndicators = ['then', 'after', 'next', 'followed by', 'and then', 'subsequently'];
    const toolIndicators = ['create', 'build', 'generate', 'implement', 'deploy', 'test', 'debug'];
    const fileIndicators = ['.js', '.ts', '.py', '.java', '.html', '.css', '.md'];
    const complexityKeywords = ['architecture', 'system', 'integration', 'workflow', 'pipeline'];

    const multiStepCount = multiStepIndicators.filter(indicator => lowerInput.includes(indicator)).length;
    const toolCount = toolIndicators.filter(indicator => lowerInput.includes(indicator)).length;
    const fileCount = fileIndicators.filter(indicator => lowerInput.includes(indicator)).length;
    const complexityCount = complexityKeywords.filter(keyword => lowerInput.includes(keyword)).length;

    // Determine complexity level and mode
    let level: 'simple' | 'moderate' | 'complex';
    let detectedMode = 'general';

    if (wordCount < 20 && multiStepCount <= 1 && toolCount <= 2) {
      level = 'simple';
      detectedMode = this.detectSimpleMode(lowerInput);
    } else if (wordCount > 50 || multiStepCount > 3 || complexityCount > 1) {
      level = 'complex';
      detectedMode = this.detectComplexMode(lowerInput);
    } else {
      level = 'moderate';
      detectedMode = this.detectModeFromTools(lowerInput, toolCount, fileCount);
    }

    return {
      level,
      detectedMode,
      indicators: {
        wordCount,
        multiStepCount,
        toolCount,
        fileCount,
        complexityCount
      }
    };
  }

  private buildExtractionPrompt(input: string, mode: string, context?: ProcessingContext): string {
    const contextInfo = context ? this.formatContext(context) : '';
    const modeInfo = this.supportedModes.find(m => m.name === mode);
    
    return `Extract a detailed workflow specification from the user's request.

**User Request:** "${input}"

**Detected Mode:** ${mode}
${modeInfo ? `**Mode Description:** ${modeInfo.description}` : ''}
${contextInfo}

**Workflow Requirements:**
1. Create a unique workflow ID and descriptive name
2. Break down the request into logical workflow nodes
3. Each node must have a valid type: input, processing, tool, reasoning, output, decision, or validation
4. Create edges to define the execution flow between nodes
5. Include appropriate parameters for each node
6. Ensure the workflow can accomplish the user's request

**Node Types Guide:**
- **input**: Receive and process initial user input
- **processing**: General data processing and transformation
- **tool**: External tool execution (file operations, API calls, etc.)
- **reasoning**: Analysis, planning, and decision-making
- **output**: Generate and format final results
- **decision**: Conditional branching based on criteria
- **validation**: Verify results and ensure quality

**Best Practices:**
- Start with an input node to process the user request
- Include reasoning nodes for planning and analysis
- Use tool nodes for external operations (file handling, testing, etc.)
- Add validation nodes to ensure quality
- End with an output node to deliver results
- Create logical dependencies between nodes
- Keep node names clear and descriptive

Generate a complete workflow specification that will effectively accomplish: "${input}"`;
  }

  private formatContext(context: ProcessingContext): string {
    if (!context) return '';
    
    const parts: string[] = [];
    if (context.sessionId) parts.push(`Session: ${context.sessionId}`);
    if (context.currentInputType) parts.push(`Input Type: ${context.currentInputType}`);
    if (context.environmentContext?.size) {
      parts.push(`Environment: ${Array.from(context.environmentContext.keys()).join(', ')}`);
    }
    
    return parts.length > 0 ? `\n**Context:** ${parts.join(' | ')}` : '';
  }

  private postProcessWorkflowSpec(rawSpec: any): WorkflowSpec {
    // Convert raw LLM output to proper WorkflowSpec with Maps
    const processedNodes: WorkflowNodeSpec[] = rawSpec.nodes.map((node: any) => ({
      id: node.id,
      name: node.name,
      type: node.type,
      parameters: new Map(Object.entries(node.parameters || {})),
      requiredTools: node.requiredTools || [],
      conditions: node.conditions?.map((cond: any) => ({
        type: cond.type,
        expression: cond.expression,
        parameters: new Map(Object.entries(cond.parameters || {}))
      })) || [],
      dependencies: node.dependencies || []
    }));

    const processedEdges: WorkflowEdgeSpec[] = rawSpec.edges.map((edge: any) => ({
      from: edge.from,
      to: edge.to,
      condition: edge.condition ? {
        type: edge.condition.type,
        expression: edge.condition.expression,
        parameters: new Map(Object.entries(edge.condition.parameters || {}))
      } : undefined,
      priority: edge.priority
    }));

    return {
      id: rawSpec.id,
      name: rawSpec.name,
      description: rawSpec.description,
      nodes: processedNodes,
      edges: processedEdges,
      parameters: new Map(Object.entries(rawSpec.parameters || {})),
      steps: processedNodes // steps is an alias for nodes
    };
  }

  private detectSimpleMode(input: string): string {
    if (input.includes('create') || input.includes('build') || input.includes('generate')) {
      return 'creative';
    }
    if (input.includes('fix') || input.includes('debug') || input.includes('error')) {
      return 'problem-solving';
    }
    if (input.includes('analyze') || input.includes('review') || input.includes('plan')) {
      return 'analytical';
    }
    if (input.includes('explain') || input.includes('what') || input.includes('how')) {
      return 'informational';
    }
    return 'general';
  }

  private detectComplexMode(input: string): string {
    if (input.includes('architecture') || input.includes('system') || input.includes('integration')) {
      return 'analytical';
    }
    if (input.includes('implement') || input.includes('develop') || input.includes('build')) {
      return 'creative';
    }
    if (input.includes('troubleshoot') || input.includes('diagnose') || input.includes('resolve')) {
      return 'problem-solving';
    }
    return 'general';
  }

  private detectModeFromTools(input: string, toolCount: number, fileCount: number): string {
    if (fileCount > 0 && toolCount > 1) {
      return 'creative';
    }
    if (input.includes('test') || input.includes('validate')) {
      return 'analytical';
    }
    return 'general';
  }

  private getPatternForMode(mode: string): CognitivePattern {
    return this.patternMapping.get(mode) || this.getDefaultPattern();
  }

  private getDefaultPattern(): CognitivePattern {
    return {
      name: 'general',
      description: 'General purpose workflow processing',
      purpose: 'Handle general workflow tasks',
      characteristics: ['flexible', 'adaptive', 'general-purpose'],
      abstractKeywords: [],
      contextWeight: 0.3
    };
  }

  private hasCircularDependencies(spec: WorkflowSpec): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      if (recursionStack.has(nodeId)) {
        return true;
      }
      if (visited.has(nodeId)) {
        return false;
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);

      // Check edges for dependencies
      const outgoingEdges = spec.edges.filter(edge => edge.from === nodeId);
      for (const edge of outgoingEdges) {
        if (hasCycle(edge.to)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const node of spec.nodes) {
      if (hasCycle(node.id)) {
        return true;
      }
    }

    return false;
  }
}

// =============================================================================
// Configuration Interface
// =============================================================================

export interface WorkflowExtractorConfig {
  supportedModes: readonly WorkflowMode[];
  patternMapping: readonly [string, CognitivePattern][];
  baseUrl?: string;
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
}

interface ComplexityAnalysis {
  level: 'simple' | 'moderate' | 'complex';
  detectedMode: string;
  indicators: {
    wordCount: number;
    multiStepCount: number;
    toolCount: number;
    fileCount: number;
    complexityCount: number;
  };
}