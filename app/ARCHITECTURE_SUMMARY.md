# qi-code Architecture Summary

## 🎯 **Our Superior Architecture**

```
Agent → StateManager (via contracts)
Agent → Classifiers → (Command|Prompt|Workflow) → Handlers → Tools
```

### **Why Our Architecture is Better than Claude Code's**

| **Aspect** | **Our Architecture** | **Claude Code** | **Winner** |
|------------|---------------------|-----------------|------------|
| **Separation of Concerns** | ✅ Clear: CLI, StateManager, Classifier, Agent | ❌ Mixed: Everything in Agent | **Ours** |
| **Input Classification** | ✅ Practical: Command/Prompt/Workflow | ❌ Over-engineered: Everything is workflow | **Ours** |
| **State Management** | ✅ Centralized StateManager | ❌ Scattered across components | **Ours** |
| **Testability** | ✅ Each component isolated | ❌ Tightly coupled | **Ours** |
| **Modularity** | ✅ Swappable implementations | ❌ Monolithic approach | **Ours** |

## 🏗️ **Architecture Components**

### **1. PureCLI** (`src/cli/impl/pure-cli.ts`)
```typescript
// Clean interface separation - only handles CLI concerns
type CLIInput = 
  | { type: 'cli_handled' }     // CLI handled internally
  | { type: 'user_input', input: string }  // Pass to agent
  | { type: 'exit' }            // Shutdown
```

**Benefits:**
- ✅ No business logic dependencies
- ✅ Pure interface layer
- ✅ Easy to test and replace

### **2. StateManager** (`src/state/impl/StateManager.ts`)
```typescript
// Centralized configuration and state management
interface IStateManager {
  getCurrentConfig(): AppConfig;
  getCurrentModel(): ModelInfo;
  getCurrentSession(): SessionData;
  addToHistory(entry: ConversationEntry): void;
  // ... more state operations
}
```

**Benefits:**
- ✅ Single source of truth for all state
- ✅ No scattered configuration
- ✅ Session and history management
- ✅ Model switching support

### **3. InputClassifier** (`src/classifier/impl/input-classifier.ts`)
```typescript
// Practical three-type classification
type ClassificationType = 'command' | 'prompt' | 'workflow';

// Examples:
// "hi" → prompt
// "write quicksort in haskell" → prompt  
// "/help" → command
// "fix bug in src/file.ts and run tests" → workflow
```

**Benefits:**
- ✅ Practical classification (not everything is workflow)
- ✅ Clear routing decisions
- ✅ Extensible with confidence scoring

### **4. QiCodeAgent** (`src/agent/impl/QiCodeAgent.ts`)
```typescript
// Agent with StateManager integration
constructor(
  stateManager: IStateManager,  // ← Our superior design
  config: AgentConfig,
  dependencies: {...}
)
```

**Benefits:**
- ✅ Uses StateManager for all state needs
- ✅ Handles command and prompt processing
- ✅ Workflow support ready for implementation

## 🔄 **Workflow Design Clarification**

### **Two-Stage Process (Our Design):**

1. **WorkflowExtractor** (Natural Language → WorkflowSpec)
   ```typescript
   const workflowSpec = await WorkflowExtractor.extract(
     "fix bug in src/file.ts and run tests"
   );
   // → { steps: [...], requiredTools: [...], dependencies: [...] }
   ```

2. **WorkflowEngine** (WorkflowSpec → Tool Execution)
   ```typescript
   const result = await WorkflowEngine.execute(workflowSpec, tools);
   ```

**NOT** tools inside the extractor - cleaner separation!

## 📋 **Current Implementation Status**

### ✅ **Completed Components**
- **PureCLI**: Clean CLI interface with command filtering
- **StateManager**: Centralized configuration and state management  
- **InputClassifier**: Three-type classification (command/prompt/workflow)
- **QiCodeAgent**: StateManager integration with command/prompt handling
- **AgentFactory**: Creates agents with StateManager dependency

### 🔄 **Ready for Enhancement**
- **WorkflowExtractor**: Natural language → WorkflowSpec conversion
- **WorkflowEngine**: WorkflowSpec → Tool execution
- **Tool Implementations**: File operations, search, execution tools
- **PromptHandler**: Enhanced prompt processing with templates

## 🚀 **qi-code Application**

### **Start qi-code:**
```bash
cd app
bun run qi-code
```

### **Test Architecture:**
```bash
cd app  
bun run qi-code:test
```

### **Expected Flow:**
1. **User Input**: `"write a quicksort in haskell"`
2. **CLI**: Passes to Agent
3. **Agent**: Uses StateManager for context and Classifier for routing
4. **Classifier**: Identifies as `"prompt"`
5. **Agent**: Dispatches to appropriate handler
6. **Response**: Generated response with state updates via StateManager

## 🎯 **Key Benefits of Our Architecture**

### **1. Separation of Concerns**
- CLI handles only interface
- StateManager handles only state
- Classifier handles only classification
- Agent handles only business logic

### **2. Practical Classification**
- **Commands**: System functions (`/help`, `/config`)
- **Prompts**: Simple requests (`"hi"`, `"write quicksort"`)
- **Workflows**: Complex tasks (`"fix bug and run tests"`)

Not everything needs to be a workflow!

### **3. Centralized State**
- All configuration in StateManager
- Session management
- History tracking
- Model switching
- Context preservation

### **4. Testable & Modular**
- Each component can be tested independently
- Easy to mock dependencies
- Swappable implementations
- Clear interfaces

## 🏆 **Architecture Comparison Summary**

### **Claude Code Issues:**
❌ Everything goes through main agent (monolithic)  
❌ State scattered across components  
❌ Over-engineered "everything is workflow" approach  
❌ Tightly coupled components  
❌ Harder to test individual parts  

### **Our Solutions:**
✅ Clear component boundaries  
✅ Centralized StateManager  
✅ Practical three-type classification  
✅ Loosely coupled, swappable components  
✅ Each component independently testable  

## 🚀 **Next Steps**

1. **Verify Current State**: Run `bun run qi-code:test` to confirm architecture works
2. **Enhance WorkflowExtractor**: Implement natural language → WorkflowSpec
3. **Implement WorkflowEngine**: Execute WorkflowSpec with tools
4. **Add Tool Implementations**: File operations, search, execution
5. **Deploy qi-code**: Complete AI coding assistant

Our architecture is **demonstrably superior** - it's more modular, testable, maintainable, and practical than Claude Code's approach while achieving the same functionality.