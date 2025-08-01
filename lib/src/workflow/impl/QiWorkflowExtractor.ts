/**
 * @qi/workflow - Qi Workflow Extractor Implementation
 *
 * LangChain structured output workflow extractor adapted for app layer
 */

import { createOllamaStructuredWrapper, type OllamaStructuredWrapper } from '../../llm/index.js';
import type {
  IWorkflowExtractor,
  IWorkflowExtractorConfig,
  ProcessingContext,
  WorkflowExtractionResult,
  WorkflowMode,
  WorkflowSpec,
} from '../interfaces/index.js';

// JSON Schema for workflow specification (replacing broken Zod schemas)
const WorkflowSpecSchema = {
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
  private wrapper: OllamaStructuredWrapper;
  private supportedModes: readonly WorkflowMode[];
  private patternMapping: Map<string, string>;

  constructor(config: IWorkflowExtractorConfig) {
    this.supportedModes = config.supportedModes;
    this.patternMapping = new Map(config.patternMapping);

    // Use working OllamaStructuredWrapper instead of broken ChatOllama
    this.wrapper = createOllamaStructuredWrapper({
      model: config.modelId || 'qwen2.5-coder:7b',
      baseURL: config.baseUrl || 'http://172.18.144.1:11434',
      temperature: config.temperature || 0.2,
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

      // 2. Generate workflow using OllamaStructuredWrapper
      const prompt = this.buildExtractionPrompt(input, mode, context);
      const workflowSpec = await this.wrapper.generateStructured(prompt, WorkflowSpecSchema);

      // 3. Post-process and validate
      const processedSpec = this.postProcessWorkflowSpec(workflowSpec);
      const isValid = await this.validateWorkflowSpec(processedSpec);

      if (!isValid) {
        console.log('DEBUG: Validation failed for spec:', JSON.stringify(workflowSpec, null, 2));
        console.log(
          'DEBUG: Processed spec:',
          JSON.stringify(
            {
              id: processedSpec.id,
              name: processedSpec.name,
              nodeCount: processedSpec.nodes.length,
              edgeCount: processedSpec.edges.length,
            },
            null,
            2
          )
        );
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
            ['rawSpec', workflowSpec],
          ]),
        };
      }

      return {
        success: true,
        mode,
        pattern,
        workflowSpec: processedSpec,
        confidence: 0.9,
        extractionMethod: 'llm-based',
        metadata: new Map([
          ['extractionTime', (Date.now() - startTime).toString()],
          ['nodeCount', processedSpec.nodes.length.toString()],
          ['edgeCount', processedSpec.edges.length.toString()],
          ['complexity', analysis.level],
          ['model', 'ollama-structured-wrapper'],
          ['schemaValidated', 'true'],
        ]),
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
          ['errorMessage', error instanceof Error ? error.message : String(error)],
        ]),
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
        const validTypes = [
          'input',
          'processing',
          'tool',
          'reasoning',
          'output',
          'decision',
          'validation',
        ];
        if (!validTypes.includes(node.type)) {
          return false;
        }
      }

      // Validate edges reference existing nodes
      const nodeIds = new Set(spec.nodes.map((n) => n.id));
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
    } catch (_error) {
      return false;
    }
  }

  async getWorkflowTemplates(_mode: string): Promise<readonly WorkflowSpec[]> {
    // Return empty array for now - could be extended with templates
    return [];
  }

  // Private methods

  private analyzeComplexity(input: string, _context?: ProcessingContext): ComplexityAnalysis {
    const wordCount = input.split(/\s+/).length;
    const lowerInput = input.toLowerCase();

    // Detect complexity indicators
    const multiStepIndicators = ['then', 'after', 'next', 'followed by', 'and then'];
    const toolIndicators = ['create', 'build', 'generate', 'implement', 'deploy', 'test'];
    const fileIndicators = ['.js', '.ts', '.py', '.java', '.html', '.css', '.md'];
    const complexityKeywords = ['architecture', 'system', 'integration', 'workflow'];

    const multiStepCount = multiStepIndicators.filter((indicator) =>
      lowerInput.includes(indicator)
    ).length;
    const toolCount = toolIndicators.filter((indicator) => lowerInput.includes(indicator)).length;
    const fileCount = fileIndicators.filter((indicator) => lowerInput.includes(indicator)).length;
    const complexityCount = complexityKeywords.filter((keyword) =>
      lowerInput.includes(keyword)
    ).length;

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
        complexityCount,
      },
    };
  }

  private buildExtractionPrompt(input: string, mode: string, context?: ProcessingContext): string {
    const contextInfo = context ? this.formatContext(context) : '';
    const modeInfo = this.supportedModes.find((m) => m.name === mode);

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

Generate a complete workflow specification that will effectively accomplish: "${input}"

IMPORTANT: Return ONLY valid JSON data (NOT a schema). Example format:
{
  "id": "workflow_123",
  "name": "Workflow Name", 
  "description": "What this workflow does",
  "nodes": [
    {
      "id": "node1",
      "name": "Node Name",
      "type": "input",
      "parameters": {}
    }
  ],
  "edges": [
    {
      "from": "node1", 
      "to": "node2"
    }
  ],
  "parameters": {},
  "steps": []
}`;
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
    // Handle cases where LLM returns schema format instead of data
    const extractValue = (field: any) => {
      if (typeof field === 'object' && field.value !== undefined) {
        return field.value; // Schema format: {"type": "string", "value": "actual_value"}
      }
      return field; // Direct format: "actual_value"
    };

    // Extract actual values from potentially schema-formatted response
    const id = extractValue(rawSpec.id) || `workflow_${Date.now()}`;
    const name = extractValue(rawSpec.name) || 'Generated Workflow';
    const description = extractValue(rawSpec.description) || 'Auto-generated workflow';
    const nodes = rawSpec.nodes || [];
    const edges = rawSpec.edges || [];

    const processedNodes = nodes.map((node: any) => ({
      id: node.id,
      name: node.name,
      type: node.type,
      parameters: new Map(Object.entries(node.parameters || {})),
      requiredTools: node.requiredTools || [],
      conditions:
        node.conditions?.map((cond: any) => ({
          type: cond.type,
          expression: cond.expression,
          parameters: new Map(Object.entries(cond.parameters || {})),
        })) || [],
      dependencies: node.dependencies || [],
    }));

    const processedEdges = edges.map((edge: any) => ({
      from: edge.from,
      to: edge.to,
      condition: edge.condition
        ? {
            type: edge.condition.type,
            expression: edge.condition.expression,
            parameters: new Map(Object.entries(edge.condition.parameters || {})),
          }
        : undefined,
      priority: edge.priority,
    }));

    return {
      id,
      name,
      description,
      nodes: processedNodes,
      edges: processedEdges,
      parameters: new Map(Object.entries(rawSpec.parameters || {})),
      steps: processedNodes,
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
    if (
      input.includes('architecture') ||
      input.includes('system') ||
      input.includes('integration')
    ) {
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

  private getPatternForMode(mode: string): string {
    return this.patternMapping.get(mode) || this.getDefaultPattern();
  }

  private getDefaultPattern(): string {
    return 'general';
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
      const outgoingEdges = spec.edges.filter((edge) => edge.from === nodeId);
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
