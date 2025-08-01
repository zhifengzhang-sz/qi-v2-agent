# State Management with XState 5

## 🎯 Overview

The CLI system uses **XState 5** for sophisticated state management, implementing a hierarchical state machine that handles both high-level application states and fine-grained UI sub-states.

## 🏗️ State Machine Architecture

### Hierarchical State Design

```
┌─────────────────────────────────────────────────┐
│                Application States                │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌─────────┐         ┌─────────────────────────┐│
│  │  busy   │         │        ready            ││
│  │         │         │  ┌─────────────────────┐││
│  │ (task)  │ ◄──────►│  │     planning        │││
│  │         │         │  └─────────────────────┘││
│  │         │         │  ┌─────────────────────┐││
│  │         │         │  │     editing         │││ ◄─ Shift+Tab
│  │         │         │  └─────────────────────┘││    cycles
│  │         │         │  ┌─────────────────────┐││
│  │         │         │  │     generic         │││
│  │         │         │  └─────────────────────┘││
│  └─────────┘         └─────────────────────────┘│
│                                                 │
└─────────────────────────────────────────────────┘
```

### State Definitions

#### Top-Level States

1. **`busy`** - Application is processing a long-running task
   - **Context**: `taskName: string`, `startTime: Date`
   - **UI Behavior**: Shows spinner, task name, elapsed time
   - **User Input**: Disabled except for cancellation commands

2. **`ready`** - Application is ready for user interaction
   - **Context**: `currentSubState: AppSubState`, `lastSubState: AppSubState`
   - **UI Behavior**: Input enabled, state indicator shows sub-state
   - **User Input**: Full command and prompt processing

#### Ready Sub-States

1. **`planning`** - User is in planning/design mode
   - **Visual Indicator**: 📋 Planning mode
   - **Behavior**: Optimized for brainstorming, high-level design
   - **Keyboard**: Shift+Tab → editing

2. **`editing`** - User is in active coding/editing mode  
   - **Visual Indicator**: ✏️ Editing mode
   - **Behavior**: Optimized for code generation, file operations  
   - **Keyboard**: Shift+Tab → generic

3. **`generic`** - Default interaction mode
   - **Visual Indicator**: 💬 Generic mode
   - **Behavior**: General conversation and questions
   - **Keyboard**: Shift+Tab → planning

## 🔧 XState 5 Implementation

### Machine Definition

```typescript
// app/src/cli/abstractions/state-machine.ts
import { createMachine, assign } from 'xstate'

export const createCLIStateMachine = () => createMachine({
  id: 'cliApp',
  initial: 'ready',
  
  context: {
    currentState: 'ready' as AppState,
    currentSubState: 'generic' as AppSubState,
    lastSubState: 'generic' as AppSubState,
    taskName: undefined,
    startTime: undefined
  },
  
  states: {
    busy: {
      entry: assign({
        currentState: 'busy' as AppState,
        startTime: () => new Date()
      }),
      
      on: {
        TASK_COMPLETE: {
          target: 'ready.generic',
          actions: assign({
            currentState: 'ready' as AppState,
            currentSubState: 'generic' as AppSubState,
            taskName: undefined,
            startTime: undefined
          })
        },
        
        TASK_ERROR: {
          target: 'ready.generic', 
          actions: assign({
            currentState: 'ready' as AppState,
            currentSubState: 'generic' as AppSubState,
            taskName: undefined,
            startTime: undefined
          })
        }
      }
    },
    
    ready: {
      initial: 'generic',
      
      entry: assign({
        currentState: 'ready' as AppState
      }),
      
      states: {
        planning: {
          entry: assign({
            currentSubState: 'planning' as AppSubState,
            lastSubState: ({ context }) => context.currentSubState
          }),
          
          on: {
            CYCLE_STATE: {
              target: 'editing',
              actions: assign({
                currentSubState: 'editing' as AppSubState,
                lastSubState: 'planning' as AppSubState
              })
            }
          }
        },
        
        editing: {
          entry: assign({
            currentSubState: 'editing' as AppSubState,
            lastSubState: ({ context }) => context.currentSubState
          }),
          
          on: {
            CYCLE_STATE: {
              target: 'generic',
              actions: assign({
                currentSubState: 'generic' as AppSubState,
                lastSubState: 'editing' as AppSubState
              })
            }
          }
        },
        
        generic: {
          entry: assign({
            currentSubState: 'generic' as AppSubState,
            lastSubState: ({ context }) => context.currentSubState
          }),
          
          on: {
            CYCLE_STATE: {
              target: 'planning',
              actions: assign({
                currentSubState: 'planning' as AppSubState,
                lastSubState: 'generic' as AppSubState
              })
            }
          }
        }
      },
      
      on: {
        START_TASK: {
          target: 'busy',
          actions: assign({
            taskName: ({ event }) => event.taskName,
            startTime: () => new Date(),
            currentState: 'busy' as AppState
          })
        }
      }
    }
  }
})
```

### State Manager Implementation

```typescript
// app/src/cli/impl/state-manager.ts  
import { createActor } from 'xstate'
import { createCLIStateMachine } from '../abstractions/state-machine.js'

export class XStateManager implements IStateManager {
  private machine = createCLIStateMachine()
  private actor = createActor(this.machine)
  private callbacks: StateCallback[] = []
  
  constructor() {
    this.actor.start()
    
    // Subscribe to state changes and notify callbacks
    this.actor.subscribe((snapshot) => {
      const context = this.mapSnapshotToContext(snapshot)
      this.callbacks.forEach(callback => callback(context))
    })
  }
  
  getCurrentState(): AppState {
    return this.actor.getSnapshot().context.currentState
  }
  
  getCurrentSubState(): AppSubState {
    return this.actor.getSnapshot().context.currentSubState
  }
  
  cycleReadyStates(): void {
    this.actor.send({ type: 'CYCLE_STATE' })
  }
  
  setBusy(taskName: string): void {
    this.actor.send({ 
      type: 'START_TASK',
      taskName 
    })
  }
  
  setReady(): void {
    this.actor.send({ type: 'TASK_COMPLETE' })
  }
}
```

## ⌨️ Keyboard Integration

### Shift+Tab State Cycling

The system implements intelligent state cycling with **Shift+Tab**:

```typescript
// Framework-specific keyboard handling
handleKeyPress(key: string, data: any) {
  if (key === 'tab' && data.shift) {
    // Cycle through ready sub-states
    this.stateManager.cycleReadyStates()
    return true // Handled
  }
  return false // Not handled
}
```

### Visual State Indicators

Each framework implements state visualization:

#### Neo-blessed Implementation
```typescript
private updateStateIndicator() {
  const state = this.stateManager.getCurrentState()
  const subState = this.stateManager.getCurrentSubState()
  
  if (state === 'busy') {
    this.stateWidget.setContent('🔄 Processing...')
  } else {
    const indicators = {
      planning: '📋 Planning',
      editing: '✏️ Editing', 
      generic: '💬 Generic'
    }
    this.stateWidget.setContent(indicators[subState])
  }
}
```

#### Ink Implementation  
```tsx
const StateIndicator: React.FC<{state: AppState, subState: AppSubState}> = 
  ({ state, subState }) => {
    if (state === 'busy') {
      return <Text color="yellow">🔄 Processing...</Text>
    }
    
    const indicators = {
      planning: <Text color="blue">📋 Planning</Text>,
      editing: <Text color="green">✏️ Editing</Text>,
      generic: <Text color="white">💬 Generic</Text>
    }
    
    return indicators[subState]
  }
```

## 🔄 State Transition Scenarios

### 1. User Input Processing

```
ready.generic → START_TASK → busy → TASK_COMPLETE → ready.generic
```

**Trigger**: User submits complex prompt requiring LLM processing
**Duration**: 2-30 seconds depending on LLM response time

### 2. State Cycling

```
ready.generic → CYCLE_STATE → ready.planning → CYCLE_STATE → ready.editing
```

**Trigger**: User presses Shift+Tab repeatedly
**Duration**: Instantaneous UI update

### 3. Error Handling

```
ready.editing → START_TASK → busy → TASK_ERROR → ready.editing
```

**Trigger**: Command execution fails or LLM request times out
**Recovery**: Returns to previous sub-state with error message

### 4. Long-Running Commands

```
ready.planning → START_TASK → busy (with taskName) → TASK_COMPLETE → ready.planning
```

**Example**: Shell command execution, file operations
**UI**: Shows task name and elapsed time during processing

## 📊 State Persistence

### Session Context

The state machine maintains rich context information:

```typescript
interface AppStateContext {
  currentState: AppState           // 'busy' | 'ready'
  currentSubState: AppSubState     // 'planning' | 'editing' | 'generic'
  lastSubState: AppSubState        // Previous sub-state for recovery
  taskName?: string               // Current task description
  startTime?: Date                // Task start time for duration calc
}
```

### Context Usage

- **UI Rendering**: State indicators, input enablement
- **Command Processing**: Different behavior per sub-state
- **Error Recovery**: Return to last known good state
- **Analytics**: Task timing, state usage patterns

## 🎯 Benefits of XState 5

### 1. Predictable State Behavior
- **Impossible States**: State machine prevents invalid state combinations
- **Clear Transitions**: All state changes are explicit and traceable
- **Type Safety**: Full TypeScript integration with state context

### 2. Debugging and Visualization
- **XState Inspector**: Visual debugging of state transitions
- **State History**: Complete audit trail of state changes
- **Testing**: Easy to test state transitions in isolation

### 3. Framework Integration
- **Neo-blessed**: Direct widget updates on state changes
- **Ink**: React component re-renders with state context
- **Abstraction**: Framework-agnostic state management

### 4. Production Readiness
- **Error Handling**: Robust error recovery with state cleanup
- **Performance**: Minimal overhead with optimized transitions
- **Scalability**: Easy to add new states and transitions

## 🔍 Advanced Features

### State-Dependent Command Behavior

Commands can behave differently based on current state:

```typescript
// State-aware command execution
async execute(command: string, args: string[]): Promise<CommandResult> {
  const currentState = this.stateManager.getCurrentState()
  const currentSubState = this.stateManager.getCurrentSubState()
  
  // Modify behavior based on state
  if (currentSubState === 'planning' && command === 'create') {
    return this.executeWithPlanningContext(command, args)
  } else if (currentSubState === 'editing' && command === 'refactor') {
    return this.executeWithEditingContext(command, args)
  }
  
  return this.executeDefault(command, args)
}
```

### Context-Aware Parsing

The advanced parser can use state context for better classification:

```typescript
async classifyInput(input: string): Promise<AdvancedParseResult> {
  const context = this.stateManager.getStateContext()
  
  // Boost workflow confidence in editing mode
  if (context.currentSubState === 'editing') {
    return this.classifyWithEditingBias(input)
  }
  
  // Boost prompt confidence in generic mode
  if (context.currentSubState === 'generic') {
    return this.classifyWithPromptBias(input)
  }
  
  return this.classifyDefault(input)
}
```

## 🚀 Future Enhancements

### State-Based Personalization
- **Learning**: Track state usage patterns for each user
- **Optimization**: Suggest optimal state for common tasks
- **Automation**: Auto-switch states based on input patterns

### Advanced State Context  
- **Project Context**: Track current project and files
- **Session Memory**: Maintain conversation history per state
- **Task Chaining**: Link related tasks across state transitions

---

The XState 5 implementation provides a robust foundation for complex CLI interactions while maintaining simplicity and performance. The hierarchical state design enables both high-level workflow management and fine-grained UI control, making it ideal for professional development tools.