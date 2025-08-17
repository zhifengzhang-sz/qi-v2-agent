# Qi V2 Agent - Version History

## 🤖 Dual-Agent Architecture

This project develops **two specialized AI agents** with distinct capabilities and milestones:

### **qi-prompt** - Advanced Prompt Application
- **Focus**: Context management and simple workflows
- **Strength**: Professional context optimization with RAG integration  
- **Design Philosophy**: Simple, well-defined patterns (no fancy complexity)
- **Current Status**: v-0.8.0 working implementation ✅
- **Milestone**: v-0.8.x complete (qi-prompt enhanced with upgraded modules)

### **qi-code** - Full Coding Agent  
- **Focus**: Complete workflow orchestration and tool ecosystem
- **Strength**: Advanced agent capabilities with MCP server integration
- **Design Philosophy**: Full pattern library with intelligent selection
- **Current Status**: Under development 🚧
- **Milestone**: v-0.10.x Advanced Agent Capabilities

---

## v0.8.0 - qi-prompt First Working Implementation (COMPLETED)

### 📅 **Release Date**: January 2025

### 🎯 **Overview**
**First working qi-prompt implementation**: Professional binary compilation with simple workflow patterns and foundational infrastructure. This release establishes qi-prompt as a functional prompt application while maintaining design simplicity. Provides the foundation for v-0.8.x module upgrades and eventual qi-code development. The qi-prompt milestone will be achieved at the end of v-0.8.x when all enhanced modules are integrated.

### ✨ **Major Features**

#### 📦 **Portable Binary Compilation**
- **8.74MB Executable**: Complete standalone binary with no runtime dependencies ✅
- **Dynamic Import Solution**: Resolved Ink top-level await bundling issues ✅
- **Bun Compilation**: Optimized --target=node compilation for maximum compatibility ✅
- **Binary Distribution**: Single-file deployment ready for production environments ✅

#### 🔧 **Professional CLI Arguments**
- **--config-path**: LLM providers configuration file path ✅
- **--schema-path**: Configuration schema validation file path ✅ 
- **--env-path**: Environment variables file (.env) path ✅
- **--framework**: UI framework selection (readline|ink|hybrid) ✅
- **--debug**: Debug mode activation ✅
- **Complete Flexibility**: No hardcoded paths anywhere in the system ✅

#### 🏗️ **Configuration Architecture**
- **StateManager Refactor**: Individual file paths instead of directory-based loading ✅
- **Command-Line First**: All configuration paths specified via CLI arguments ✅
- **No Fallbacks**: Eliminated all fallback behavior per project standards ✅
- **Professional Standards**: Enterprise-grade configuration management patterns ✅

#### ⚡ **Technical Solutions**
- **Dynamic Imports**: Converted static imports to async imports for CLI frameworks ✅
- **createCLIAsync**: New async factory pattern for framework initialization ✅
- **Top-Level Await Fix**: Resolved bundling incompatibilities with binary compilation ✅
- **Build System**: Updated build.ts with proper qi-prompt naming ✅

### 🔧 **Implementation Highlights**

#### **Binary Compilation Pipeline**
- Complete resolution of Ink React framework bundling issues
- Professional CLI argument parsing with comprehensive help system
- Dynamic import strategy eliminating static dependency resolution problems
- Portable executable generation suitable for distribution

#### **Configuration Management**
- Eliminated all hardcoded directory paths throughout the codebase
- Command-line argument driven configuration loading
- Professional StateManager.loadLLMConfig signature accepting individual file paths
- Complete removal of fallback configuration patterns

#### **CLI Framework Integration**
- Dynamic import pattern for createInkCLI and createHybridCLI
- Async initialization patterns throughout CLI factory functions
- Proper error handling and Result<T> patterns maintained
- Framework-agnostic binary compilation support

### 📈 **Quality Metrics**
- **Binary Compilation**: ✅ Successful 8.74MB executable generation
- **TypeScript Compilation**: ✅ Zero errors, full type safety maintained
- **Code Quality**: ✅ All linting rules passing, consistent formatting
- **Configuration**: ✅ No hardcoded paths, complete CLI argument support
- **Professional Standards**: ✅ Enterprise-grade CLI patterns implemented

### 🚀 **Production Readiness**
- **Portability**: Single executable file with no external dependencies
- **Configuration**: Professional CLI argument handling for deployment flexibility
- **Standards**: No hardcoded paths, no fallback behavior, clean architecture
- **Distribution**: Ready for binary distribution and deployment pipelines
- **Compatibility**: Works across development and production environments

### 🛡️ **Architecture Improvements**
- **Dynamic Loading**: Runtime framework selection without bundling issues
- **Error Handling**: Comprehensive QiCore Result<T> patterns throughout
- **Type Safety**: Full TypeScript compliance with proper async patterns
- **Professional CLI**: Complete argument parsing with help system and validation

---

## v0.7.0 - Tool Layer Implementation (COMPLETED)

### 📅 **Release Date**: January 2025

### 🎯 **Overview**
Complete implementation of QiCore-integrated tool layer with advanced security framework, concurrent execution, and production-ready system tools. This release transforms the agent into a fully capable tool execution platform with comprehensive security controls and professional-grade architecture.

### ✨ **Major Features**

#### 🔧 **6-Phase Tool Execution Pipeline**
- **Discovery**: Tool resolution with proper error handling ✅
- **Validation**: Schema validation + business logic validation ✅
- **Security**: Permission checks + input sanitization ✅
- **Execution**: Concurrent execution with retry policies ✅
- **Processing**: Result transformation and metadata enhancement ✅
- **Cleanup**: Resource cleanup, metrics collection, and event emission ✅

#### 🔒 **Comprehensive Security Framework**
- **PermissionManager**: Role-based access control (ADMIN, DEVELOPER, OPERATOR, READONLY, GUEST) ✅
- **SecurityGateway**: Multi-layer protection with input/output filtering ✅
- **Rate Limiting**: Configurable per tool category with burst allowances ✅
- **Audit Logging**: Security violation tracking with threat level classification ✅
- **Input Sanitization**: Protection against SQL injection, XSS, path traversal ✅
- **Output Filtering**: Automatic redaction of API keys, JWT tokens, SSH keys ✅

#### 🔍 **Advanced Search Tools**
- **GlobTool**: Fast file pattern matching with performance optimization ✅
- **GrepTool**: Content search with regex support, context lines, file type detection ✅
- **Binary Detection**: Automatic binary file detection and handling ✅
- **Performance**: Optimized for large codebases with smart caching ✅

#### ⚙️ **Production-Ready System Tools**
- **BashTool**: Secure command execution with comprehensive safety features ✅
  - Command allowlist/denylist with security policies
  - Output capture with size limits and truncation protection
  - Background job execution with process tracking
  - Working directory validation and path restrictions
- **ProcessManager**: Advanced process lifecycle management ✅
  - Cross-platform process listing, starting, stopping, monitoring
  - Resource tracking and cleanup capabilities
  - Signal handling with graceful shutdown
  - Process monitoring with CPU/memory tracking

#### ⚡ **Concurrent Execution System**
- **ConcurrentScheduler**: Advanced scheduling with resource quotas ✅
- **Priority Queues**: CRITICAL → HIGH → NORMAL → LOW execution ordering ✅
- **Resource Management**: Memory, CPU, and network quota enforcement ✅
- **Deadlock Prevention**: Resource dependency tracking and cycle detection ✅
- **Background Jobs**: Proper tracking and cleanup of detached processes ✅

### 🏗️ **Technical Architecture**

#### **QiCore Integration**
- Complete Result<T> monad usage throughout all components ✅
- Functional composition patterns with qi/base and qi/core ✅
- Structured error handling with QiError categories ✅
- Professional logging with QiCoreLogger integration ✅

#### **Type Safety & Validation**
- Comprehensive Zod schemas for all tool inputs ✅
- Full TypeScript compliance with strict checking ✅
- Input/output validation at every layer ✅
- Schema-driven API design throughout ✅

#### **Security Architecture**
- Defense-in-depth security approach ✅
- Multiple validation layers (schema, business, security) ✅
- Comprehensive audit trail for compliance ✅
- Configurable security policies per environment ✅

### 📈 **Quality Metrics**
- **TypeScript Compilation**: ✅ Zero errors, full type safety
- **Code Quality**: ✅ All linting rules passing, consistent formatting
- **Testing**: ✅ 80 tests passing, comprehensive test coverage
- **Security**: ✅ Production-ready security controls
- **Performance**: ✅ Optimized concurrent execution with resource management

### 🔧 **Implementation Highlights**

#### **Tool Registry Architecture**
- Interface-driven design with proper separation of concerns
- Hot-swappable tool implementations
- Comprehensive metadata and capability discovery
- Version-aware tool loading and compatibility

#### **Permission System**
- Fine-grained role-based access control
- Dynamic permission evaluation with context awareness
- Path-based restrictions with glob pattern matching
- Audit logging with violation tracking and statistics

#### **Resource Management**
- Memory, CPU, and network quota enforcement
- Background process tracking and cleanup
- Resource leak prevention with automatic cleanup
- Performance monitoring and utilization tracking

### 🚀 **Production Readiness**
- **Security**: Comprehensive security controls suitable for production environments
- **Performance**: Optimized concurrent execution with resource management
- **Reliability**: Comprehensive error handling and recovery mechanisms
- **Monitoring**: Extensive logging, metrics, and audit capabilities
- **Maintainability**: Clean architecture with proper separation of concerns

### 🛡️ **Security Features**
- **Input Validation**: Multi-layer validation against injection attacks
- **Output Filtering**: Automatic sensitive data redaction
- **Access Control**: Role-based permissions with fine-grained controls
- **Audit Logging**: Comprehensive security event tracking
- **Rate Limiting**: Protection against abuse and resource exhaustion
- **Command Sandboxing**: Secure command execution with restricted environments

---

## 🚧 qi-code Development Roadmap

### v0.9.x - Enhanced Workflow System (IN DEVELOPMENT)
**Target**: Foundation for qi-code agent capabilities
- **Intelligent Pattern Selection**: ReAct, ReWOO, ADaPT with automated selection
- **Production Workflow Execution**: Monitoring, optimization, and learning
- **Real-time Adaptation**: Performance-based workflow optimization
- **MCP Integration**: Deep integration with external services

### v0.10.x - qi-code Advanced Agent Capabilities (PLANNED)
**Target**: qi-code milestone - Full coding agent
- **Complete Workflow Orchestration**: Full pattern library with intelligent selection
- **Advanced Decision Engine**: Planning, reasoning, and causal analysis
- **Multi-Agent Coordination**: Distributed task execution and collaboration
- **Tool Layer Excellence**: Complete MCP server integration (Chroma, Web, Database, Memory, SQLite)
- **Autonomous Goal Management**: Adaptive planning and goal-oriented behavior

### v0.11.x - Continuous Learning System (PLANNED)
**Target**: Self-improving agent capabilities
- **Knowledge Evolution**: Automated learning pipelines
- **Self-Optimization**: Continuous performance improvement
- **Memory Consolidation**: Long-term knowledge synthesis
- **Cross-Agent Learning**: Knowledge sharing between qi-prompt and qi-code

### v1.0.x - Production Dual-Agent System (PLANNED)
**Target**: Enterprise-ready deployment
- **qi-prompt**: Mature context management and simple workflows
- **qi-code**: Full agent capabilities with advanced workflows
- **Unified Experience**: Seamless integration between both agents
- **Enterprise Features**: Monitoring, security, and compliance

---

## v-0.6.3 - Complete QiCore Integration (COMPLETED)

### 📅 **Release Date**: 2025-08-13

### 🎯 **Overview**
Complete integration of QiCore patterns throughout the qi-prompt implementation. This release eliminates all console.log and try/catch blocks in favor of professional QiCore logger and Result<T> patterns, adds type-safe configuration with ConfigBuilder, and establishes professional error handling with structured QiError.

### ✨ **Key Changes**

#### 🚀 **QiCore Logger Integration**
- **Structured Logging**: Replaced all console.log/error with @qi/core/logger ✅
- **Contextual Metadata**: All log entries include component, step, and structured data ✅
- **Configurable Levels**: Log level and formatting controlled by configuration ✅
- **Graceful Fallback**: Logger initialization with fallback patterns ✅

#### 🛡️ **Result<T> Pattern Implementation**
- **No try/catch Blocks**: Complete elimination of try/catch in favor of fromAsyncTryCatch ✅
- **Functional Error Handling**: Using match() for Result handling throughout ✅
- **Professional Patterns**: Following QiCore examples for all async operations ✅
- **Chain Operations**: Using flatMap() for operation chaining ✅

#### ⚙️ **ConfigBuilder Integration**
- **YAML Configuration**: config/qi-prompt.yaml with comprehensive settings ✅
- **JSON Schema Validation**: config/qi-prompt.schema.json for type safety ✅
- **Environment Overrides**: QI_PROMPT_* environment variables support ✅
- **ValidatedConfig API**: Type-safe configuration access with defaults ✅

#### 🎯 **Professional Error Handling**
- **Structured QiError**: Using systemError, validationError, businessError ✅
- **Rich Context**: All errors include component, step, and original error details ✅
- **Error Categories**: Proper categorization for retry strategies and handling ✅
- **Error Chaining**: Maintaining error causality through context ✅

#### 📋 **Configuration-Driven Behavior**
- **Message Queue**: TTL, timeouts, and concurrency from configuration ✅
- **UI Settings**: Hotkeys, streaming, colors from configuration ✅
- **Logging**: Level, pretty printing, structured format from configuration ✅
- **Framework**: CLI framework selection with environment overrides ✅

### 🔧 **Technical Improvements**
- **Zero Console Usage**: All output through QiCore logger with structured metadata
- **Zero try/catch Blocks**: All error handling through Result<T> patterns
- **Type-Safe Config**: ValidatedConfig eliminates configuration-related runtime errors
- **Professional Standards**: Following QiCore examples for enterprise-grade code quality

### 📦 **Configuration Schema**
New configuration structure with full validation:
- `app.*` - Application-level settings (name, version, debug, framework)
- `ui.*` - User interface settings (hotkeys, streaming, colors, TTY detection)
- `messaging.*` - Message queue configuration (TTL, timeouts, concurrency)
- `logging.*` - Logging configuration (level, pretty printing, structured format)
- `workflows.*` - Workflow system settings (file reference, project scanner, session manager)

### 🎯 **Quality Assurance**
- **No Anti-Patterns**: Eliminated all console.log and try/catch usage
- **QiCore Compliance**: Following established patterns from qi-v2-qicore examples
- **Professional Standards**: Enterprise-grade error handling and logging
- **Type Safety**: Configuration schema validation prevents runtime errors

---

## v-0.6.2 - Pure Message-Driven Architecture (COMPLETED)

### 📅 **Release Date**: 2025-08-13

### 🎯 **Overview**
Complete elimination of EventEmitter patterns in favor of pure message-driven architecture. This release removes all sync event handling, implements sequential message processing, and fixes state synchronization issues through unified message queue communication.

### ✨ **Key Changes**

#### 🔄 **Architecture Transformation**
- **Pure Message Queue**: Complete removal of EventEmitter inheritance and event listeners ✅
- **Sequential Processing**: All communication flows through QiAsyncMessageQueue ✅
- **State Synchronization**: Single source of truth through message-driven state updates ✅
- **Race Condition Elimination**: Sequential message processing prevents concurrent state conflicts ✅

#### 🏗️ **Component Redesign**
- **HotkeyManager**: Redesigned to send hotkey messages instead of events ✅
- **ReadlineInputManager**: Pure message-driven input handling ✅
- **MessageDrivenCLI**: Complete replacement of EventDrivenCLI ✅
- **InkCLIFramework**: Added resetProcessingState() for proper state management ✅

#### 🧹 **Cleanup & Removal**
- **Deleted Files**: EventDrivenCLI, QiCoreEventManager, CLIAgentEvents ✅
- **Event Imports**: Removed all EventEmitter imports and event handling ✅
- **Dual Architecture**: Eliminated conflicting sync/async patterns ✅
- **Processing State**: Fixed infinite loading through proper state reset ✅

#### 🔧 **Technical Improvements**
- **Message Types**: Comprehensive USER_INPUT, AGENT_OUTPUT, SYSTEM_CONTROL handling ✅
- **Priority Processing**: HIGH priority for hotkeys, NORMAL for user input ✅
- **Error Handling**: Graceful message processing with QiCore Result<T> patterns ✅
- **TypeScript**: Full type safety with proper message queue integration ✅

### 🎯 **Comparison with v-0.5.3**
Unlike v-0.5.3's sync event-driven approach, v-0.6.2 uses pure async message processing:
- **Reliability**: Eliminates race conditions through sequential processing
- **Maintainability**: Loose coupling between components via message queue
- **Scalability**: Better handling of complex operations and streaming
- **Debugging**: Clear message flow and audit trail

---

## v-0.6.1 - Message Queue Implementation (SUPERSEDED)

### 📅 **Release Date**: 2025-08-12
**Note**: This version contained incomplete EventEmitter removal and has been superseded by v-0.6.2.

---

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