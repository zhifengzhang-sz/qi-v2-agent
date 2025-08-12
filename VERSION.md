# Qi V2 Agent - Version History

## v-0.6.0 - Message Queue Structure (COMPLETED)

### 📅 **Release Date**: 2025-08-12  

### 🎯 **Overview**
Complete implementation of h2A-inspired async message queue system based on Claude Code analysis. This release adds non-blocking message processing, type-safe message creation, and provides the async foundation for future agent capabilities.

### ✨ **New Features** ✅

#### 🔄 **Async Message Queue System**
- **QiAsyncMessageQueue**: h2A-pattern AsyncIterable with non-blocking operations ✅
- **Promise-based Flow Control**: readResolve/readReject callbacks for async coordination ✅
- **Real-time Message Injection**: Add messages during active iteration ✅
- **State Management**: Complete lifecycle with started/done/error flags ✅
- **QiCore Integration**: Full Result<T> patterns throughout async operations ✅

#### 📨 **Type-Safe Message System**
- **QiMessageFactory**: Type-safe message creation with validation ✅
- **15+ Message Types**: Command, UserInput, AgentOutput, SystemControl, Streaming, etc. ✅
- **Priority Processing**: CRITICAL → HIGH → NORMAL → LOW automatic ordering ✅
- **Request-Response Correlation**: Built-in correlation ID and parent ID support ✅
- **Message Validation**: Comprehensive validation with detailed error context ✅

#### ⚡ **Advanced Queue Features**
- **Priority Queuing**: Automatic priority-based message ordering ✅
- **Message TTL**: Automatic expiration and cleanup of old messages ✅
- **Statistics & Monitoring**: Performance metrics and queue health tracking ✅
- **Pause/Resume Control**: Dynamic processing control ✅
- **Resource Management**: Proper cleanup and memory management ✅

#### 🧪 **Testing & Documentation**
- **Comprehensive Tests**: 42/42 tests passing with proper QiCore patterns ✅
- **Complete Documentation**: User guide, API reference, migration guide ✅
- **QiCore Best Practices**: Functional composition with match() patterns ✅
- **Type Safety**: Full TypeScript coverage with generic support ✅

### 🏗️ **Architecture Foundation**
This version establishes the async messaging foundation required for:
- **v-0.7.x**: Concurrent tool execution with proper coordination
- **v-0.8.x**: Complex workflow orchestration with SubAgent support
- **v-0.9.x**: Full agent loop implementation with real-time steering

---

## v-0.5.3 - Command Navigation Enhancement

### 📅 **Release Date**: 2025-08-11

### 🎯 **Overview**
Enhanced Hybrid CLI Framework with complete command navigation system. This release adds command suggestion navigation with arrow keys and Tab completion, plus comprehensive QiCore integration for professional error handling and logging.

### ✨ **New Features**

#### 🎯 **Command Navigation System**
- **Command Suggestions**: Type `/` to see all available commands including the previously missing `/tokens` command
- **Arrow Key Navigation**: Use ↑/↓ arrows to navigate through command suggestions when visible
- **Smart Routing**: Arrow keys prioritize command suggestions over cursor/history when suggestions are active
- **Tab Completion**: Press Tab to accept the currently highlighted command suggestion  
- **Seamless Integration**: Works in both regular and hybrid modes with proper fallback behavior

#### 🏗️ **QiCore Integration**
- **Functional Error Handling**: Complete elimination of try/catch blocks in favor of Result<T> patterns
- **Structured Logging**: Professional logging with createLogger() and match() patterns
- **Configuration Management**: Environment variable overrides with HYBRID_* prefix
- **Graceful Degradation**: No console.log usage, proper failure handling throughout

#### 🔧 **Enhanced Components**
- **useHybridTextInput**: Added Tab key handling for command suggestion acceptance
- **InputBox Component**: Enhanced command suggestion callbacks for hybrid mode compatibility  
- **Command Suggestions**: Complete COMMAND_SUGGESTIONS array with all CLI commands
- **Smart Navigation Logic**: Intelligent routing between command suggestions and cursor navigation

### 📚 **Documentation Updates**
- **QiCore Integration Guide**: Comprehensive documentation of functional programming patterns
- **Command Navigation**: Updated hybrid framework docs with navigation features
- **Configuration Patterns**: Environment variable override documentation
- **Error Handling**: Examples of Result<T> and match() usage throughout

### 🎯 **Architecture Achievement**
This release demonstrates the successful integration of QiCore's functional programming principles with sophisticated UI navigation, creating a professional CLI framework that eliminates imperative error handling while providing Claude Code-level user experience.

---

## v-0.5.2 - Hybrid CLI Framework

### 📅 **Release Date**: 2025-08-11

### 🎯 **Overview**
Major addition of Hybrid CLI Framework with Claude Code-style navigation parity. This release demonstrates systematic design analysis and implementation methodology, achieving sophisticated terminal input behavior.

### ✨ **New Features**

#### 🖥️ **Hybrid CLI Framework**
- **Claude Code Navigation**: Exact dual-purpose arrow key behavior (cursor-first, history-fallback)
- **Sophisticated Input**: Multiline text editing with proper cursor movement
- **Immutable Operations**: Functional cursor operations with boundary detection
- **Clean Architecture**: Separated input handling and history management hooks
- **React Integration**: Seamless integration with Ink for rendering

#### 🛠️ **Core Components**
- **HybridCLIFramework**: Event-driven framework class
- **useHybridTextInput**: Input handling following Claude Code patterns
- **useHybridHistory**: Dedicated history navigation management  
- **Cursor & MeasuredText**: Advanced cursor navigation utilities
- **HybridTextInput**: React component with proper state management

#### 🐛 **Critical Bug Fixes**
- **Cursor Boundary Detection**: Fixed `down()` method to move to end position
- **State Management**: Removed stale closures from useCallback
- **Navigation Logic**: Corrected dual-purpose arrow key implementation

#### 📚 **Systematic Documentation**
- **Design Analysis**: Comprehensive comparison with Claude Code implementation
- **Implementation Guide**: Step-by-step systematic approach vs trial-and-error
- **Navigation Correction**: Detailed dual-purpose arrow key behavior analysis
- **Architecture Diagrams**: Complete technical documentation

#### 🧹 **Codebase Improvements**
- **Debug Controls**: Debug messages only show with --debug flag
- **Documentation Organization**: Proper structure matching code organization
- **File Cleanup**: Removed temporary files and organized test locations
- **Code Quality**: All TypeScript and linting checks pass

### 💡 **Key Achievement: Systematic Design Methodology**
This release showcases moving from "guessing and trying" to systematic analysis of proven patterns, resulting in accurate implementation of complex navigation behavior.

---

## v-0.5.1 - Toolbox Preview

### 📅 **Release Date**: 2025-01-10

### 🎯 **Overview**
Preview implementation of v-0.8.x agent functionality with toolbox architecture. This version serves as a stepping stone to full agent capabilities while providing useful file reference and workflow features.

### ✨ **New Features**

#### 🧰 **Toolbox Architecture**
- **Tool Registry**: Composable tool system with 4 tools across 3 categories
- **File Tools**: FileContentResolver, ProjectStructureScanner  
- **Parsing Tools**: FileReferenceParser for @file pattern detection
- **Context Tools**: SessionManager for conversation persistence
- **Tool Management**: `/tools` command to list registered tools

#### 📁 **File Reference System**
- **@file Patterns**: Use `@path/to/file.txt` to include file content in prompts
- **Multiple Files**: Support for `@file1.js @file2.ts explain both files`  
- **Content Inclusion**: Automatic file content loading and prompt enhancement
- **FileReferenceClassifier**: Intelligent detection of file reference patterns

#### 🔄 **Simple Workflow System**
- **FILE_REFERENCE Workflow**: Processes @file + prompt patterns
- **Workflow Manager**: Tracks execution statistics and performance
- **Classification Routing**: Automatic routing between prompts and workflows
- **Workflow Commands**: `/workflows` to show execution stats

#### 🏗️ **Architecture Improvements**
- **Single File Strategy**: Consolidated qi-prompt.ts (no file proliferation)
- **Version Control Approach**: Use git versioning instead of separate files
- **Event-Driven Design**: Enhanced PromptAppOrchestrator with processInput events
- **Context Management**: ToolbasedContextManager replacing basic implementation

### 🔧 **Known Issues**
- **File Workflow**: File reference workflow partially functional (needs debugging)
- **Event Flow**: processInput events working, content inclusion needs fixes

### 📋 **Key Commands**
```bash
# Toolbox Commands (v-0.5.x)
/tools                  # List registered tools
/workflows              # Show workflow statistics  
/files                  # List session file references
/project                # Show project context

# File Reference Usage
@package.json what dependencies?
@src/file.ts explain this code
```

### 🛣️ **Versioning Roadmap** (Updated 2025-08-11)

**Progressive Architecture Build-up Approach:**

- **v-0.4.x**: Pure prompt app ✅
- **v-0.5.x**: Hybrid CLI framework ✅
- **v-0.6.x**: Message Queue Structure (current) ← HERE
  - h2A-inspired async messaging foundation
  - Real-time steering with stdin monitoring
  - Enhanced QiCoreEventManager with stream processing
  - AbortController integration for graceful interruption
- **v-0.7.x**: Tools System
  - 6-stage tool execution pipeline (MH1 pattern)
  - Concurrent execution control (max 10 parallel, UH1 pattern)
  - MCP integration + 100+ tools ecosystem
  - 6-layer permission validation gateway
- **v-0.8.x**: Workflow System
  - Intelligent workflow extraction from text input
  - SubAgent creation with isolated execution (I2A pattern)
  - Multi-agent orchestration and result synthesis (KN5 pattern)
  - Context compression algorithm (92% threshold)
- **v-0.9.x**: qi-code Agent
  - Complete coder agent with Claude Code feature parity
  - Full agent orchestration (nO-style agent loop)
  - Project-wide context management and adaptive learning
  - Integration with qi-prompt for unified experience

---

## v0.3.2 - Classifier Performance Study Framework

**Release Date**: August 3, 2025

### Features
- **Simple Study Framework**: Clean FP-style classification testing (`app/src/study/classification.ts`)
- **7 Classification Methods**: rule-based, llm-direct, langchain-structured, and 4 langchain variants
- **Performance Analysis**: Real-time accuracy, confidence, and latency measurement
- **Clean Architecture**: Interface layer (InputClassifier) with proper QiCore internal patterns

### Performance Findings
- **rule-based**: 100% command detection, 50% workflow detection, 0ms latency
- **llm-direct**: Universal model compatibility, ~50ms latency
- **langchain-structured**: Function calling models, ~50ms latency
- **4 langchain variants**: Implementation/configuration issues identified

### Study Framework
- Replaced overcomplicated comprehensive study with 100-line functional approach
- Two functions + one FP pipeline statement
- Clear tabular output with method summaries

---

## v0.3.1 - Study Directory Cleanup & QiCore Compliance

**Release Date**: August 2, 2025

- Fixed aliasing violations in study framework
- QiCore Result<T> patterns in rule-based classifier
- Proper interface/internal layer separation
- Exception boundaries with fromAsyncTryCatch()

---

## v0.3.0 - CLI + Agent with Command, Prompt & Context Continuation

**Release Date**: July 31, 2025

- Three-type input classification (command/prompt/workflow)
- Context continuation system with LangChain templates
- Multi-provider LLM support via multi-llm-ts
- Local-first privacy with Ollama integration

---

## Earlier Versions

See git history for versions 0.1.x through 0.2.x focusing on:
- Initial project setup and architecture design
- Component interface definitions  
- Technology evaluation and proof-of-concepts
- Foundation layer implementation