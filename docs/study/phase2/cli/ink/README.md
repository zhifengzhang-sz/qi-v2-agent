# Ink + React CLI Implementation

## Overview

This directory contains the Ink + React implementation approach for the qi-v2 agent terminal UI. This approach uses React components and patterns familiar to web developers, adapted for terminal interfaces.

## 🚨 Critical Issue Warning

**IMPORTANT**: The current Ink + React implementation has a **critical architectural flaw** in the workflow tools that must be addressed before any development:

- **Issue**: Workflow tools create infinite recursion loops instead of executing file operations
- **Impact**: File operations (create, edit, analyze) are **completely non-functional**
- **Status**: Complete fix available in [unified-chat-fixed-impl-guide.md](unified-chat-fixed-impl-guide.md)

**YOU MUST READ AND IMPLEMENT THE FIXES** in the fixed implementation guide before proceeding with any development.

## Implementation Files

### 1. Core Implementation Guides

#### [unified-chat-fixed-impl-guide.md](unified-chat-fixed-impl-guide.md) ⭐ **START HERE**
**The most critical document** - Contains complete architectural fixes for the broken workflow tools system.

**What it covers:**
- Complete analysis of the infinite recursion bug
- Detailed fix implementation for all workflow tools
- Step-by-step migration guide
- Testing and validation procedures

**Why it's critical:**
- File operations are 0% functional without these fixes
- All other optimization work is meaningless until core functionality works
- Contains the only viable solution to the architectural problems

#### [unified-chat-impl-guide.md](unified-chat-impl-guide.md)
Original implementation guide with comprehensive architecture documentation.

**What it covers:**
- Complete system architecture
- Component integration patterns
- Performance optimization strategies
- Advanced features implementation

**Note**: Contains the original broken patterns - refer to fixed guide for corrections.

#### [workflow-impl-guide.md](workflow-impl-guide.md)
Detailed workflow implementation patterns and tool integration.

**What it covers:**
- Workflow tool architecture
- MCP integration patterns
- LangGraph orchestration
- Error handling strategies

### 2. Architecture Documentation

#### [T6-terminal-ui.md](T6-terminal-ui.md)
Ink-specific terminal UI architecture decisions and patterns.

**What it covers:**
- Component hierarchy strategies
- State management patterns
- Responsive terminal design
- Performance considerations

## Technology Stack

### Core Dependencies
```json
{
  "dependencies": {
    "ink": "^6.0.1",
    "@inkjs/ui": "^2.0.0", 
    "react": "^18.2.0"
  }
}
```

### Architecture Pattern
```
User Input → useInput Hook → React useState → useEffect Chains → Ink Virtual DOM → Terminal
```

## Current Status

### ✅ Working Components
- CLI infrastructure and command parsing
- Basic chat functionality (without file operations)
- Terminal UI rendering and input handling
- Token streaming with batching optimizations
- Slash command system

### ❌ Broken Components (Critical)
- **Workflow tools**: Create infinite recursion instead of file operations
- **File operations**: write_file, read_file, analyze_code completely non-functional
- **MCP integration**: Available but never called by broken workflow tools

## Performance Characteristics

### Optimizations Implemented
- **Token Batching**: 90% reduction in renders (100+ → ~10 per response)
- **React 18 Features**: Automatic batching for better performance
- **Static Components**: 2x performance gain for completed messages
- **Memory Optimization**: Memoized components and callbacks

### Known Performance Issues
- **Startup Time**: 2-3 seconds due to React hydration
- **Memory Usage**: ~45MB due to React component tree
- **WSL Compatibility**: Raw mode issues in Windows terminals
- **Render Overhead**: Still higher than direct terminal manipulation

## Getting Started

### 1. **Critical First Step**: Read the Fix Guide
```bash
# MUST READ FIRST - Contains critical fixes
cat unified-chat-fixed-impl-guide.md
```

### 2. Understand the Current Issue
The workflow tools in `lib/src/tools/workflow-tools.ts` have this pattern:
```typescript
// ❌ BROKEN: Creates infinite recursion
await agentFactory.stream(workflowMessages, options);
```

Instead of:
```typescript  
// ✅ CORRECT: Direct tool execution
await mcpManager.executeTool('write_file', { path, content });
```

### 3. Implementation Priority
1. **Fix workflow tools** (from fixed guide) - **MANDATORY**
2. Test file operations work
3. Only then proceed with other optimizations

### 4. Testing Commands
```bash
# Primary test - must work after fixes
echo "write to file test.py hello world" | bun --cwd app src/main.ts unified
ls test.py  # Must exist or system is still broken

# Build commands
bun --cwd lib build && bun --cwd app build
```

## Architecture Benefits

### Advantages of Ink + React
- **Familiar Patterns**: React developers can immediately contribute
- **Component Reusability**: Standard React component patterns
- **Rich Ecosystem**: Access to React development tools and patterns
- **JSX Syntax**: Declarative UI description

### Disadvantages vs Neo-blessed
- **Performance Overhead**: React virtual DOM adds latency
- **Memory Usage**: Higher memory footprint
- **Terminal Compatibility**: More dependent on terminal features
- **State Complexity**: useEffect chains can be complex to debug

## Migration Path

If considering migration to Neo-blessed + XState:

1. **Fix Current Issues**: Implement workflow tool fixes first
2. **Parallel Implementation**: Build Neo-blessed version alongside
3. **Feature Comparison**: Ensure parity before switching
4. **Gradual Migration**: Use feature flags to test both approaches

## Development Guidelines

### Before Making Any Changes
1. **Read [unified-chat-fixed-impl-guide.md](unified-chat-fixed-impl-guide.md)** completely
2. **Understand the recursion issue** and why it breaks everything
3. **Implement the fixes** before any other development
4. **Test file creation** to verify fixes work

### Code Style
- Follow React best practices and hooks patterns
- Use TypeScript for all components
- Implement proper error boundaries
- Follow the component hierarchy in T6-terminal-ui.md

### Testing Strategy
- **Integration tests**: File operations must actually create files
- **Component tests**: React Testing Library patterns
- **Performance tests**: Render count and memory usage
- **Terminal tests**: Cross-platform compatibility

## Support and Documentation

### Internal References
- Core shared components: [`../core/`](../core/)
- Alternative approach: [`../neo-blessed/`](../neo-blessed/)
- Main project documentation: [`../../README.md`](../../README.md)

### Key Implementation Notes
- The current implementation has documented solutions for all critical issues
- Performance optimizations are already implemented and effective
- The main blocker is the workflow tools architecture, not React patterns
- Once fixed, this approach provides a solid foundation for React-familiar developers

## Status Summary

**Current State**: Partially functional with critical architectural flaw
**Required Action**: Implement fixes from unified-chat-fixed-impl-guide.md
**Timeline**: Fixes can be implemented in 1-2 days
**Future**: Solid React-based foundation once core issues resolved