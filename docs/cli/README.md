# Terminal Interface Module

## Multi-Framework Architecture

### Abstraction Layer
**Goal**: Technology-agnostic CLI interfaces supporting multiple terminal UI frameworks with consistent behavior.

**Framework Support**:
- **Ink**: React-based terminal UI with JSX components
- **Hybrid**: Claude Code-style input navigation with Ink rendering
- **neo-blessed**: Traditional terminal widget system
- **PureCLI**: Minimal readline-based interface

### State Machine Specification

**Hierarchical State Management**: XState 5 for complex UI state transitions

**Primary States**:
- **idle**: Awaiting user input
- **processing**: Agent request execution  
- **streaming**: Real-time response display
- **error**: Error handling with recovery

**State Transitions**: `idle → processing → streaming → idle` with error recovery paths

### Interface Contracts

```typescript  
interface ICLI {
  start(): Promise<void>
  stop(): Promise<void>
  processInput(input: CLIInput): Promise<CLIOutput>
  getState(): CLIState
  updateState(updates: Partial<CLIState>): void
}

interface CLIInput {
  readonly raw: string
  readonly timestamp: Date
  readonly source: 'user' | 'system' | 'agent'
}

interface CLIOutput {
  readonly content: string
  readonly type: 'response' | 'error' | 'system' | 'stream'
  readonly metadata: ReadonlyMap<string, unknown>
}
```

### Performance Characteristics

| Framework | Startup Time | Input Latency | Memory Usage | CPU Usage |
|-----------|---------------|---------------|--------------|-----------|
| PureCLI   | <50ms        | <1ms         | 10MB         | Minimal   |
| Ink       | 100-200ms    | 2-5ms        | 25MB         | Low       |
| Hybrid    | 100-200ms    | 2-5ms        | 25MB         | Low       |
| neo-blessed| 50-100ms     | 1-3ms        | 15MB         | Low       |

### Agent Integration

**Input Processing Pipeline**:
```
User Input → CLI Parser → Agent Request → Agent Response → CLI Formatter → Display
```

**Streaming Response Protocol**:
- Progressive content display
- Real-time status updates  
- Error state visualization
- Completion notifications

## Implementation: `lib/src/cli/`