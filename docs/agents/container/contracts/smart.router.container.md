# Smart Router Container Interface Contract

## Container Overview

The Smart Router Container provides pure mode-to-workflow transformation. It receives cognitive modes from the Pattern Recognition Container and outputs workflow specifications with parameter requests for the Workflow Executor Container.

## Interface Definition

### Core Interface
```typescript
interface SmartRouterContainer extends Agent<CognitiveMode, WorkflowTransformation> {
  // Core processing
  process(mode: CognitiveMode): Promise<WorkflowTransformation>;
  
  // Mode transformation
  transformMode(mode: CognitiveMode): WorkflowSpecification;
  
  // Parameter request generation
  getParameterRequest(mode: CognitiveMode): ExecutionParameterRequest;
  
  // Mode validation
  validateMode(mode: CognitiveMode): ValidationResult;
  
  // Template management
  getWorkflowTemplate(mode: CognitiveMode): WorkflowTemplate;
  listAvailableTemplates(): WorkflowTemplate[];
  
  // Capabilities
  getCapabilities(): SmartRouterCapabilities;
}
```

### Input Types
```typescript
type CognitiveMode = 'generic' | 'planning' | 'coding' | 'information' | 'debugging';

interface ModeValidationContext {
  supportedModes: CognitiveMode[];
  deprecatedModes: CognitiveMode[];
  fallbackMappings: Record<CognitiveMode, CognitiveMode>;
}
```

### Output Types
```typescript
interface WorkflowTransformation {
  workflowSpecification: WorkflowSpecification;
  parameterRequest: ExecutionParameterRequest;
  metadata: TransformationMetadata;
}

interface WorkflowSpecification {
  id: string;
  name: string;
  mode: CognitiveMode;
  steps: WorkflowStep[];
  tools: ToolConfiguration[];
  orchestration: OrchestrationType;
  template: string;
  version: string;
  timeout?: number;
  retryPolicy?: RetryPolicy;
}

interface ExecutionParameterRequest {
  requiredInputs: ParameterDefinition[];
  optionalInputs: ParameterDefinition[];
  contextRequirements: ContextRequirement[];
  validationRules: ValidationRule[];
}

interface TransformationMetadata {
  transformationTime: Date;
  templateVersion: string;
  configurationHash: string;
  supportedFeatures: string[];
}
```

## Workflow Specifications

### Workflow Step Definition
```typescript
interface WorkflowStep {
  id: string;
  name: string;
  type: StepType;
  configuration: StepConfiguration;
  dependencies: string[];
  optional: boolean;
  timeout?: number;
  retryPolicy?: RetryPolicy;
}

type StepType = 'llm' | 'tool' | 'mcp' | 'transform' | 'condition' | 'parallel' | 'sequential';

interface StepConfiguration {
  // LLM step configuration
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  
  // Tool step configuration
  toolName?: string;
  toolParameters?: Record<string, any>;
  
  // MCP step configuration
  mcpServer?: string;
  mcpTool?: string;
  mcpParameters?: Record<string, any>;
  
  // Transform step configuration
  transformFunction?: string;
  transformParameters?: Record<string, any>;
  
  // Condition step configuration
  condition?: string;
  trueStep?: string;
  falseStep?: string;
  
  // Parallel step configuration
  parallelSteps?: string[];
  joinStrategy?: 'all' | 'any' | 'first';
}
```

### Tool Configuration
```typescript
interface ToolConfiguration {
  name: string;
  type: 'builtin' | 'mcp' | 'external';
  version: string;
  configuration: ToolSpecificConfig;
  required: boolean;
  fallbackTools?: string[];
}

interface ToolSpecificConfig {
  // MCP tool configuration
  mcpServer?: string;
  mcpToolName?: string;
  endpoint?: string;
  
  // Builtin tool configuration
  implementation?: string;
  parameters?: Record<string, any>;
  
  // External tool configuration
  apiEndpoint?: string;
  authentication?: AuthenticationConfig;
  rateLimit?: RateLimitConfig;
}

type OrchestrationType = 'sequential' | 'parallel' | 'langgraph' | 'conditional' | 'custom';
```

## Mode-to-Workflow Mappings

### Planning Mode Workflow
```typescript
const PLANNING_WORKFLOW: WorkflowSpecification = {
  id: 'planning-workflow-v1',
  name: 'Planning and Analysis Workflow',
  mode: 'planning',
  steps: [
    {
      id: 'init-mcp',
      name: 'Initialize Sequential Thinking MCP',
      type: 'mcp',
      configuration: {
        mcpServer: 'sequential-thinking',
        mcpTool: 'process_thought',
        mcpParameters: {
          stage: 'Problem Definition',
          thought_number: 1,
          total_thoughts: 5
        }
      },
      dependencies: [],
      optional: false
    },
    {
      id: 'structured-thinking',
      name: 'Structured Thinking Process',
      type: 'sequential',
      configuration: {
        parallelSteps: ['problem-definition', 'research-phase', 'analysis-phase']
      },
      dependencies: ['init-mcp'],
      optional: false
    },
    {
      id: 'langgraph-orchestration',
      name: 'LangGraph Workflow Orchestration',
      type: 'llm',
      configuration: {
        model: 'qwen3',
        systemPrompt: 'You are in PLANNING MODE. Use structured thinking...',
        temperature: 0.7,
        maxTokens: 2000
      },
      dependencies: ['structured-thinking'],
      optional: false
    }
  ],
  tools: [
    {
      name: 'sequential-thinking',
      type: 'mcp',
      version: '1.0.0',
      configuration: {
        mcpServer: 'sequential-thinking',
        endpoint: 'localhost:3001'
      },
      required: true
    }
  ],
  orchestration: 'langgraph',
  template: 'planning-template-v1',
  version: '1.0.0'
};
```

### Coding Mode Workflow
```typescript
const CODING_WORKFLOW: WorkflowSpecification = {
  id: 'coding-workflow-v1',
  name: 'Direct Code Generation Workflow',
  mode: 'coding',
  steps: [
    {
      id: 'direct-execution',
      name: 'Direct Code Execution Setup',
      type: 'transform',
      configuration: {
        transformFunction: 'setupCodingEnvironment'
      },
      dependencies: [],
      optional: false
    },
    {
      id: 'qwen-coder',
      name: 'Qwen3-Coder Code Generation',
      type: 'llm',
      configuration: {
        model: 'qwen3-coder',
        systemPrompt: 'You are in CODING MODE. Generate executable code...',
        temperature: 0.3,
        maxTokens: 4000
      },
      dependencies: ['direct-execution'],
      optional: false
    },
    {
      id: 'code-validation',
      name: 'Code Validation and Testing',
      type: 'tool',
      configuration: {
        toolName: 'code-validator',
        toolParameters: {
          language: 'auto-detect',
          runTests: true,
          staticAnalysis: true
        }
      },
      dependencies: ['qwen-coder'],
      optional: true
    }
  ],
  tools: [
    {
      name: 'code-validator',
      type: 'builtin',
      version: '1.0.0',
      configuration: {
        implementation: 'internal-validator'
      },
      required: false
    }
  ],
  orchestration: 'sequential',
  template: 'coding-template-v1',
  version: '1.0.0'
};
```

### Information Mode Workflow
```typescript
const INFORMATION_WORKFLOW: WorkflowSpecification = {
  id: 'information-workflow-v1',
  name: 'Knowledge and Explanation Workflow',
  mode: 'information',
  steps: [
    {
      id: 'knowledge-retrieval',
      name: 'Knowledge Base Query',
      type: 'tool',
      configuration: {
        toolName: 'knowledge-retrieval',
        toolParameters: {
          sources: ['documentation', 'codebase', 'web'],
          maxResults: 10
        }
      },
      dependencies: [],
      optional: false
    },
    {
      id: 'qwen-explanation',
      name: 'Qwen3 Explanation Generation',
      type: 'llm',
      configuration: {
        model: 'qwen3',
        systemPrompt: 'You are in INFORMATION MODE. Provide clear explanations...',
        temperature: 0.5,
        maxTokens: 1500
      },
      dependencies: ['knowledge-retrieval'],
      optional: false
    },
    {
      id: 'format-response',
      name: 'Format Response for Output',
      type: 'transform',
      configuration: {
        transformFunction: 'formatInformationResponse',
        transformParameters: {
          includeReferences: true,
          markdownFormat: true
        }
      },
      dependencies: ['qwen-explanation'],
      optional: false
    }
  ],
  tools: [
    {
      name: 'knowledge-retrieval',
      type: 'builtin',
      version: '1.0.0',
      configuration: {
        implementation: 'internal-knowledge-base'
      },
      required: true
    }
  ],
  orchestration: 'sequential',
  template: 'information-template-v1',
  version: '1.0.0'
};
```

### Debugging Mode Workflow
```typescript
const DEBUGGING_WORKFLOW: WorkflowSpecification = {
  id: 'debugging-workflow-v1',
  name: 'Sequential Debugging Analysis Workflow',
  mode: 'debugging',
  steps: [
    {
      id: 'error-analysis',
      name: 'Error Pattern Analysis',
      type: 'tool',
      configuration: {
        toolName: 'error-analyzer',
        toolParameters: {
          analyzeStackTrace: true,
          identifyPatterns: true,
          suggestFixes: true
        }
      },
      dependencies: [],
      optional: false
    },
    {
      id: 'problem-diagnosis',
      name: 'Problem Diagnosis',
      type: 'llm',
      configuration: {
        model: 'qwen3',
        systemPrompt: 'You are in DEBUGGING MODE. Analyze problems systematically...',
        temperature: 0.4,
        maxTokens: 2000
      },
      dependencies: ['error-analysis'],
      optional: false
    },
    {
      id: 'solution-generation',
      name: 'Solution Generation',
      type: 'parallel',
      configuration: {
        parallelSteps: ['code-fix', 'configuration-fix', 'documentation-update'],
        joinStrategy: 'all'
      },
      dependencies: ['problem-diagnosis'],
      optional: false
    }
  ],
  tools: [
    {
      name: 'error-analyzer',
      type: 'builtin',
      version: '1.0.0',
      configuration: {
        implementation: 'internal-error-analyzer'
      },
      required: true
    }
  ],
  orchestration: 'sequential',
  template: 'debugging-template-v1',
  version: '1.0.0'
};
```

### Generic Mode Workflow
```typescript
const GENERIC_WORKFLOW: WorkflowSpecification = {
  id: 'generic-workflow-v1',
  name: 'Generic Conversation Workflow',
  mode: 'generic',
  steps: [
    {
      id: 'generic-llm',
      name: 'Generic LLM Interaction',
      type: 'llm',
      configuration: {
        model: 'qwen3',
        systemPrompt: 'You are a helpful AI assistant. Respond naturally...',
        temperature: 0.7,
        maxTokens: 1000
      },
      dependencies: [],
      optional: false
    },
    {
      id: 'conversation-management',
      name: 'Conversation Context Management',
      type: 'transform',
      configuration: {
        transformFunction: 'updateConversationContext',
        transformParameters: {
          trackHistory: true,
          maintainPersonality: true
        }
      },
      dependencies: ['generic-llm'],
      optional: true
    }
  ],
  tools: [],
  orchestration: 'sequential',
  template: 'generic-template-v1',
  version: '1.0.0'
};
```

## Parameter Request Generation

### Parameter Definition Types
```typescript
interface ParameterDefinition {
  name: string;
  type: ParameterType;
  description: string;
  required: boolean;
  defaultValue?: any;
  validationRules: ValidationRule[];
  source: ParameterSource;
}

type ParameterType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'file' | 'json';
type ParameterSource = 'user_input' | 'session_context' | 'environment' | 'configuration' | 'computed';

interface ContextRequirement {
  name: string;
  type: 'conversation_history' | 'user_preferences' | 'session_state' | 'project_context';
  required: boolean;
  description: string;
}

interface ValidationRule {
  type: 'format' | 'length' | 'range' | 'pattern' | 'custom';
  rule: string | RegExp | ValidationFunction;
  errorMessage: string;
}
```

### Mode-Specific Parameter Requests
```typescript
const PARAMETER_REQUESTS: Record<CognitiveMode, ExecutionParameterRequest> = {
  planning: {
    requiredInputs: [
      {
        name: 'analysisScope',
        type: 'string',
        description: 'Scope and focus of the analysis',
        required: true,
        validationRules: [
          { type: 'length', rule: 'min:10,max:500', errorMessage: 'Scope must be 10-500 characters' }
        ],
        source: 'user_input'
      },
      {
        name: 'userRequest',
        type: 'string',
        description: 'Original user request for planning',
        required: true,
        validationRules: [],
        source: 'user_input'
      }
    ],
    optionalInputs: [
      {
        name: 'outputFormat',
        type: 'string',
        description: 'Desired output format',
        required: false,
        defaultValue: 'structured_report',
        validationRules: [
          { type: 'pattern', rule: /^(structured_report|bullet_points|detailed_analysis)$/, errorMessage: 'Invalid format' }
        ],
        source: 'user_input'
      },
      {
        name: 'analysisDepth',
        type: 'string',
        description: 'Depth of analysis required',
        required: false,
        defaultValue: 'medium',
        validationRules: [],
        source: 'user_input'
      }
    ],
    contextRequirements: [
      {
        name: 'projectContext',
        type: 'project_context',
        required: true,
        description: 'Current project files and structure'
      },
      {
        name: 'conversationHistory',
        type: 'conversation_history',
        required: false,
        description: 'Previous planning discussions'
      }
    ],
    validationRules: []
  },
  
  coding: {
    requiredInputs: [
      {
        name: 'codeRequest',
        type: 'string',
        description: 'Specific coding task or requirement',
        required: true,
        validationRules: [],
        source: 'user_input'
      },
      {
        name: 'targetLanguage',
        type: 'string',
        description: 'Programming language for code generation',
        required: false,
        defaultValue: 'auto-detect',
        validationRules: [],
        source: 'user_input'
      }
    ],
    optionalInputs: [
      {
        name: 'codeStyle',
        type: 'string',
        description: 'Code style preferences',
        required: false,
        defaultValue: 'standard',
        validationRules: [],
        source: 'user_input'
      },
      {
        name: 'testingRequired',
        type: 'boolean',
        description: 'Whether to include tests',
        required: false,
        defaultValue: true,
        validationRules: [],
        source: 'user_input'
      }
    ],
    contextRequirements: [
      {
        name: 'projectContext',
        type: 'project_context',
        required: true,
        description: 'Current codebase and dependencies'
      }
    ],
    validationRules: []
  }
  
  // ... similar definitions for information, debugging, and generic modes
};
```

## Template Management

### Workflow Templates
```typescript
interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  mode: CognitiveMode;
  version: string;
  specification: WorkflowSpecification;
  parameterRequest: ExecutionParameterRequest;
  metadata: TemplateMetadata;
}

interface TemplateMetadata {
  author: string;
  created: Date;
  lastModified: Date;
  tags: string[];
  category: string;
  complexity: 'simple' | 'medium' | 'complex';
  estimatedExecutionTime: number; // milliseconds
  dependencies: string[];
}

interface TemplateManager {
  // Template loading
  loadTemplate(templateId: string): WorkflowTemplate;
  loadTemplateByMode(mode: CognitiveMode): WorkflowTemplate;
  
  // Template validation
  validateTemplate(template: WorkflowTemplate): ValidationResult;
  
  // Template versioning
  getTemplateVersions(templateId: string): TemplateVersion[];
  upgradeTemplate(templateId: string, newVersion: string): WorkflowTemplate;
  
  // Template customization
  customizeTemplate(template: WorkflowTemplate, customizations: TemplateCustomization[]): WorkflowTemplate;
}
```

### Template Customization
```typescript
interface TemplateCustomization {
  type: 'parameter_override' | 'step_modification' | 'tool_substitution' | 'configuration_change';
  target: string;
  modification: any;
  reason: string;
}

// Example customizations
const TEMPLATE_CUSTOMIZATIONS = {
  // Override LLM model for specific user
  modelOverride: {
    type: 'parameter_override',
    target: 'steps.qwen-coder.configuration.model',
    modification: 'qwen3-coder-32k',
    reason: 'User prefers larger context model'
  },
  
  // Add additional validation step
  addValidation: {
    type: 'step_modification',
    target: 'steps',
    modification: {
      operation: 'insert_after',
      afterStep: 'qwen-coder',
      newStep: ADDITIONAL_VALIDATION_STEP
    },
    reason: 'Project requires additional code validation'
  }
};
```

## Error Handling

### Mode Validation Errors
```typescript
interface ModeValidationError extends Error {
  type: 'mode_validation';
  invalidMode: string;
  supportedModes: CognitiveMode[];
  suggestedFallback?: CognitiveMode;
}

interface TemplateLoadingError extends Error {
  type: 'template_loading';
  templateId: string;
  reason: 'not_found' | 'corrupted' | 'version_mismatch' | 'dependency_missing';
  fallbackTemplate?: string;
}

interface WorkflowGenerationError extends Error {
  type: 'workflow_generation';
  mode: CognitiveMode;
  stage: 'template_loading' | 'parameter_generation' | 'validation' | 'customization';
  details: string;
}
```

### Fallback Strategies
```typescript
interface FallbackStrategy {
  // Mode fallback mapping
  getModeFallback(invalidMode: string): CognitiveMode;
  
  // Template fallback
  getTemplateFallback(templateId: string): WorkflowTemplate;
  
  // Default workflow generation
  generateDefaultWorkflow(mode: CognitiveMode): WorkflowSpecification;
  
  // Simplified parameter request
  generateSimplifiedParameterRequest(mode: CognitiveMode): ExecutionParameterRequest;
}

// Fallback mode mappings
const MODE_FALLBACKS: Record<string, CognitiveMode> = {
  'analyze': 'planning',
  'implement': 'coding',
  'explain': 'information',
  'fix': 'debugging',
  'unknown': 'generic'
};
```

## Performance Requirements

### Response Time Targets
- **Mode Validation**: < 50ms
- **Template Loading**: < 100ms
- **Workflow Generation**: < 200ms
- **Parameter Request Generation**: < 100ms
- **Total Transformation Time**: < 300ms

### Memory Usage
- **Template Cache**: < 100MB
- **Workflow Specifications**: < 10MB per workflow
- **Configuration Data**: < 20MB
- **Total Container Memory**: < 200MB

### Scalability
- **Concurrent Transformations**: 200+ per second
- **Template Library Size**: 1000+ templates
- **Custom Template Support**: 100+ per user
- **Multi-Version Support**: 10+ versions per template

## Configuration

### Container Configuration
```typescript
interface SmartRouterConfig {
  // Template settings
  templateDirectory: string;
  enableTemplateCache: boolean;
  templateCacheTimeout: number;
  
  // Workflow settings
  defaultWorkflowTimeout: number;
  enableWorkflowValidation: boolean;
  allowCustomWorkflows: boolean;
  
  // Performance settings
  maxConcurrentTransformations: number;
  transformationTimeout: number;
  enableMetrics: boolean;
  
  // Feature flags
  enableAdvancedOrchestration: boolean;
  enableWorkflowOptimization: boolean;
  enableCustomTemplates: boolean;
}
```

### Mode Configuration
```typescript
interface ModeConfiguration {
  supportedModes: CognitiveMode[];
  deprecatedModes: Record<string, CognitiveMode>;
  modeAliases: Record<string, CognitiveMode>;
  defaultMode: CognitiveMode;
  fallbackChain: CognitiveMode[];
}
```

## Testing Contract

### Unit Tests
```typescript
describe('SmartRouterContainer', () => {
  describe('mode transformation', () => {
    it('should transform planning mode to planning workflow');
    it('should transform coding mode to coding workflow');
    it('should transform information mode to information workflow');
    it('should transform debugging mode to debugging workflow');
    it('should transform generic mode to generic workflow');
  });
  
  describe('parameter request generation', () => {
    it('should generate correct parameter requests for each mode');
    it('should include required and optional parameters');
    it('should specify validation rules correctly');
    it('should identify context requirements');
  });
  
  describe('template management', () => {
    it('should load templates by mode correctly');
    it('should validate template structure');
    it('should handle template versioning');
    it('should support template customization');
  });
});
```

### Integration Tests
```typescript
describe('SmartRouterContainer Integration', () => {
  it('should receive modes from Pattern Recognition Container');
  it('should send workflow specifications to Workflow Executor Container');
  it('should handle invalid mode inputs gracefully');
  it('should maintain performance under load');
});
```

The Smart Router Container provides the crucial transformation layer that converts cognitive modes into executable workflow specifications, enabling the system to select optimal workflows for each type of user request.