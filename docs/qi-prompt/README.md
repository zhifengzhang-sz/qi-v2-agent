# qi-prompt - Advanced Prompt Application

**Status**: ✅ v-0.8.0 Complete (Target: v-0.8.x Enhanced)  
**Type**: Advanced prompt application with context management and simple workflows

## Overview

qi-prompt is the advanced prompt application in the qi-v2-agent dual-agent architecture. It focuses on sophisticated context management with RAG integration while maintaining simple, well-defined workflow patterns. qi-prompt serves as the foundation and milestone for v-0.8.x enhanced core infrastructure.

## Current Status (v-0.8.0)

### **✅ Working Implementation**
- **Portable Binary Compilation**: 8.74MB executable with no dependencies
- **Professional CLI Arguments**: Complete configuration flexibility
- **Simple Workflow System**: Well-defined patterns with bounded complexity
- **Multi-Provider LLM Support**: 5 providers with 25+ models
- **File Reference System**: @file patterns for content inclusion
- **Framework Flexibility**: readline, ink, hybrid UI options

### **🎯 v-0.8.x Enhancement Target**
qi-prompt will be enhanced with upgraded modules while maintaining functionality:
- **Enhanced State Manager**: Multi-tier memory architecture
- **Enhanced Context Manager**: RAG integration via Chroma MCP
- **Model Manager**: Lifecycle management and performance monitoring
- **MCP Client**: External service integration (5 service types)

## Design Philosophy

### **Simple and Clear**
- **Well-Defined Patterns**: Simple workflows with no fancy complexity
- **Bounded Complexity**: Maximum 3 operations per workflow
- **Theoretically Sound**: Clean, straightforward design principles
- **Predictable Performance**: Transparent execution and resource usage

### **Advanced Context Management**
- **Professional Context Optimization**: Intelligent context selection and pruning
- **RAG Integration**: Knowledge retrieval via Chroma MCP server
- **Multi-Tier Memory**: Working, session, and knowledge memory layers
- **Context-Aware Processing**: Dynamic context adaptation based on task requirements

## Agent Architecture

### **qi-prompt Capabilities**
- **Advanced Context Management**: Professional context optimization with RAG integration
- **Simple Workflow Patterns**: FILE_REFERENCE and other well-defined workflows
- **Multi-Provider LLM Support**: Intelligent model selection and fallback
- **File Reference System**: @file pattern processing for content inclusion
- **Professional CLI**: Production-ready binary with flexible configuration

### **qi-prompt vs qi-code Distinction**

| Aspect | qi-prompt | qi-code |
|--------|-----------|---------|
| **Purpose** | Advanced prompt app | Full coding agent |
| **Workflows** | Simple, well-defined (max 3 ops) | Advanced orchestration with intelligent selection |
| **Complexity** | No fancy stuff, clear patterns | Sophisticated algorithms and advanced capabilities |
| **Context Management** | Enhanced with RAG integration | Complete with multi-agent coordination |
| **Target Users** | Prompt engineering, simple tasks | Complex coding, multi-step projects |
| **Milestone** | v-0.8.x complete | v-0.10.x complete |

## Architecture Overview

### **Enhanced Infrastructure (v-0.8.x Target)**

```
┌─────────────────────────────────────────────────────────────┐
│                    qi-prompt Application                     │
├─────────────────────────────────────────────────────────────┤
│  Enhanced Context Manager     │  Simple Workflow Manager    │
├─────────────────────────────────────────────────────────────┤
│  Enhanced State Manager       │  Model Manager              │
├─────────────────────────────────────────────────────────────┤
│  MCP Client (Selective Integration)                         │
├─────────────────────────────────────────────────────────────┤
│  CLI Framework (readline/ink/hybrid)                        │
└─────────────────────────────────────────────────────────────┘
```

### **Core Components**

#### **1. Simple Workflow Manager**
- **FILE_REFERENCE Workflow**: @file pattern processing
- **Bounded Execution**: Maximum 3 operations per workflow
- **Performance Tracking**: Execution statistics and optimization
- **Clear Patterns**: Well-defined, theoretically sound workflows

#### **2. Enhanced Context Manager** *(v-0.8.x)*
- **Context Optimization**: Intelligent context selection and pruning
- **RAG Integration**: Chroma MCP server for knowledge retrieval
- **Multi-Modal Support**: Text, code, and structured data context
- **Dynamic Adaptation**: Context strategy selection based on task

#### **3. Enhanced State Manager** *(v-0.8.x)*
- **Multi-Tier Memory**: Working, session, and knowledge memory
- **State Persistence**: Cross-session state management
- **Conflict Resolution**: Intelligent state synchronization
- **Performance Optimization**: Memory pruning and archival

#### **4. Model Manager** *(v-0.8.x)*
- **Lifecycle Management**: Model loading, switching, and monitoring
- **Performance Tracking**: Response time and quality metrics
- **Resource Optimization**: Dynamic resource allocation
- **Multi-Provider Support**: Seamless provider integration

## Simple Workflow System

### **Design Principles**
- **Simplicity First**: No complex orchestration or fancy algorithms
- **Bounded Complexity**: Clear limits on operations and resources
- **Predictable Behavior**: Transparent execution with known outcomes
- **Easy Understanding**: Clear patterns that users can comprehend

### **Current Workflows**

#### **FILE_REFERENCE Workflow**
```bash
# Simple @file pattern processing
@package.json what dependencies do I have?
@src/index.ts explain this code
@config.yaml @README.md summarize these files
```

**Characteristics**:
- **Bounded**: Maximum 3 file references per request
- **Simple**: Direct content inclusion with no complex processing
- **Fast**: Predictable performance under 2 seconds
- **Clear**: Transparent behavior with obvious outcomes

#### **Future Simple Workflows** *(v-0.8.x)*
- **CONTEXT_OPTIMIZATION**: Intelligent context selection
- **MODEL_SELECTION**: Smart model choosing based on task
- **MEMORY_RECALL**: Simple knowledge retrieval patterns

## Documentation Structure

### **Design Documents**
- **[Architecture Overview](./architecture.md)** - qi-prompt system architecture (needs update)
- **[Simple Workflows](./workflows.md)** - Well-defined workflow patterns
- **[Context Management](./context-management.md)** - Advanced context strategies
- **[Enhancement Strategy](./enhancement-strategy.md)** - v-0.8.x upgrade approach

### **Implementation Guides**
- **[Current Implementation](./current-implementation.md)** - v-0.8.0 working system
- **[Enhancement Implementation](./enhancement-implementation.md)** - v-0.8.x upgrade guide
- **[QiCore Integration](./qicore-integration.md)** - Professional patterns and logging
- **[Message-Driven Architecture](./message-driven-best-practices.md)** - Async coordination

### **User Guides**
- **[User Guide](./user-guide.md)** - Getting started with qi-prompt
- **[CLI Reference](./cli-reference.md)** - Command-line options and usage
- **[Configuration Guide](./configuration.md)** - Setup and customization
- **[Troubleshooting](./troubleshooting.md)** - Common issues and solutions

## Current Implementation (v-0.8.0)

### **Features**
- ✅ **Portable Binary**: 8.74MB executable with professional CLI arguments
- ✅ **File Reference System**: @file patterns for content inclusion
- ✅ **Multi-Provider LLM**: 5 providers with intelligent fallback
- ✅ **Framework Flexibility**: readline/ink/hybrid UI options
- ✅ **Simple Workflows**: FILE_REFERENCE with bounded complexity
- ✅ **Professional CLI**: Complete argument parsing and configuration

### **Usage Examples**
```bash
# Binary usage with full configuration (recommended)
./app/qi-prompt --config-path config/llm-providers.yaml --schema-path config/llm-providers.schema.json --env-path .env

# Framework selection with configuration
./app/qi-prompt --framework hybrid --config-path config/llm-providers.yaml --schema-path config/llm-providers.schema.json --env-path .env

# Development mode
bun run qi-prompt --config-path config/llm-providers.yaml --schema-path config/llm-providers.schema.json --env-path .env --debug

# File reference usage
@package.json what dependencies?
@src/file.ts explain this code
@config/llm-providers.yaml check this configuration
```

## Enhancement Roadmap (v-0.8.x)

### **Enhancement Strategy**
1. **qi-prompt continues working** throughout v-0.8.x development
2. **Individual modules get upgraded** (State Manager, Context Manager, etc.)
3. **qi-prompt incorporates** enhanced module features progressively
4. **End result**: qi-prompt enhanced by all module upgrades
5. **Milestone achieved**: qi-prompt with advanced capabilities

### **Integration Points**
- **Enhanced State Manager**: Multi-tier memory for better context management
- **Enhanced Context Manager**: RAG integration for intelligent context optimization
- **Model Manager**: Lifecycle management for better model utilization
- **MCP Client**: Selective integration with external services

## Getting Started

### **Development Usage**
```bash
bun install
bun --cwd lib build
cd app && bun run qi-prompt
```

### **Production Binary**
```bash
# Compile binary
bun run build

# Run with full configuration
./app/qi-prompt --config-path config/llm-providers.yaml --schema-path config/llm-providers.schema.json --env-path .env
```

### **Key Commands**
```bash
# File Reference Usage
@package.json what dependencies?        # Include file content
@src/file.ts explain this code         # Code analysis
@file1.js @file2.ts compare these      # Multiple files

# System Commands  
/tools                 # List registered tools
/workflows            # Show workflow statistics  
/files               # List session file references
/project            # Show project context
/help               # Show available commands
```

## Success Metrics

### **v-0.8.0 Achievement**
- ✅ First working qi-prompt implementation
- ✅ Portable binary compilation
- ✅ Professional CLI argument handling
- ✅ Simple workflow system operational
- ✅ Multi-provider LLM support working

### **v-0.8.x Target**
- 🎯 Enhanced context management with RAG integration
- 🎯 Multi-tier memory architecture operational
- 🎯 Model lifecycle management integrated
- 🎯 MCP client providing enhanced capabilities
- 🎯 qi-prompt milestone: Advanced prompt app complete

---

**Note**: qi-prompt documentation reflects v-0.8.0 status with v-0.8.x enhancement targets. Updates will reflect actual enhanced capabilities as v-0.8.x development progresses.