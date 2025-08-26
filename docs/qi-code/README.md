# qi-code - Full Coding Agent

**Status**: ✅ Implemented (v-0.10.0 Complete)  
**Type**: Full coding agent with QiCodeAgent orchestrator, sub-agent system, and modern CLI

## Overview

qi-code is the advanced coding agent in the qi-v2-agent dual-agent architecture. Unlike qi-prompt (simple workflows), qi-code provides complete workflow orchestration with intelligent pattern selection, multi-agent coordination, and comprehensive tool integration via MCP servers.

## Agent Architecture

### **qi-code Capabilities (Implemented)**
- **QiCodeAgent Orchestrator**: Uses proper factory patterns with `createAgent()` from `@qi/agent`
- **Tool-Specialized Sub-Agents**: FileOps, Search, Git, and Web sub-agents with dynamic registry
- **QiCore Integration**: Result<T> patterns, structured logging, caching, and configuration management
- **MCP Service Integration**: Dynamic service discovery with graceful degradation (chroma, web-search, database, memory, sqlite)
- **Modern Ink CLI**: React-based terminal interface with interactive components and status display
- **Complete Error Handling**: QiCore Result<T> patterns throughout with proper error categorization

### **Design Philosophy**
- **Advanced Patterns**: Uses sophisticated algorithms and "fancy" capabilities
- **Full Orchestration**: Complete workflow management with intelligent adaptation
- **MCP Ecosystem**: Leverages full external service integration
- **Production Ready**: Enterprise-grade features and monitoring

## Development Roadmap

### **Foundation Building**
- **v-0.8.x**: Enhanced Core Infrastructure (qi-prompt milestone) ✅
  - Enhanced State Manager, Context Manager, Model Manager, MCP Client
- **v-0.9.x**: Enhanced Workflow System (qi-code foundation)
  - Intelligent pattern selection and production workflow execution
- **v-0.10.x**: **qi-code MILESTONE** - Advanced Agent Capabilities
  - Complete integration of all capabilities into qi-code agent

### **qi-code vs qi-prompt**

| Aspect | qi-prompt | qi-code |
|--------|-----------|---------|
| **Purpose** | Advanced prompt app | Full coding agent |
| **Workflows** | Simple, well-defined (max 3 ops) | Advanced orchestration with intelligent selection |
| **Complexity** | No fancy stuff, clear patterns | Sophisticated algorithms and advanced capabilities |
| **Tool Integration** | Enhanced modules selectively | Complete MCP ecosystem |
| **Target Users** | Prompt engineering, simple tasks | Complex coding, multi-step projects |
| **Milestone** | v-0.8.x complete | v-0.10.x complete |

## Documentation Structure

### **Design Documents**
- **[Architecture Design](./architecture.md)** - qi-code system architecture and component design
- **[Workflow Design](./workflow-design.md)** - Advanced workflow orchestration patterns
- **[Agent Coordination Design](./agent-coordination.md)** - Multi-agent system design
- **[Tool Integration Design](./tool-integration.md)** - MCP server integration architecture

### **Implementation Guides**
- **[Implementation Overview](./implementation.md)** - Development approach and milestones
- **[Workflow Implementation](./workflow-implementation.md)** - ReAct, ReWOO, ADaPT pattern implementation
- **[Decision Engine Implementation](./decision-engine.md)** - Advanced reasoning and planning
- **[Multi-Agent Implementation](./multi-agent.md)** - Coordination and communication systems

### **API Reference**
- **[Core API](./api-reference.md)** - qi-code main interfaces and contracts
- **[Workflow API](./workflow-api.md)** - Workflow orchestration interfaces
- **[Agent API](./agent-api.md)** - Agent coordination and management interfaces
- **[Tool API](./tool-api.md)** - Tool execution and MCP integration interfaces

## Current Status

### **✅ Complete Implementation (v-0.10.0)**
- **QiCodeAgent Orchestrator**: Fully implemented using proper factory patterns
- **Sub-Agent System**: Tool-specialized agents (FileOps, Search, Git, Web) with registry
- **QiCore Integration**: Complete Result<T> patterns, logger, cache, and config
- **MCP Services**: Dynamic discovery with graceful fallback handling
- **Modern CLI**: Ink-based React interface with interactive status display
- **Error Handling**: Comprehensive QiError categories and Result<T> composition

### **✅ Architecture Alignment**
- Implementation matches documented design patterns
- All imports use `@qi/agent/*` aliasing correctly
- QiCore functional patterns used throughout
- Professional CLI experience with React components

## Getting Started

### **Prerequisites**
- Node.js 18+ with Bun runtime
- qi-v2-agent repository cloned
- Dependencies installed (`bun install`)

### **Running qi-code**
```bash
# Navigate to app directory
cd app

# Run qi-code agent
bun run qi-code

# Run with debug mode
bun run qi-code --debug

# Run with specific provider/model
bun run qi-code --provider openai --model gpt-4
```

### **Features in Action**
- Modern Ink CLI with React components
- QiCodeAgent orchestrator with sub-agent coordination
- Dynamic MCP service discovery and integration
- QiCore Result<T> patterns for reliable error handling
- Structured logging with context accumulation

### **Integration Points**
qi-code builds on qi-prompt foundation:
- **Shared Infrastructure**: State Manager, Context Manager, Model Manager
- **Enhanced Capabilities**: Advanced workflows vs simple workflows
- **MCP Integration**: Full ecosystem vs selective usage
- **Different Interface**: Coding agent vs prompt application

## Implementation Details

### **Key Components**
- **app/src/qi-code.ts**: Main application entry point with complete architecture
- **lib/src/agent/**: QiCodeAgent orchestrator and sub-agent system
- **@qi/base + @qi/core**: Result<T> patterns and infrastructure tools
- **Ink Components**: React-based CLI interface components

### **Architecture Highlights**
- Factory pattern usage: `createAgent()`, `createLogger()`, `createMemoryCache()`
- Sub-agent registry with dynamic registration and lifecycle management
- MCP service integration with graceful degradation strategy
- Comprehensive error handling using QiCore Result<T> composition
- Modern terminal UI using React Ink framework

---

**Status**: qi-code v-0.10.0 implementation complete and functional.