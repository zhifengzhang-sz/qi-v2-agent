# Sub-Agent Module

Single-agent task execution, tool coordination, conversation management, and AgentChat framework integration.

## Overview

The Sub-Agent module provides clean abstractions over Microsoft's AgentChat framework, enabling sophisticated single-agent task execution with conversation management and tool coordination. It supports domain-specific agent specializations for focused capabilities.

## Key Features

- **AgentChat Integration**: Clean abstraction over Microsoft AgentChat framework
- **Tool Coordination**: Seamless tool execution and management
- **Conversation Management**: Dialog state and context maintenance
- **Specialization**: Domain-specific agents (FileOps, Web, Git operations)

## Interface

```typescript
import { ISubAgent } from '@qi/agent/sub-agent';

const subAgent: ISubAgent = createSubAgent({
  maxConversationTurns: 10,
  enableToolCoordination: true,
  agentChatConfig: {
    endpoint: 'https://api.agentchat.example.com',
    apiKey: process.env.AGENTCHAT_API_KEY,
    model: 'gpt-4'
  }
});
```

## Core Methods

### executeTask()
Execute single-agent task with comprehensive result tracking.

```typescript
const task = {
  id: 'file-analysis',
  type: 'code-review',
  description: 'Review this TypeScript file for issues',
  context: fileContent,
  priority: 'high',
  requiredTools: ['file-reader', 'linter', 'formatter']
};

const result = await subAgent.executeTask(task);
if (result.isOk()) {
  console.log(`Task completed in ${result.value.metadata.executionTime}ms`);
  console.log(`Tools used: ${result.value.metadata.toolsUsed.join(', ')}`);
}
```

### handleConversation()
Manage conversational interactions with context persistence.

```typescript
const response = await subAgent.handleConversation(
  'Can you explain the main function in this code?',
  contextId
);

if (response.isOk()) {
  console.log('Agent response:', response.value);
}
```

### coordinateTools()
Coordinate multiple tools for complex task execution.

```typescript
const toolRequest = {
  tools: ['file-reader', 'syntax-checker', 'formatter'],
  parameters: {
    filePath: '/src/components/Button.tsx',
    formatStyle: 'prettier'
  },
  parallelExecution: true,
  failureStrategy: 'continue'
};

const coordination = await subAgent.coordinateTools(toolRequest);
```

### specializeFor()
Create specialized agent instance for specific domains.

```typescript
const fileOpsSpecialization = {
  name: 'file-operations',
  description: 'Specialized in file system operations',
  capabilities: ['read', 'write', 'search', 'organize'],
  toolRequirements: ['file-system', 'text-editor', 'search-engine'],
  domains: ['filesystem', 'content-management']
};

const specializedAgent = await subAgent.specializeFor(fileOpsSpecialization);
```

## Specialized Agent Types

### FileOps Agent
Specialized for file system operations.

```typescript
import { createFileOpsAgent } from '@qi/agent/sub-agent';

const fileAgent = createFileOpsAgent();

// File operations
await fileAgent.readFile('/path/to/file.ts');
await fileAgent.writeFile('/path/to/output.ts', content);
await fileAgent.listFiles('/src/components');
await fileAgent.searchFiles('*.tsx', '/src');
```

### Web Agent
Specialized for web operations and content extraction.

```typescript
import { createWebAgent } from '@qi/agent/sub-agent';

const webAgent = createWebAgent();

// Web operations
await webAgent.fetchUrl('https://api.example.com/data');
await webAgent.searchWeb('TypeScript best practices');
await webAgent.extractContent('https://docs.example.com', '.content');
```

### Git Agent
Specialized for Git repository operations.

```typescript
import { createGitAgent } from '@qi/agent/sub-agent';

const gitAgent = createGitAgent();

// Git operations
await gitAgent.getStatus();
await gitAgent.createCommit('feat: add new component', ['src/Button.tsx']);
await gitAgent.createBranch('feature/new-button');
await gitAgent.switchBranch('main');
```

## Configuration

```typescript
interface SubAgentConfig {
  readonly maxConversationTurns?: number;
  readonly defaultTimeout?: number;
  readonly enableToolCoordination?: boolean;
  readonly agentChatConfig?: {
    endpoint?: string;
    apiKey?: string;
    model?: string;
  };
  readonly specializations?: AgentSpecialization[];
  readonly toolConfig?: {
    maxConcurrentTools: number;
    retryAttempts: number;
    timeoutMs: number;
  };
}
```

## Conversation Management

### Context Persistence
Maintain conversation state across interactions:

```typescript
// Start conversation
const contextId = 'analysis-session-1';
await subAgent.handleConversation('Analyze this code', contextId);

// Continue conversation with context
await subAgent.handleConversation('What are the potential issues?', contextId);

// Retrieve conversation history
const history = subAgent.getConversationHistory(contextId);
```

### Context Cleanup
Clear conversation context when complete:

```typescript
subAgent.clearConversation(contextId);
```

## Tool Coordination

### Parallel Execution
Execute multiple tools simultaneously:

```typescript
const result = await subAgent.coordinateTools({
  tools: ['linter', 'formatter', 'type-checker'],
  parameters: { filePath: '/src/component.ts' },
  parallelExecution: true
});
```

### Failure Strategies
Handle tool failures gracefully:

- **abort**: Stop execution on first failure
- **continue**: Continue with remaining tools
- **retry**: Retry failed tools with backoff

## Integration with QiCore

```typescript
import { Result } from '@qi/base';

// All methods return Result<T, QiError>
const taskResult: Result<AgentResult, QiError> = 
  await subAgent.executeTask(task);

taskResult.match(
  (result) => {
    console.log('Task completed successfully');
    console.log(`Execution time: ${result.metadata.executionTime}ms`);
  },
  (error) => console.error('Task failed:', error.message)
);
```

## Performance Metrics

Track agent specialization performance:

```typescript
const specializations = subAgent.getAvailableSpecializations();
if (specializations.isOk()) {
  specializations.value.forEach(spec => {
    if (spec.performanceMetrics) {
      console.log(`${spec.name}: ${spec.performanceMetrics.successRate}% success rate`);
    }
  });
}
```

## Error Handling

Sub-agents provide comprehensive error handling:

```typescript
const result = await subAgent.coordinateTools(request);
if (result.isErr()) {
  console.error('Tool coordination failed:', result.error.message);
  
  // Check failed tools
  if (result.error.source === 'execution') {
    console.log('Failed tools:', result.error.metadata?.failedTools);
  }
}
```