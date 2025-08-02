# API Reference

Quick reference for qi-v2-agent core interfaces and usage patterns.

## Core Interfaces

### Agent
```typescript
interface IAgent {
  processInput(input: string, options?: ProcessingOptions): AsyncIterable<AgentResponse>
  getConfiguration(): AgentConfiguration
  updateConfiguration(updates: Partial<AgentConfiguration>): void
}
```

### Input Classification
```typescript
interface IClassifier {
  classifyInput(input: string): Promise<ClassificationResult>
}

type InputType = 'command' | 'prompt' | 'workflow'

interface ClassificationResult {
  type: InputType
  confidence: number
  reasoning: string
  complexity: ComplexityAnalysis
}
```

### Workflow Engine
```typescript
interface IWorkflowEngine {
  executeWorkflow(spec: WorkflowSpec): AsyncIterable<WorkflowUpdate>
}

interface WorkflowSpec {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  cognitivePattern: CognitivePattern
}
```

### Command System
```typescript
interface ICommandHandler {
  executeCommand(command: string, args: string[]): Promise<CommandResult>
  registerCommand(name: string, handler: CommandFunction): void
}
```

## Quick Start

### Basic Agent Usage
```typescript
import { createAgent } from '@qi/v2-agent'

const agent = createAgent({
  modelProvider: 'ollama',
  model: 'llama3.2'
})

// Process user input
for await (const response of agent.processInput("write a quicksort in python")) {
  console.log(response.content)
}
```

### Classification Only
```typescript
import { InputClassifier } from '@qi/v2-agent/classifier'

const classifier = new InputClassifier()
const result = await classifier.classifyInput("fix bug in src/file.ts and run tests")
console.log(result.type) // 'workflow'
```

### Command Registration
```typescript
import { CommandHandler } from '@qi/v2-agent/command'

const handler = new CommandHandler()
handler.registerCommand('hello', async (args) => ({
  success: true,
  output: `Hello ${args[0] || 'World'}!`
}))
```

## Configuration

### Agent Configuration
```yaml
# config/llm-providers.yaml
providers:
  ollama:
    baseUrl: "http://localhost:11434"
    models:
      default: "llama3.2"
      coding: "deepseek-coder"
```

### Environment Variables
```bash
QI_MODEL_PROVIDER=ollama
QI_DEFAULT_MODEL=llama3.2
QI_CONFIG_PATH=./config/llm-providers.yaml
```

## Built-in Commands

- `/help` - Show available commands
- `/model <name>` - Switch LLM model  
- `/status` - Show agent status
- `/config` - Show current configuration
- `/clear` - Clear conversation history

## Input Types

### Commands
- **Pattern**: Start with `/`
- **Example**: `/help`, `/model llama3.2`
- **Processing**: Direct system function execution

### Prompts  
- **Pattern**: Simple conversational input
- **Example**: "hi", "write a quicksort in python"
- **Processing**: LLM generation with templates

### Workflows
- **Pattern**: Multi-step tasks with file references
- **Example**: "fix bug in src/file.ts and run tests"
- **Processing**: Workflow extraction and execution

## Error Handling

All APIs use Result pattern for error handling:

```typescript
interface Result<T, E = Error> {
  success: boolean
  data?: T
  error?: E
}
```

## Streaming Responses

Most operations support streaming for real-time feedback:

```typescript
for await (const update of agent.processInput(input)) {
  switch (update.type) {
    case 'classification':
      console.log(`Detected: ${update.classification.type}`)
      break
    case 'generation':
      process.stdout.write(update.content)
      break
    case 'completion':
      console.log('\nDone!')
      break
  }
}
```

---

For detailed implementation guides, see the module-specific README files in each `docs/` subdirectory.