/**
 * Python LangChain MCP Classification Method
 *
 * Uses Python LangChain via MCP protocol to provide better function calling reliability
 * than TypeScript LangChain implementation. Addresses the 23.3% error rate issue
 * with complex schemas by leveraging Python LangChain's superior implementation.
 */

import { failure, fromAsyncTryCatch, match, success, type ErrorCategory, type QiError, type Result } from '@qi/base';
import { createClassificationError, type BaseClassificationErrorContext } from '../shared/error-types.js';
import { 
  globalSchemaRegistry, 
  type SchemaEntry,
  type SchemaSelectionCriteria 
} from '../schema-registry.js';
import { detectCommand } from './command-detection-utils.js';
import type {
  ClassificationMethod,
  ClassificationResult,
  IClassificationMethod,
  ProcessingContext,
} from '../abstractions/index.js';

/**
 * Custom error factory for Python MCP classification errors
 */
const createPythonMCPError = (
  code: string,
  message: string,
  category: ErrorCategory,
  context: Partial<BaseClassificationErrorContext> = {}
): QiError => createClassificationError('python-langchain-mcp', code, message, category, context);

/**
 * Configuration for Python LangChain MCP classification method
 */
export interface PythonLangChainMCPConfig {
  mcpServerPath?: string;
  baseUrl?: string;
  modelId?: string;
  temperature?: number;
  timeout?: number;
  
  // Schema selection options
  schemaName?: string;
  schemaSelectionCriteria?: SchemaSelectionCriteria;
}

/**
 * Real MCP client using @modelcontextprotocol/sdk
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

/**
 * Python LangChain MCP-based classification method
 * 
 * Provides better reliability than TypeScript LangChain by using Python implementation
 * via Model Context Protocol (MCP) for function calling.
 */
export class PythonLangChainMCPClassificationMethod implements IClassificationMethod {
  private mcpClient: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private config: PythonLangChainMCPConfig;
  private initialized: boolean = false;
  private selectedSchema: SchemaEntry | null = null;

  constructor(config: PythonLangChainMCPConfig) {
    this.config = {
      mcpServerPath: '/home/zzhang/dev/qi/github/qi-v2-agent/python-langchain-mcp-server/server.py',
      baseUrl: 'http://localhost:11434',
      modelId: 'llama3.2:3b',
      temperature: 0.1,
      timeout: 30000,
      ...config
    };
  }

  private async initializeMCP(): Promise<void> {
    try {
      // Select schema - explicit error if selection fails
      const schemaResult = this.selectSchema();
      const selectedSchema = await match(
        async (schema) => schema,
        async (error) => {
          throw new Error(`Schema selection failed: ${error.message}`);
        },
        schemaResult
      );
      this.selectedSchema = selectedSchema;
      
      // Initialize MCP client (simplified - in real implementation would use @modelcontextprotocol/sdk)
      this.mcpClient = await this.createMCPClient();
      
    } catch (error) {
      throw new Error(
        `Failed to initialize Python LangChain MCP method: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async createMCPClient(): Promise<Client> {
    try {
      // Create stdio transport to Python MCP server using virtual environment
      const serverDir = '/home/zzhang/dev/qi/github/qi-v2-agent/python-langchain-mcp-server';
      this.transport = new StdioClientTransport({
        command: 'bash',
        args: ['-c', `source ${serverDir}/venv/bin/activate && python ${this.config.mcpServerPath!}`],
        env: {
          ...process.env,
          // Pass configuration to Python server via environment variables
          OLLAMA_BASE_URL: this.config.baseUrl,
          MODEL_ID: this.config.modelId,
          TEMPERATURE: this.config.temperature?.toString(),
        }
      });

      // Create and connect MCP client
      this.mcpClient = new Client({
        name: "python-langchain-classifier-client",
        version: "1.0.0"
      }, {
        capabilities: {
          tools: {}
        }
      });

      await this.mcpClient.connect(this.transport);
      
      return this.mcpClient;
    } catch (error) {
      throw new Error(`Failed to create MCP client: ${error instanceof Error ? error.message : String(error)}`);
    }
  }


  /**
   * Select schema - explicit error propagation, NO FALLBACKS
   */
  private selectSchema(): Result<SchemaEntry, QiError> {
    if (!this.config.schemaName) {
      return failure(createPythonMCPError(
        'NO_SCHEMA_SPECIFIED',
        'Schema name must be explicitly provided for Python MCP method',
        'VALIDATION',
        { operation: 'selectSchema' }
      ));
    }
    return globalSchemaRegistry.getSchema(this.config.schemaName);
  }

  async classify(input: string, context?: ProcessingContext): Promise<ClassificationResult> {
    // Initialize if needed
    if (!this.initialized) {
      await this.initializeMCP();
      this.initialized = true;
    }

    const classificationResult = await fromAsyncTryCatch(
      async () => {
        return await this.classifyInternal(input, context);
      },
      (error: unknown) => createPythonMCPError(
        'CLASSIFICATION_FAILED',
        `Python LangChain MCP classification failed: ${error instanceof Error ? error.message : String(error)}`,
        'SYSTEM',
        { error: String(error), method: 'python-mcp' }
      )
    );

    return match(
      (result) => result,
      (error) => {
        throw new Error(`Python LangChain MCP method failed: ${error.message}`);
      },
      classificationResult
    );
  }

  private async classifyInternal(input: string, context?: ProcessingContext): Promise<ClassificationResult> {
    const startTime = Date.now();
    
    // Validate input
    const validationResult = this.validateInput(input);
    const validatedInput = await match(
      async (input) => input,
      async (error) => {
        throw new Error(`Input validation failed: ${error.message}`);
      },
      validationResult
    );

    // Check for commands first (optimization)
    const commandResult = detectCommand(validatedInput);
    if (commandResult) {
      return {
        ...commandResult,
        method: 'python-langchain-mcp',
        metadata: new Map([
          ...Array.from(commandResult.metadata || []),
          ['optimizedBy', 'command-detection-shortcut'],
          ['actualMethod', 'rule-based-command-detection'],
          ['skipLLM', 'true']
        ])
      };
    }

    // Perform MCP classification using real client
    if (!this.mcpClient) {
      throw new Error('MCP client not initialized');
    }

    const mcpResponse = await this.mcpClient.callTool({
      name: 'classify_input',
      arguments: {
        input_text: validatedInput,
        schema_name: this.selectedSchema?.metadata.name,
        model_id: this.config.modelId,
        temperature: this.config.temperature
      }
    });

    // Parse MCP response
    if (!mcpResponse.content || mcpResponse.content.length === 0) {
      throw new Error('Empty MCP response');
    }

    const responseContent = mcpResponse.content[0];
    if (responseContent.type !== 'text') {
      throw new Error('Expected text content from MCP response');
    }

    const pythonResult = JSON.parse(responseContent.text);
    
    if (!pythonResult.success) {
      throw new Error(`Python classification failed: ${pythonResult.error_message}`);
    }

    // Process and return result
    const result = this.processResult(pythonResult, validatedInput);
    const finalResult = await match(
      async (result) => result,
      async (error) => {
        throw new Error(`Result processing failed: ${error.message}`);
      },
      result
    );

    // Track performance
    this.trackPerformance(startTime, true);
    
    return finalResult;
  }

  private validateInput(input: string): Result<string, QiError> {
    if (!input || typeof input !== 'string') {
      return failure(createPythonMCPError(
        'INVALID_INPUT',
        'Input must be a non-empty string',
        'VALIDATION',
        { input: String(input) }
      ));
    }

    const trimmed = input.trim();
    if (trimmed.length === 0) {
      return failure(createPythonMCPError(
        'EMPTY_INPUT',
        'Input cannot be empty or only whitespace',
        'VALIDATION',
        { input }
      ));
    }

    return success(trimmed);
  }

  private processResult(pythonResult: any, originalInput: string): Result<ClassificationResult, QiError> {
    try {
      if (!this.selectedSchema) {
        return failure(createPythonMCPError(
          'SCHEMA_NOT_SELECTED',
          'No schema selected for result processing',
          'SYSTEM'
        ));
      }

      const result = pythonResult.result;
      
      if (!result.type || result.confidence === undefined) {
        return failure(createPythonMCPError(
          'INVALID_PYTHON_RESULT',
          'Python result missing required fields: type and confidence',
          'VALIDATION',
          { result: JSON.stringify(result) }
        ));
      }

      const metadata = new Map<string, string>([
        ['model', pythonResult.model_id],
        ['provider', 'python-langchain-mcp'],
        ['method', 'python-function-calling'],
        ['timestamp', new Date().toISOString()],
        ['input_length', originalInput.length.toString()],
        ['schema_used', pythonResult.schema_name],
        ['latency_ms', pythonResult.latency_ms.toString()],
        ['python_backend', 'true']
      ]);

      const extractedData = new Map<string, unknown>();

      // Extract schema-specific data
      if (result.indicators && Array.isArray(result.indicators)) {
        extractedData.set('indicators', result.indicators);
      }
      if (result.complexity_score !== undefined) {
        extractedData.set('complexity_score', result.complexity_score);
      }
      if (result.task_steps !== undefined) {
        extractedData.set('task_steps', result.task_steps);
      }
      if (result.conversation_context) {
        extractedData.set('conversation_context', result.conversation_context);
      }
      if (result.step_count !== undefined) {
        extractedData.set('step_count', result.step_count);
      }
      if (result.requires_coordination !== undefined) {
        extractedData.set('requires_coordination', result.requires_coordination);
      }

      const classificationResult: ClassificationResult = {
        type: result.type,
        confidence: typeof result.confidence === 'number' ? result.confidence : parseFloat(result.confidence) || 0.5,
        method: 'python-langchain-mcp',
        reasoning: result.reasoning || 'Classification via Python LangChain MCP server',
        extractedData,
        metadata,
      };

      return success(classificationResult);
    } catch (error) {
      return failure(createPythonMCPError(
        'RESULT_PROCESSING_FAILED',
        `Failed to process Python MCP result: ${error instanceof Error ? error.message : String(error)}`,
        'SYSTEM',
        { error: String(error), result: JSON.stringify(pythonResult) }
      ));
    }
  }

  private trackPerformance(startTime: number, success: boolean): void {
    if (!this.selectedSchema) return;

    const latencyMs = Date.now() - startTime;
    const trackingResult = globalSchemaRegistry.trackSchemaUsage(
      this.selectedSchema.metadata.name,
      latencyMs,
      success,
      success
    );

    match(
      () => {}, 
      (error) => console.warn(`Failed to track Python MCP performance: ${error.message}`),
      trackingResult
    );
  }

  // Interface implementation
  getMethodName(): ClassificationMethod {
    return 'python-langchain-mcp' as ClassificationMethod;
  }

  getExpectedAccuracy(): number {
    // Expected improvement over TypeScript LangChain
    if (this.selectedSchema?.metadata.name === 'context_aware') {
      return 0.90; // Target: 90% vs 73.3% in TypeScript
    }
    return 0.85; // General improvement expectation
  }

  getAverageLatency(): number {
    // Similar to TypeScript but with MCP overhead
    if (this.selectedSchema?.metadata.name === 'context_aware') {
      return 5000; // ~5s, similar to TypeScript but more reliable
    }
    return 3500;
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Check if Python MCP server is accessible (simplified check)
      const baseUrl = this.config.baseUrl || 'http://localhost:11434';
      const response = await fetch(`${baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch (_error) {
      return false;
    }
  }

  async dispose(): Promise<void> {
    if (this.mcpClient) {
      await this.mcpClient.close();
      this.mcpClient = null;
    }
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
    this.initialized = false;
  }
}

/**
 * Factory function for creating Python LangChain MCP classification method
 */
export function createPythonLangChainMCPClassificationMethod(
  config: PythonLangChainMCPConfig = {}
): PythonLangChainMCPClassificationMethod {
  return new PythonLangChainMCPClassificationMethod(config);
}