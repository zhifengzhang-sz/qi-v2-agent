# qi-code - Full Coding Agent

**Status**: 🚧 Under Development (Target: v-0.10.x)  
**Type**: Full coding agent with advanced workflow orchestration and tool ecosystem

## Overview

qi-code is the advanced coding agent in the qi-v2-agent dual-agent architecture. Unlike qi-prompt (simple workflows), qi-code provides complete workflow orchestration with intelligent pattern selection, multi-agent coordination, and comprehensive tool integration via MCP servers.

## Agent Architecture

### **qi-code Capabilities**
- **Complete Workflow Orchestration**: Full pattern library (ReAct, ReWOO, ADaPT) with intelligent selection
- **Advanced Decision Engine**: Planning, reasoning, causal analysis, and hypothesis generation
- **Multi-Agent Coordination**: Distributed task execution and collaborative problem-solving
- **Tool Layer Excellence**: Complete MCP server integration (Chroma, Web, Database, Memory, SQLite)
- **Autonomous Goal Management**: Adaptive planning and goal-oriented behavior
- **Sophisticated Agent Behaviors**: Context-aware decision making and learning integration

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

### **✅ Foundation Complete (v-0.8.x)**
- Enhanced core infrastructure established via qi-prompt development
- Multi-tier memory architecture, context management, model lifecycle
- MCP client integration with 5 service types

### **🚧 In Development (v-0.9.x)**
- Enhanced Workflow System with intelligent pattern selection
- Production-ready workflow execution with monitoring
- Real-time adaptation and learning capabilities

### **📋 Planned (v-0.10.x)**
- Advanced Decision Engine with planning and reasoning
- Multi-Agent Coordination for distributed tasks
- Autonomous Goal Management with adaptive planning
- **qi-code agent integration and deployment**

## Getting Started

### **Prerequisites**
- qi-prompt v-0.8.x complete (enhanced infrastructure)
- Enhanced Workflow System v-0.9.x (intelligent patterns)
- Development environment with MCP server support

### **Development Setup**
```bash
# qi-code will be available after v-0.10.x implementation
# Current development focuses on foundation components

# Monitor development progress
git log --oneline --grep="qi-code"
git log --oneline --grep="v-0.9.x\|v-0.10.x"
```

### **Integration Points**
qi-code builds on qi-prompt foundation:
- **Shared Infrastructure**: State Manager, Context Manager, Model Manager
- **Enhanced Capabilities**: Advanced workflows vs simple workflows
- **MCP Integration**: Full ecosystem vs selective usage
- **Different Interface**: Coding agent vs prompt application

## Next Steps

1. **Complete v-0.9.x Enhanced Workflow System**
2. **Implement v-0.10.x Advanced Agent Capabilities**
3. **Integrate components into qi-code agent**
4. **Deploy and validate qi-code functionality**

---

**Note**: qi-code documentation will be updated as development progresses through v-0.9.x and v-0.10.x milestones.