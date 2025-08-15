/**
 * @qi/workflow - Main module exports
 */

// Two-Layer Architecture Factory (Recommended)
export {
  createWorkflowHandler,
  createWorkflowHandlerWithFallback,
} from './factories/createWorkflowHandler.js';

// Implementations
export * from './impl/index.js';
// Interfaces
export type * from './interfaces/index.js';

// import { LangGraphWorkflowEngine } from './impl/LangGraphWorkflowEngine.js';
import { LangGraphWorkflowEngineSimple } from './impl/LangGraphWorkflowEngineSimple.js';
import { QiWorkflowEngine } from './impl/QiWorkflowEngine.js';
// Factory functions
import { QiWorkflowExtractor } from './impl/QiWorkflowExtractor.js';
import type {
  IWorkflowEngineConfig,
  IWorkflowExtractorConfig,
  WorkflowMode,
} from './interfaces/index.js';
// Research patterns available through QiCoreWorkflowManager or createWorkflowHandler()

/**
 * Create workflow extractor with default configuration
 */
export function createWorkflowExtractor(
  config?: Partial<IWorkflowExtractorConfig>
): QiWorkflowExtractor {
  const defaultModes: WorkflowMode[] = [
    {
      name: 'general',
      description: 'General purpose workflow processing',
      category: 'basic',
      keywords: ['workflow', 'process', 'execute'],
      commonNodes: ['input', 'processing', 'output'],
      requiredTools: [],
    },
    {
      name: 'analytical',
      description: 'Analytical workflow with systematic reasoning',
      category: 'cognitive',
      keywords: ['analyze', 'study', 'examine', 'investigate'],
      commonNodes: ['input', 'analysis', 'reasoning', 'output'],
      requiredTools: ['analysis-tools'],
    },
    {
      name: 'creative',
      description: 'Creative workflow for generation and synthesis',
      category: 'cognitive',
      keywords: ['create', 'generate', 'design', 'build'],
      commonNodes: ['input', 'ideation', 'creation', 'output'],
      requiredTools: ['creation-tools'],
    },
    {
      name: 'problem-solving',
      description: 'Problem-solving workflow with diagnostics',
      category: 'cognitive',
      keywords: ['fix', 'solve', 'debug', 'resolve'],
      commonNodes: ['input', 'diagnosis', 'solution', 'output'],
      requiredTools: ['diagnostic-tools'],
    },
  ];

  const finalConfig: IWorkflowExtractorConfig = {
    supportedModes: defaultModes,
    templateModes: ['general', 'analytical', 'creative', 'problem-solving'],
    ...config,
  };

  return new QiWorkflowExtractor(finalConfig);
}

/**
 * Create workflow engine with default configuration
 */
export function createWorkflowEngine(config?: IWorkflowEngineConfig): QiWorkflowEngine {
  const defaultConfig: IWorkflowEngineConfig = {
    enableCheckpointing: false,
    maxExecutionTime: 30000,
    enableStreaming: true,
    persistenceStore: 'memory',
    ...config,
  };

  return new QiWorkflowEngine(defaultConfig);
}

/**
 * Create LangGraph-based workflow engine with default configuration
 */
export function createLangGraphWorkflowEngine(
  config?: IWorkflowEngineConfig
): LangGraphWorkflowEngineSimple {
  const defaultConfig: IWorkflowEngineConfig = {
    enableCheckpointing: true, // Enable checkpointing for LangGraph
    maxExecutionTime: 60000, // Longer timeout for complex workflows
    enableStreaming: true,
    persistenceStore: 'memory',
    ...config,
  };

  return new LangGraphWorkflowEngineSimple(defaultConfig);
}

/**
 * Create simplified LangGraph-based workflow engine (for v-0.8.0 development)
 */
export function createLangGraphWorkflowEngineSimple(
  config?: IWorkflowEngineConfig
): LangGraphWorkflowEngineSimple {
  const defaultConfig: IWorkflowEngineConfig = {
    enableCheckpointing: false, // Simplified version doesn't need checkpointing
    maxExecutionTime: 30000,
    enableStreaming: true,
    persistenceStore: 'memory',
    ...config,
  };

  return new LangGraphWorkflowEngineSimple(defaultConfig);
}
