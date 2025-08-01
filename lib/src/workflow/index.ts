/**
 * @qi/workflow - Main module exports
 */

// Implementations
export * from './impl/index.js';
// Interfaces
export type * from './interfaces/index.js';

import { QiWorkflowEngine } from './impl/QiWorkflowEngine.js';
// Factory functions
import { QiWorkflowExtractor } from './impl/QiWorkflowExtractor.js';
import type {
  IWorkflowEngineConfig,
  IWorkflowExtractorConfig,
  WorkflowMode,
} from './interfaces/index.js';

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

  const defaultPatternMapping: [string, string][] = [
    ['general', 'general'],
    ['analytical', 'analytical'],
    ['creative', 'creative'],
    ['problem-solving', 'problem-solving'],
    ['informational', 'informational'],
  ];

  const finalConfig: IWorkflowExtractorConfig = {
    supportedModes: defaultModes,
    patternMapping: defaultPatternMapping,
    baseUrl: 'http://localhost:11434',
    modelId: 'qwen2.5:7b',
    temperature: 0.2,
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
