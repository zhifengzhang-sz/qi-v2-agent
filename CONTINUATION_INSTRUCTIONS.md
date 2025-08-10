# 🚨 CRITICAL: Major Architecture Cleanup Required

## 📋 **Session Context Summary**

**URGENT**: The v-0.5.x implementation became a **major architectural mess** that needs complete refactoring before proceeding.

### 🎯 **Current Status**: BROKEN ARCHITECTURE (v-0.5.x)
- **Version Format**: Always use `v-x.x.x` format (e.g., v-0.5.x, v-0.6.x)
- **MAJOR PROBLEM**: Toolbox leaked across all layers violating separation of concerns
- **Files Changed**: 101 files (should have been ~20 files)
- **Design Issue**: Tools directly imported at app layer instead of contained in workflows

---

## 🚨 **ARCHITECTURAL DISASTER ANALYSIS**

### 🔴 **What Went Wrong**
The toolbox implementation violated **fundamental separation of concerns**:

```typescript
// ❌ WRONG: qi-prompt.ts directly managing tools (current broken state)
import { ToolRegistry, FileContentResolver, ProjectStructureScanner } from 'tools';
this.toolRegistry = new ToolRegistry();
this.toolRegistry.register(fileResolver, {...});
this.contextManager = new ToolbasedContextManager(appContext, this.toolRegistry);

// ❌ Result: 101 files changed, tools leaked across all layers
```

### ✅ **How It Should Be**
Tools should be **hidden inside workflows only**:

```typescript
// ✅ CORRECT: Clean separation (target architecture)
import { WorkflowManager } from 'workflows';
this.workflowManager = new WorkflowManager(); // Tools hidden inside
this.contextManager = new ContextManager(appContext); // No tool dependency

// ✅ Result: ~20 files changed, clean layer boundaries
```

### 🏗️ **Correct Architecture Layers**
```
App Layer (qi-prompt.ts)
├── Should only import: WorkflowManager, ContextManager, Classifier
└── WorkflowManager (lib/src/workflows/)
    ├── Internally manages: ToolRegistry
    ├── Internal tools: FileContentResolver, ProjectStructureScanner, etc.
    └── Provides: clean workflow API to app layer
```

### 🚫 **Current Broken Architecture**
```
App Layer (qi-prompt.ts) 
├── ❌ Directly imports: ToolRegistry, FileContentResolver, etc.
├── ❌ Creates: ToolbasedContextManager  
├── ❌ Manages: tool lifecycle
└── ❌ Result: Cross-cutting toolbox concerns everywhere
```

---

## 🔧 **MANDATORY REFACTORING REQUIRED**

### 🎯 **Phase 1: Architectural Cleanup (URGENT)**
Before any new features, the architecture must be fixed:

#### **Step 1: Revert ToolbasedContextManager**
```bash
# Remove the tool-aware context manager
rm lib/src/context/impl/ToolbasedContextManager.ts
# Revert to standard ContextManager in qi-prompt.ts
```

#### **Step 2: Move Tools Inside WorkflowManager** 
```typescript
// In WorkflowManager.ts - make tools internal
class WorkflowManager {
  private toolRegistry: ToolRegistry;  // Move here
  private fileResolver: FileContentResolver;  // Move here
  
  constructor() {
    this.initializeInternalTools();  // Hide tool setup
  }
  
  // Public API - no tool exposure
  async executeWorkflow(input: WorkflowInput): Promise<WorkflowResult>
  getStats(): WorkflowStats
  // Remove: getToolRegistry(), listTools(), etc.
}
```

#### **Step 3: Clean qi-prompt.ts**
```typescript
// Remove all tool imports
// Remove: ToolRegistry, FileContentResolver, etc.
// Remove: ToolbasedContextManager
// Keep only: WorkflowManager import

// Clean constructor
constructor() {
  this.workflowManager = new WorkflowManager(); // Tools hidden
  this.contextManager = new ContextManager(appContext); // Standard
  // Remove: tool registry setup, tool registration
}
```

#### **Step 4: Route Commands Through WorkflowManager**
```typescript
// /tools command should call workflowManager.getToolInfo()
// /workflows already routes correctly  
// Remove: direct tool registry access
```

### 📊 **Expected Cleanup Results**
- **Files Reverted**: ~80 files (only workflow files should change)
- **Clean Boundaries**: App → Workflow → Tools (proper layering)
- **Testability**: Each layer independently testable
- **Maintainability**: Changes to tools don't affect app layer

---

## ⚠️ **What Currently "Works" (But Badly Architected)**

**Note**: These features work but are implemented with terrible architecture that must be fixed:

### 🧰 **Toolbox System**
- ✅ **Tool Registry**: 4 tools registered (but exposed at wrong layer)
- ✅ **Tool Commands**: `/tools` lists tools (but directly accesses registry)
- ✅ **Tool Integration**: All tools properly initialized and available
- ✅ **Tool Statistics**: Runtime stats tracking and reporting

### 📁 **File Reference System** 
- ❌ **BROKEN**: FileReferenceClassifier wrongly created as separate component
- ⚠️ **Content Inclusion**: Doesn't work due to architectural mess
- ❌ **Multiple Files**: Implemented but through wrong abstraction layers

### 🔄 **Workflow System**
- ⚠️ **WorkflowManager**: Works but tools leaked outside its boundaries
- ⚠️ **FILE_REFERENCE Workflow**: Functional but depends on external tool registry
- ❌ **Clean API**: Exposes internal tool details to app layer

---

## 🎯 **REFACTORING PRIORITY ORDER**

### 🚨 **Phase 1: Emergency Architecture Fix (MANDATORY)**
**Do this FIRST before any feature work:**

1. **Remove ToolbasedContextManager** - revert to standard ContextManager
2. **Move all tools inside WorkflowManager** - hide them completely
3. **Clean qi-prompt.ts** - remove all tool imports and direct tool access
4. **Fix /tools command** - route through WorkflowManager API
5. **Remove FileReferenceClassifier** - move logic into WorkflowManager

**Goal**: Reduce to ~20 file changes, proper layer separation

### 🔧 **Phase 2: Fix File References (After Architecture Fixed)**
**Only after Phase 1 is complete:**

1. **Debug content inclusion** in FileReferenceWorkflow
2. **Test @file patterns** through clean WorkflowManager API
3. **Add proper error handling** for file resolution failures

### ⚠️ **Phase 3: Future Features (Much Later)**
**Don't even think about this until Phases 1-2 are done:**
- v-0.6.x planning
- MCP integration  
- Additional tools

---

## 💡 **Key Lesson Learned**

**The high file count (101 files) was a RED FLAG** indicating architectural violations:
- Tools should be **internal** to workflows
- App layer should have **minimal imports**
- Cross-cutting concerns are usually **design smells**

**Never again**: When adding a new concern, keep it contained within its responsible layer.

---

## 🔍 **Current State Assessment**

```bash
# The codebase is currently in a BROKEN architectural state
# Feature: File references work partially
# Architecture: Completely violated separation of concerns  
# Priority: Fix architecture first, features second
# Risk: Without fix, every new feature will make it worse
```

**Bottom Line**: Stop all feature development. Fix the architecture mess first. Then continue with clean, maintainable development.