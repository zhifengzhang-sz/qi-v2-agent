# Architecture Design Documentation

This directory contains C4 framework architecture documentation for the qi-v2-agent system, providing multiple levels of architectural detail.

## C4 Framework Overview

The documentation follows the C4 model's hierarchical approach:

1. **[System Context](./system.context.md)** - How qi-v2-agent fits in the larger ecosystem (TODO)
2. **[Container Diagram](./container.diagram.md)** - High-level containers and their interactions  
3. **[Component Diagrams](./component.diagrams.md)** - Internal structure of each container
4. **[Code Diagrams](./code.diagrams.md)** - Implementation-specific details (TODO)

## Quick Navigation

### For Product Owners / Stakeholders
- **[System Context](./system.context.md)** - Understand what the system does and who uses it

### For Architects / Tech Leads  
- **[Container Diagram](./container.diagram.md)** - Understand the major building blocks
- **[Component Diagrams](./component.diagrams.md)** - Understand internal structure

### For Developers
- **[Component Diagrams](./component.diagrams.md)** - Understand component interactions
- **[Code Diagrams](./code.diagrams.md)** - Understand current implementation

## Architecture Summary

### System Purpose
qi-v2-agent is a local AI coding assistant that provides Claude Code-like functionality with local LLM support, enabling natural language file operations, code analysis, and workflow automation.

### Key Architectural Decisions

1. **Two-Container Architecture**
   - **CLI Container**: User interaction and command processing
   - **Smart Router Container**: Natural language processing and tool orchestration

2. **Smart Routing as Core Intelligence**
   - All user input flows through intelligent routing
   - Automatic decision between direct responses and tool usage
   - Context-aware workflow orchestration

3. **Local-First Design**
   - No external data transmission
   - Local LLM execution (Ollama)
   - Local tool execution (MCP servers)

4. **Interface-Based Design** (Proposed)
   - Container interfaces for substitutability
   - Component interfaces for testability  
   - Configuration-driven behavior

## Architecture Principles

### Separation of Concerns
- **CLI Container**: Handles user interaction, not business logic
- **Smart Router Container**: Handles intelligence, not user interface

### Single Responsibility  
- Each component has one clear responsibility
- Interface segregation prevents bloated contracts
- Dependency inversion enables substitutability

### Progressive Enhancement
- Static commands work without smart routing
- Interactive commands enhance with smart routing
- Workflow commands provide maximum automation

### Local Privacy
- All processing happens locally
- No external API dependencies
- User data never leaves the machine

## Current vs. Proposed Architecture

### Current Implementation Gaps
1. **Missing Container Abstractions**: Direct framework coupling
2. **Missing Component Interfaces**: Monolithic implementations  
3. **No Configuration Contracts**: Hard-coded behavior
4. **Inconsistent Error Handling**: No standardized error contracts

### Proposed Improvements
1. **Container Interface Contracts**: Enable container substitution
2. **Component Interface Contracts**: Enable testing and composition
3. **Configuration Schema**: Standardize configuration and validation
4. **Error Handling Standards**: Consistent error reporting and recovery

## Architecture Views

### Logical View
Focus on functionality and interfaces:
- Container responsibilities and contracts
- Component interactions and data flow
- Interface specifications and protocols

### Process View  
Focus on runtime behavior:
- Command execution flows
- Smart routing decision processes
- Error handling and recovery patterns

### Physical View
Focus on deployment and infrastructure:
- Local execution environment
- LLM server integration (Ollama)
- MCP server orchestration

### Development View
Focus on code organization:
- Package structure and dependencies
- Build system and tooling
- Testing strategies and contracts

## Usage Guidelines

### For Architecture Reviews
1. Start with **System Context** to understand scope
2. Review **Container Diagram** for high-level structure
3. Examine **Component Diagrams** for detailed design
4. Check **Code Diagrams** for implementation alignment

### For New Development
1. Understand **Container Contracts** for integration points
2. Review **Component Contracts** for implementation guidance
3. Follow **Interface Design Principles** for new components
4. Implement **Error Handling Standards** consistently

### For Refactoring
1. Compare current implementation with **Proposed Architecture**
2. Identify **Missing Abstractions** to implement
3. Plan **Progressive Migration** strategy
4. Validate against **Architecture Principles**

## Related Documentation

- **[Container Contracts](../containers/)** - Detailed container interface specifications
- **[Component Contracts](../components/)** - Detailed component interface specifications  
- **[Current Implementation](../cli/)** - CLI architecture analysis
- **[Smart Routing](../smart-routing/)** - Smart routing implementation details