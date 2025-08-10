# Qi V2 Agent - Version History

## v-0.5.x - Toolbox Preview (Current)

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

### 🛣️ **Versioning Roadmap**
- **v-0.4.x**: Pure prompt app ✅
- **v-0.5.x**: Current - toolbox preview ← HERE
- **v-0.6.x**: Full toolbox (100+ tools, MCP integration)
- **v-0.7.x**: Advanced workflows
- **v-0.8.x**: Full agent capabilities

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