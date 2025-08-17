# qi-v2-agent Pre-v-0.8 Comprehensive Implementation Guide

**Document Version**: 3.0  
**Date**: 2025-01-17  
**Status**: Authoritative Implementation Guide Based on Existing Documentation  
**Foundation**: Synthesizes all existing module documentation into implementation roadmap

## Implementation Strategy

This guide provides the definitive implementation roadmap for building the qi-v2-agent framework to achieve the current v-0.8.0 state documented in [impl.status.md](../impl.status.md). It references and builds upon the comprehensive existing documentation across all framework modules.

## Framework Architecture Foundation

### **Documented Module Integration**

The qi-v2-agent framework consists of fully documented modules that integrate to form a complete agent creation framework:

```
┌─────────────────────────────────────────────────────────────────┐
│                 Agent Creation Framework                        │
├─────────────────────────────────────────────────────────────────┤
│ CLI Framework      │ Agent Orchestration │ Workflow Patterns    │
│ [docs/cli/]        │ [docs/agent/]       │ [docs/workflow/]     │
├─────────────────────────────────────────────────────────────────┤
│ Context Management │ State Management    │ Command Processing   │
│ [docs/context/]    │ [TBD: state/]       │ [docs/command/]      │
├─────────────────────────────────────────────────────────────────┤
│ Tool Execution     │ Classification      │ Prompt Processing    │
│ [docs/tools/]      │ [docs/classifier/]  │ [docs/prompt/]       │
├─────────────────────────────────────────────────────────────────┤
│ Messaging Framework │ Security Framework │ QiCore Foundation   │
│ [docs/messaging/]   │ [docs/tools/]      │ [@qi/base]          │
└─────────────────────────────────────────────────────────────────┘
```

**Reference Architecture**: [docs/architecture/current-architecture.md](../../architecture/current-architecture.md)

## Phase 1: Core Infrastructure Implementation

### **Module 1: QiCore Foundation (@qi/base)**

**Implementation Status**: ✅ **Implemented and Working**  
**Documentation**: External dependency (@qi/base)  
**Validation**: Used throughout qi-prompt implementation

**Key Components**:
```typescript
// Result<T> pattern with functional composition
import { success, failure, match, fromAsyncTryCatch } from '@qi/base';

// Error handling with structured context
import { create, validationError, systemError } from '@qi/base';
```

**Implementation Notes**:
- Foundation already exists as external dependency
- Provides functional programming patterns used throughout framework
- No implementation needed - integration pattern established

### **Module 2: Messaging Framework**

**Implementation Status**: ✅ **Fully Implemented**  
**Documentation**: [docs/messaging/](../../messaging/)  
**Reference Implementation**: `lib/src/messaging/impl/QiAsyncMessageQueue.ts`

**From [docs/messaging/README.md](../../messaging/README.md)**:

> The v-0.6.x messaging module provides a comprehensive async message queue system inspired by Claude Code's h2A pattern, fully integrated with QiCore functional programming principles.

**Implementation Architecture**:
```typescript
// h2A pattern implementation
class QiAsyncMessageQueue<T extends QiMessage> implements IAsyncMessageQueue<T> {
  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    // Single iterator constraint - h2A pattern
    while (!this.state.isDone) {
      const message = await this.waitForMessage();
      if (message) yield message;
    }
  }
}
```

**Integration Pattern**: 
- Used in qi-prompt: `app/src/prompt/QiPromptCLI.ts:200`
- Message types: USER_INPUT, AGENT_OUTPUT, TOOL_EXECUTION, WORKFLOW_EVENT, SYSTEM_CONTROL
- Priority support: LOW, NORMAL, HIGH, CRITICAL

**Validation**: ✅ **Working in production** (qi-prompt uses h2A message processing)

### **Module 3: Classification Framework**

**Implementation Status**: ✅ **Fully Implemented**  
**Documentation**: [docs/classifier/](../../classifier/)  
**Reference Implementation**: `lib/src/classifier/`

**From [docs/classifier/README.md](../../classifier/README.md)**:

> Professional three-type input classification: **command/prompt/workflow**.

**4-Tier Architecture**:
```
classifier/
├── abstractions/        # Core interfaces and types
├── impl/               # 7 classification methods
├── shared/            # Performance tracking and error handling
└── schema-registry/   # Dynamic schema management
```

**Implementation Methods**:
- `rule-based.ts` - Pattern matching (0ms)
- `llm-direct.ts` - Universal LLM wrapper (3ms)  
- `structured-output.ts` - Main LangChain method (3ms)
- `fewshot.ts` - Few-shot learning
- `chat-prompt.ts` - Conversational context
- `output-parser.ts` - Legacy model support
- `output-fixing.ts` - Auto-correction retry

**Integration Pattern**:
```typescript
const classificationResult = await classifier.classify(input, context);
// Returns: { type: 'command' | 'prompt' | 'workflow', confidence: number }
```

### **Module 4: CLI Framework**

**Implementation Status**: ✅ **Fully Implemented**  
**Documentation**: [docs/cli/](../../cli/)  
**Reference Implementation**: `lib/src/cli/frameworks/`

**From [docs/cli/README.md](../../cli/README.md)**:

> **Framework Support**:
> - **Ink**: React-based terminal UI with JSX components
> - **Hybrid**: Claude Code-style input navigation with Ink rendering
> - **neo-blessed**: Traditional terminal widget system
> - **PureCLI**: Minimal readline-based interface

**Multi-Framework Architecture**:
```
cli/frameworks/
├── ink/                 # React-based terminal UI
├── hybrid/              # Auto-detection framework
├── readline/            # Traditional CLI interface  
└── index.ts            # Framework factory
```

**State Machine Specification**:
- **idle** → **processing** → **streaming** → **idle**
- Error recovery paths with XState 5 integration
- Hierarchical state management

**Integration Pattern**:
```typescript
const cli = createCLI({
  framework: 'hybrid', // ink/readline/hybrid
  messageQueue: QiAsyncMessageQueue,
  stateManager: IStateManager
});
```

**Validation**: ✅ **Working in production** (qi-prompt uses hybrid CLI framework)

### **Module 5: Context Management**

**Implementation Status**: ✅ **Architecture Implemented**  
**Documentation**: [docs/context/](../../context/)  
**Reference Implementation**: `lib/src/context/impl/ContextManager.ts`

**From [docs/context/README.md](../../context/README.md)**:

> Based on extensive research into AI paradigms and agent architectures, the Context Manager has been identified as the **primary intelligence component** for implementing sophisticated inference strategies and future learning capabilities.

**Key Architectural Insights**:
1. **"Learning Paradigms" are actually Context Management strategies**
2. **Context Manager is the correct architectural component**
3. **Three-category classifier is over-engineered**
4. **True learning requires local model fine-tuning**

**Implementation Architecture**:
```typescript
interface IContextManager {
  getApplicationContext(): AppContext;
  createIsolatedContext(config: IsolatedContextConfig): IsolatedContext;
  createConversationContext(sessionId: string): ConversationContext;
  validateContextAccess(contextId: string, operation: string): boolean;
}
```

**Security Framework**:
```typescript
interface SecurityRestrictions {
  readOnlyMode: boolean;
  allowedPaths: string[];
  blockedCommands: string[];
  requireApproval: boolean;
  maxExecutionTime: number;
  networkAccess: boolean;
}
```

## Phase 2: Agent and Tool Integration

### **Module 6: Agent Framework**

**Implementation Status**: ✅ **Fully Implemented**  
**Documentation**: [docs/agent/](../../agent/)  
**Reference Implementation**: `lib/src/agent/impl/QiCodeAgent.ts`

**From [docs/agent/README.md](../../agent/README.md)**:

**Interface Specification**:
```typescript
interface IAgent {
  initialize(): Promise<void>
  process(request: AgentRequest): Promise<AgentResponse>
  stream(request: AgentRequest): AsyncIterable<AgentStreamChunk>  
  getStatus(): AgentStatus
  shutdown(): Promise<void>
}
```

**Processing Pipeline**:
1. **Request Validation**: Verify input structure and context completeness
2. **Classification**: Determine input type (command/prompt/workflow) via classifier
3. **Handler Dispatch**: Route to CommandHandler, PromptHandler, or WorkflowEngine
4. **Response Coordination**: Aggregate and format responses

**Implementation Examples**:
- `QiCodeAgent.ts` - Full-featured agent orchestrator
- `PromptAppOrchestrator.ts` - Simplified agent for qi-prompt

**Validation**: ✅ **Working in production** (qi-prompt uses PromptAppOrchestrator)

### **Module 7: Tool Execution Framework**

**Implementation Status**: ✅ **Fully Implemented**  
**Documentation**: [docs/tools/](../../tools/)  
**Reference Implementation**: `lib/src/tools/`

**From [docs/tools/README.md](../../tools/README.md)**:

> **Purpose**: Comprehensive tool execution framework for agent capabilities  
> **Status**: Production-ready with 14 operational tools  
> **Architecture**: 6-phase execution pipeline with security framework

**6-Phase Execution Pipeline**:
```typescript
enum ExecutionPhase {
  VALIDATION = 'validation',        // Input validation and sanitization
  PERMISSION = 'permission',        // Permission and security checks
  PREPARATION = 'preparation',      // Environment and context setup
  EXECUTION = 'execution',          // Tool execution with monitoring
  POSTPROCESSING = 'postprocessing', // Result processing and formatting
  CLEANUP = 'cleanup'               // Resource cleanup and state reset
}
```

**Tool Categories**:
1. **File System Tools** (6 tools): ReadTool, WriteTool, EditTool, MultiEditTool, LSTool, BaseTool
2. **Search Tools** (2 tools): GlobTool, GrepTool
3. **System Tools** (2 tools): BashTool, ProcessManager
4. **Parsing Tools** (4 tools): FileContentResolver, FileReferenceParser, ProjectStructureScanner, SessionManager

**Security Framework**:
```typescript
interface ToolPermissions {
  canRead: boolean;
  canWrite: boolean;
  canExecute: boolean;
  allowedPaths: string[];
  maxFileSize: number;
  timeout: number;
}
```

### **Module 8: Workflow Framework**

**Implementation Status**: ✅ **Architecture Implemented**  
**Documentation**: [docs/workflow/](../../workflow/)  
**Reference Implementation**: `lib/src/workflow/`

**From [docs/workflow/README.md](../../workflow/README.md)**:

**Graph-Based Execution Model**:
- Workflows represented as directed acyclic graphs (DAGs)
- Modified Kahn's algorithm with streaming support
- Time Complexity: O(|N| + |E|), Space Complexity: O(|N|)

**Simple Workflow Implementation**:
```typescript
export enum SimpleWorkflowClass {
  FILE_REFERENCE = 'file-reference',
  // Future extensions:
  // MULTI_FILE = 'multi-file',
  // PROJECT_CONTEXT = 'project-context',
}

abstract class SimpleWorkflow {
  protected maxComplexity: number = 3; // Bounded complexity
  abstract execute(input: WorkflowInput): Promise<WorkflowResult>;
}
```

**Current Implementation**: `FileReferenceWorkflow` - Handles @file.txt patterns
- **Step 1**: Parse file references from input
- **Step 2**: Resolve file content using FileContentResolver
- **Step 3**: Enhance prompt with file content

**Validation**: ✅ **Working in production** (qi-prompt uses FileReferenceWorkflow)

### **Module 9: Prompt Processing**

**Implementation Status**: ✅ **Fully Implemented**  
**Documentation**: [docs/prompt/](../../prompt/)  
**Reference Implementation**: `lib/src/prompt/`

**From [docs/prompt/README.md](../../prompt/README.md)**:

**Two-Layer Architecture Excellence**:

**Inner Layer (qicore Professional)**:
- @qi/base: Result<T> patterns with functional composition
- @qi/core: ConfigBuilder with schema validation
- Domain-specific errors: LLMError extends QiError
- Operational reliability: Circuit breakers, retries

**Interfacing Layer (Developer-Friendly)**:
- Promise-based interfaces hiding qicore complexity
- LangChain ChatPromptTemplate with conversation history
- Template system: Five specialized templates
- Clean abstractions: No Result<T> exposure in public API

**Technology Stack**:
- **multi-llm-ts v4.2.2**: Unified TypeScript interface for multiple LLM providers
- **@langchain/core**: Message types and ChatPromptTemplate
- **Ollama** (primary): Local models with full privacy

**Template System** (5 Specialized Templates):
1. **Default**: General-purpose context-aware assistant
2. **Coding**: Expert software developer and coding assistant
3. **Problem-solving**: Step-by-step analysis and solution provider
4. **Educational**: Patient teacher with examples and explanations
5. **Debugging**: Systematic troubleshooting expert

### **Module 10: Command Processing**

**Implementation Status**: ✅ **Fully Implemented**  
**Documentation**: [docs/command/](../../command/)  
**Reference Implementation**: `lib/src/command/`

**From [docs/command/README.md](../../command/README.md)**:

**Built-in Commands**:
- `/help` - Display available commands and usage
- `/status` - Show agent status and metrics
- `/config` - Display current configuration
- `/model <name>` - Switch LLM model
- `/clear` - Clear conversation history

**Command Processing Pipeline**:
1. **Prefix Detection**: Commands must start with `/`
2. **Parameter Parsing**: Space-separated argument extraction
3. **Validation**: Parameter count and type checking
4. **Execution**: Handler invocation with context
5. **Response Formatting**: Structured result output

**Performance Characteristics**:
- Command Detection: 0-1ms (prefix matching)
- Built-in Execution: <5ms (state queries, configuration)
- Memory Usage: Constant regardless of command count

## Phase 3: Integration and Validation

### **Working Implementation Example: qi-prompt**

**Implementation Status**: ✅ **Production Ready**  
**Documentation**: [docs/qi-prompt/](../../qi-prompt/)  
**Reference Implementation**: `app/src/prompt/qi-prompt.ts`

**From [docs/qi-prompt/README.md](../../qi-prompt/README.md)**:

> qi-prompt is the advanced prompt application in the qi-v2-agent dual-agent architecture. It focuses on sophisticated context management with RAG integration while maintaining simple, well-defined workflow patterns.

**Integration Architecture**:
```typescript
// qi-prompt integration pattern
class QiPromptApp {
  private messageQueue: QiAsyncMessageQueue<QiMessage>;
  private orchestrator: PromptAppOrchestrator;
  private cli: ICLIFramework;
  private workflowHandler: IWorkflowHandler;
  
  async initialize() {
    // 1. Create h2A message queue
    this.messageQueue = new QiAsyncMessageQueue<QiMessage>();
    
    // 2. Create agent orchestrator
    this.orchestrator = new PromptAppOrchestrator(
      stateManager, contextManager, agentConfig, dependencies
    );
    
    // 3. Create CLI framework
    this.cli = createCLI({ framework: 'hybrid', messageQueue: this.messageQueue });
    
    // 4. Create workflow handler with simple workflows
    this.workflowHandler = createWorkflowHandler();
  }
}
```

**Message Processing Loop** (from `QiPromptCLI.ts:200`):
```typescript
for await (const message of this.messageQueue) {
  if (!this.isRunning) break;
  await this.processMessage(message);
}
```

**Validation Evidence**:
- ✅ **8.74MB Standalone Executable** that works
- ✅ **h2A Message Processing** operational in production
- ✅ **Simple Workflow System** (FileReferenceWorkflow) functional
- ✅ **Multi-Provider LLM Support** with 5 providers
- ✅ **Professional CLI Arguments** with configuration flexibility

## Implementation Roadmap

### **Week 1-2: Foundation Setup**

**Objective**: Establish project structure and core dependencies

**Tasks**:
1. **Project Structure Creation**
   ```bash
   mkdir qi-v2-agent && cd qi-v2-agent
   mkdir -p {lib/src,app/src,docs,config,examples}
   mkdir -p lib/src/{agent,cli,context,messaging,prompt,tools,workflow,classifier,command}
   ```

2. **Package Configuration**
   - Root package.json with workspace configuration
   - TypeScript configuration with path mapping
   - Build tooling setup (tsup for bundling)

3. **QiCore Integration**
   ```bash
   npm install @qi/base @qi/core
   ```

4. **Core Dependencies**
   ```bash
   npm install zod typescript vitest
   npm install multi-llm-ts @langchain/core
   npm install fast-glob chokidar execa
   npm install ink react blessed
   ```

### **Week 3-4: Messaging and Classification**

**Objective**: Implement core coordination and routing systems

**Tasks**:
1. **Messaging Framework Implementation**
   - Reference: [docs/messaging/](../../messaging/)
   - Implement `QiAsyncMessageQueue` with h2A pattern
   - Create `QiMessageFactory` for typed message creation
   - Add priority support and TTL management

2. **Classification Framework Implementation**
   - Reference: [docs/classifier/](../../classifier/)
   - Implement 4-tier architecture with 7 methods
   - Add schema registry for dynamic classification
   - Integrate rule-based (0ms) and LLM-based (3ms) methods

**Validation Criteria**:
- h2A message processing functional
- Classification accuracy >95% on test data
- Performance targets: <10ms message processing, <3ms classification

### **Week 5-6: CLI and Context Management**

**Objective**: Implement user interface and security framework

**Tasks**:
1. **CLI Framework Implementation**
   - Reference: [docs/cli/](../../cli/)
   - Implement multi-framework support (ink/readline/hybrid)
   - Add state machine with XState 5 integration
   - Create message queue integration

2. **Context Management Implementation**
   - Reference: [docs/context/](../../context/)
   - Implement security boundaries and isolation
   - Add conversation context management
   - Create access validation framework

**Validation Criteria**:
- CLI frameworks switchable at runtime
- Security boundaries enforced
- Context isolation functional

### **Week 7-8: Agent and Prompt Processing**

**Objective**: Implement core agent orchestration and LLM integration

**Tasks**:
1. **Agent Framework Implementation**
   - Reference: [docs/agent/](../../agent/)
   - Implement `IAgent` interface with processing pipeline
   - Create dependency injection patterns
   - Add streaming response support

2. **Prompt Processing Implementation**
   - Reference: [docs/prompt/](../../prompt/)
   - Implement two-layer architecture
   - Add LangChain integration with 5 templates
   - Create multi-provider LLM support

**Validation Criteria**:
- Agent orchestration functional
- LLM integration with fallback working
- Context continuation operational

### **Week 9-10: Tools and Workflows**

**Objective**: Implement execution capabilities

**Tasks**:
1. **Tool Framework Implementation**
   - Reference: [docs/tools/](../../tools/)
   - Implement 6-phase execution pipeline
   - Create 14 operational tools
   - Add security framework with audit logging

2. **Workflow Framework Implementation**
   - Reference: [docs/workflow/](../../workflow/)
   - Implement Simple Workflow architecture
   - Create `FileReferenceWorkflow` with bounded complexity
   - Add graph-based execution engine

**Validation Criteria**:
- Tool execution pipeline operational
- Security boundaries enforced
- Simple workflows functional

### **Week 11-12: Integration and Production**

**Objective**: Complete system integration and production readiness

**Tasks**:
1. **Command Processing Implementation**
   - Reference: [docs/command/](../../command/)
   - Implement built-in command system
   - Add extensibility framework
   - Create security validation

2. **Example Agent Implementation**
   - Reference: [docs/qi-prompt/](../../qi-prompt/)
   - Implement qi-prompt as working example
   - Add binary compilation support
   - Create production configuration

**Validation Criteria**:
- Complete framework integration functional
- qi-prompt binary compilation successful
- All performance targets achieved

## Success Criteria and Validation

### **Technical Performance Targets**

**Messaging Framework**:
- Message processing: <10ms per message
- h2A pattern constraint: Single iterator enforced
- Priority queuing: CRITICAL → HIGH → NORMAL → LOW

**Classification Framework**:
- Accuracy: >95% on test datasets
- Performance: 0ms (rule-based), <3ms (LLM-based)
- Methods: 7 classification approaches operational

**CLI Framework**:
- Framework switching: <100ms transition time
- State management: Real-time UI updates
- Multi-platform: Windows, macOS, Linux support

**Tool Framework**:
- Execution overhead: <100ms pipeline overhead
- Security validation: 100% path validation coverage
- Tool count: 14 operational tools minimum

**Agent Framework**:
- Response time: <2 seconds for simple prompts
- Memory usage: <50MB for basic operations
- Binary size: <20MB compiled executable

### **Integration Validation**

**End-to-End Message Flow**:
```
User Input → CLI → Message Queue → Agent → Classifier → Handler → Response
```

**Security Framework Validation**:
- Context isolation functional
- Permission enforcement operational
- Audit logging comprehensive

**Working Example Validation**:
- qi-prompt binary compilation successful
- @file pattern processing functional
- Multi-provider LLM integration working

### **Documentation Validation**

All implementation decisions must reference existing module documentation:
- [docs/messaging/](../../messaging/) - Message queue patterns
- [docs/classifier/](../../classifier/) - Classification methods
- [docs/cli/](../../cli/) - CLI framework architecture
- [docs/context/](../../context/) - Context management strategies
- [docs/agent/](../../agent/) - Agent orchestration patterns
- [docs/prompt/](../../prompt/) - LLM integration patterns
- [docs/tools/](../../tools/) - Tool execution framework
- [docs/workflow/](../../workflow/) - Workflow orchestration
- [docs/command/](../../command/) - Command processing
- [docs/qi-prompt/](../../qi-prompt/) - Working implementation example

## Framework Extension Patterns

### **Agent Creation Pattern**

```typescript
// Pattern for creating new agents using framework
function createCustomAgent(config: CustomAgentConfig): IAgent {
  const stateManager = createStateManager();
  const contextManager = createContextManager();
  const dependencies = {
    classifier: createClassifier(config.classifierConfig),
    commandHandler: createCommandHandler(config.commandConfig),
    promptHandler: createPromptHandler(config.promptConfig),
    workflowHandler: createWorkflowHandler(config.workflowConfig)
  };
  
  return createAgent(stateManager, contextManager, {
    domain: config.domain,
    enableCommands: config.enableCommands,
    enablePrompts: config.enablePrompts,
    enableWorkflows: config.enableWorkflows,
    ...dependencies
  });
}
```

### **Tool Development Pattern**

```typescript
// Pattern for creating custom tools
class CustomTool implements ITool<CustomInput, CustomOutput> {
  readonly name = 'custom-tool';
  readonly description = 'Custom tool implementation';
  readonly version = '1.0.0';
  readonly inputSchema = CustomInputSchema;
  
  async execute(input: CustomInput, context: ToolContext): Promise<Result<CustomOutput, QiError>> {
    // 6-phase execution handled by framework
    return fromAsyncTryCatch(
      async () => this.performOperation(input),
      error => systemError(`Custom tool execution failed: ${error.message}`)
    );
  }
}
```

### **Workflow Development Pattern**

```typescript
// Pattern for creating simple workflows
class CustomWorkflow extends SimpleWorkflow {
  getWorkflowClass(): SimpleWorkflowClass {
    return SimpleWorkflowClass.CUSTOM_PATTERN;
  }
  
  async execute(input: WorkflowInput): Promise<WorkflowResult> {
    // Bounded complexity: max 3 operations
    this.validateComplexity(3);
    
    // Operation 1: Parse input
    // Operation 2: Process data
    // Operation 3: Format output
    
    return this.createSuccessResult(output, metadata);
  }
}
```

## Summary

This comprehensive implementation guide provides the definitive roadmap for building the qi-v2-agent framework to achieve the current v-0.8.0 state. It builds upon the extensive existing documentation across all framework modules and provides practical implementation patterns proven by the working qi-prompt example.

**Key Success Factors**:
1. **Reference existing documentation** as authoritative source
2. **Follow proven architecture patterns** from module docs
3. **Validate against working implementation** (qi-prompt)
4. **Achieve documented performance targets**
5. **Maintain framework extensibility** for unlimited agent creation

**Framework Foundation**: Enables unlimited agent creation through robust design patterns proven in production.

---

**Status**: Comprehensive implementation guide complete  
**Foundation**: Built upon existing excellent module documentation  
**Validation**: Proven patterns from working qi-prompt implementation  
**Target**: Complete qi-v2-agent framework v-0.8.0 functionality  
**Last Updated**: 2025-01-17