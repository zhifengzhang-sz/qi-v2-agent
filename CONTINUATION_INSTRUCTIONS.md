# 🔄 Continuation Instructions for Qi V2 Agent v-0.5.x

## 📋 **Session Context Summary**

You are continuing work on **Qi V2 Agent v-0.5.x Toolbox Preview** - a sophisticated CLI application with file reference workflows and tool registry architecture.

### 🎯 **Current Status**: v-0.5.x Toolbox Preview
- **Version Format**: Always use `v-x.x.x` format (e.g., v-0.5.x, v-0.6.x)
- **Architecture**: Toolbox-based preview of v-0.8.x full agent capabilities  
- **Main File**: Single `app/src/prompt/qi-prompt.ts` (no file proliferation)
- **Approach**: Version control strategy, not separate files

---

## 🏗️ **Architecture Overview**

### **Design Philosophy**
```
v-0.4.x: Pure prompt app ✅
v-0.5.x: Toolbox preview ← CURRENT
v-0.6.x: Full toolbox (100+ tools, MCP)
v-0.7.x: Advanced workflows  
v-0.8.x: Full agent capabilities
```

### **Core Components**
```typescript
// Single consolidated application
app/src/prompt/qi-prompt.ts              # Main CLI app (700+ lines)

// Toolbox library components  
lib/src/tools/files/FileContentResolver.ts          # File loading
lib/src/tools/files/ProjectStructureScanner.ts     # Project discovery
lib/src/tools/parsing/FileReferenceParser.ts       # @file pattern parsing
lib/src/tools/context/SessionManager.ts            # Session persistence
lib/src/tools/ToolRegistry.ts                      # Tool management

// Workflow system
lib/src/workflows/WorkflowManager.ts               # Workflow orchestration
lib/src/workflows/FileReferenceWorkflow.ts        # @file processing
lib/src/workflows/SimpleWorkflow.ts               # Base workflow classes

// Enhanced context & classification
lib/src/context/impl/ToolbasedContextManager.ts    # Tool-driven context
lib/src/classifier/impl/FileReferenceClassifier.ts # @file detection
```

### **Tool Registry Architecture**
- **4 Tools across 3 Categories**:
  - **Files**: FileContentResolver, ProjectStructureScanner
  - **Parsing**: FileReferenceParser  
  - **Context**: SessionManager
- **Composable Design**: Tools can be combined and reused
- **Registry Pattern**: Central registration and discovery

---

## ✨ **Implemented Features**

### 🧰 **Toolbox System**
- ✅ **Tool Registry**: 4 tools registered across 3 categories
- ✅ **Tool Commands**: `/tools` lists registered tools with descriptions
- ✅ **Tool Integration**: All tools properly initialized and available
- ✅ **Tool Statistics**: Runtime stats tracking and reporting

### 📁 **File Reference System** 
- ✅ **Pattern Detection**: FileReferenceClassifier detects `@file.txt` patterns
- ✅ **Workflow Routing**: FILE_REFERENCE workflow triggered for @file inputs
- ⚠️ **Content Inclusion**: Partially working (workflow executes, content inclusion needs debugging)
- ✅ **Multiple Files**: Support for `@file1.ts @file2.js explain both`

### 🔄 **Workflow System**
- ✅ **WorkflowManager**: Tracks execution statistics and performance
- ✅ **FILE_REFERENCE Workflow**: Processes @file + prompt combinations
- ✅ **Classification Integration**: FileReferenceClassifier routes to workflows
- ✅ **Statistics**: `/workflows` command shows execution stats

### 🎨 **CLI Enhancements**
- ✅ **Dual Framework**: Both Ink (rich UI) and readline (basic terminal)
- ✅ **Enhanced Commands**: `/tools`, `/workflows`, `/files`, `/project`
- ✅ **Help System**: Comprehensive help with versioning roadmap
- ✅ **Session Management**: Auto-persistence with `.claude-sessions`
- ✅ **Project Awareness**: Auto-detects project structure and CLAUDE.md

### 🔧 **Event Architecture**
- ✅ **processInput Events**: PromptAppOrchestrator emits processInput events
- ✅ **Event Wiring**: qi-prompt.ts listens for workflow and enhancement events  
- ✅ **Bidirectional Flow**: CLI ↔ Agent ↔ Toolbox event communication

---

## 🐛 **Known Issues**

### **File Reference Workflow Issue**
**Status**: Partially working - classification works, content inclusion needs debugging

**What Works**:
- ✅ FileReferenceClassifier correctly detects `@file.txt` patterns
- ✅ Workflow system triggers FILE_REFERENCE workflow
- ✅ processInput events properly emitted and received
- ✅ Tool registry and file resolution tools available

**What Doesn't Work**:
- ❌ File content not properly included in final prompt sent to LLM
- ❌ User sees generic LLM response instead of file-aware response

**Test Case That Fails**:
```bash
Input: "@app/src/prompt can you review this dir"
Expected: LLM receives enhanced prompt with directory contents
Actual: LLM receives original prompt without file content
```

**Debugging Next Steps**:
1. **Check Content Resolution**: Verify FileContentResolver actually loads file content
2. **Trace Event Flow**: Follow workflowOutput/enhancedPrompt events to final LLM call
3. **Inspect Context Manager**: Ensure ToolbasedContextManager properly enhances prompts
4. **Test Tool Integration**: Verify tools are properly registered and callable

---

## 🚀 **How to Continue**

### **Immediate Priority: Fix File Reference Workflow**

#### **Step 1: Debug File Content Resolution**
```bash
# Test the tool directly
cd /home/zzhang/dev/qi/github/qi-v2-agent
bun -e "
import { FileContentResolver } from './lib/src/tools/files/FileContentResolver.js';
const resolver = new FileContentResolver();
const result = await resolver.execute('app/src/prompt/qi-prompt.ts');
console.log('File resolved:', result.exists, result.content?.length);
"
```

#### **Step 2: Test Workflow Execution**
```bash
# Test classifier and workflow chain
bun -e "
import { FileReferenceClassifier } from './lib/src/classifier/impl/FileReferenceClassifier.js';
const classifier = new FileReferenceClassifier();
const result = await classifier.classify('@app/src/prompt explain this');
console.log('Classification:', result.type, result.extractedData);
"
```

#### **Step 3: Trace Event Flow**
Add debug logging to trace events:
```typescript
// In qi-prompt.ts, add logging to workflow event handlers
this.orchestrator.on('workflowOutput', (event) => {
  console.log('🎉 WORKFLOW DEBUG:', {
    original: event.original,
    enhanced: event.enhanced.substring(0, 100),
    workflow: event.workflow
  });
});
```

### **Testing the Application**
```bash
# Start the application
cd /home/zzhang/dev/qi/github/qi-v2-agent
bun app/src/prompt/qi-prompt.ts --framework readline --debug

# Test file reference
> @VERSION.md summarize this file

# Check toolbox status  
> /tools
> /workflows
> /project
```

---

## 📚 **Key Files to Understand**

### **Primary Application**
- `app/src/prompt/qi-prompt.ts` - Main CLI app with toolbox integration

### **Critical Workflow Files**
- `lib/src/workflows/WorkflowManager.ts` - Orchestrates workflow execution
- `lib/src/workflows/FileReferenceWorkflow.ts` - Handles @file patterns  
- `lib/src/classifier/impl/FileReferenceClassifier.ts` - Detects file references

### **Context & Tool Integration**
- `lib/src/context/impl/ToolbasedContextManager.ts` - Enhanced context management
- `lib/src/tools/files/FileContentResolver.ts` - Loads file content
- `lib/src/agent/PromptAppOrchestrator.ts` - Event orchestration (recently modified)

### **Configuration**
- `VERSION.md` - Version history and current status
- `config/llm-providers.yaml` - LLM configuration
- `.claude-sessions/` - Session persistence storage

---

## 🎯 **Next Development Phases**

### **v-0.5.x Completion** (Current Priority)
- 🔧 **Debug file reference workflow**: Fix content inclusion in prompts
- 🧪 **Add workflow tests**: Comprehensive testing of @file patterns
- 📝 **Improve error handling**: Better error messages for file resolution failures
- 🔍 **Performance optimization**: Large file handling and caching

### **v-0.6.x Planning** (Future)
- 📦 **MCP Integration**: Model Context Protocol server support
- 🛠️ **100+ Tools**: Expand tool registry with comprehensive tool ecosystem
- 🔗 **Tool Chaining**: Complex tool composition and dependencies
- 🎨 **Plugin Architecture**: Custom tool development framework

### **Development Guidelines**
- **Always use v-x.x.x version format**
- **Single file approach**: Enhance qi-prompt.ts, don't create new files
- **Tool-first**: All new functionality should be tool-based
- **Event-driven**: Use events for component communication
- **Test thoroughly**: File references are the core v-0.5.x feature

---

## 🔍 **Debugging Commands**

```bash
# Check current git status
git status

# Run with full debug output  
bun app/src/prompt/qi-prompt.ts --debug --framework readline

# Test file reference patterns
echo "@package.json explain dependencies" | bun app/src/prompt/qi-prompt.ts --framework readline

# Check tool registry
bun -e "
import { ToolRegistry } from './lib/src/tools/ToolRegistry.js';
const registry = new ToolRegistry();
console.log('Registry methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(registry)));
"

# Verify file resolution  
ls -la app/src/prompt/
ls -la lib/src/tools/files/
```

**Remember**: You are working on a sophisticated toolbox architecture that's a preview of full agent capabilities. The core feature (file references with @patterns) is 90% implemented - just needs the final content inclusion debugging.