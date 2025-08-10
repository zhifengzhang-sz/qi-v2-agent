# Claude Code Enhancements

This document describes the Claude Code-inspired enhancements added to the qi-v2-agent library, focusing on intelligent context management and enhanced user experience patterns.

## Overview

The enhancements bring Claude Code's powerful context management and intelligent input understanding to qi-prompt applications:

- **File Reference Detection** - Use `@path/to/file` to reference files
- **Context-Aware Prompting** - Intelligent prompt enhancement with file content and project context
- **Session Persistence** - Conversation continuity across sessions 
- **Project Structure Awareness** - Automatic discovery of project context
- **Enhanced Classification** - Intelligent input understanding beyond simple command detection

## Enhanced Components

### 1. ClaudeCodeContextManager

**Location**: `lib/src/context/impl/ClaudeCodeContextManager.ts`

An enhanced context manager that extends the base `ContextManager` with:

- **File Reference Processing**: Detects and resolves `@file.txt` patterns
- **Project Context Discovery**: Automatically scans project structure
- **Session Management**: Persistent conversation sessions with continuity
- **Context-Aware Prompting**: Enhances user prompts with relevant context
- **Memory System**: Hierarchical memory (enterprise → project → user)

#### Key Features

```typescript
// Start a conversation with enhanced features
const session = await contextManager.startNewConversation('My Session');

// Process messages with file reference detection
await contextManager.addMessageToContextWithEnhancements(sessionId, {
  role: 'user',
  content: 'Explain @src/index.ts and @package.json',
  timestamp: new Date(),
});

// Get context-aware enhanced prompts
const enhancedPrompt = await contextManager.getContextAwarePrompt(
  sessionId, 
  'What does this project do?'
);
```

### 2. ClaudeCodeEnhancedClassificationMethod

**Location**: `lib/src/classifier/impl/claude-code-enhanced.ts`

An intelligent classifier that understands:

- **File References**: `@file.ts`, `./src/`, `../config/`
- **Extended Thinking**: Recognizes when deeper reasoning is needed
- **Project Patterns**: Understands project structure contexts
- **Conversational Markers**: Distinguishes questions from commands

#### Pattern Analysis

```typescript
const classification = await classifier.classify('Can you analyze @src/main.ts?');
// Result: { type: 'workflow', confidence: 0.85, reasoning: 'file references: src/main.ts' }
```

### 3. Enhanced Qi Prompt CLI

**Location**: `app/src/prompt/qi-prompt-enhanced.ts`

A complete CLI application demonstrating all enhancements:

- **Smart Input Processing**: Uses enhanced classification
- **File Reference Support**: Automatically includes referenced files in context
- **Session Commands**: `/files`, `/memory`, `/project` for context management
- **Enhanced Status**: Shows file references, memory, and project context

## Usage Examples

### Basic Usage

```bash
# Run the enhanced CLI
bun run app/scripts/run-enhanced.ts

# Or with options
bun run app/scripts/run-enhanced.ts --framework ink --debug
```

### Claude Code Patterns

```bash
# In the CLI:
> @src/index.ts what does this file do?
# → Automatically includes file content in prompt

> What is the purpose of this project?
# → Enhanced with project context and structure

> /files
# → Lists current file references

> /project  
# → Shows discovered project structure

> /memory
# → Shows loaded memory entries
```

### File Reference Patterns

The system understands various file reference patterns:

- `@file.ts` - Specific file reference
- `@src/` - Directory reference (lists contents)
- `@./config.json` - Relative path reference
- `@/absolute/path` - Absolute path reference

## Configuration

### Context Manager Configuration

```typescript
const contextManager = new ClaudeCodeContextManager(appContext, {
  enableFileReferences: true,        // Enable @file detection
  enableContextAwarePrompting: true, // Enhanced prompt construction
  enableMemoryPersistence: true,     // Session/memory persistence
  enableProjectDiscovery: true,      // Project structure scanning
  enableConversationHistory: true,   // Conversation continuity
  maxFileSize: 1024 * 1024,         // Max file size to read (1MB)
  maxFilesPerSession: 20,           // Max files per session
  maxContextWindow: 8000,           // Context window token limit
  projectMemoryFileName: 'CLAUDE.md', // Project memory file name
});
```

### Enhanced Classifier Configuration

```typescript
const classifier = new ClaudeCodeEnhancedClassificationMethod({
  enableFileAwareness: true,         // File reference detection
  enableExtendedThinking: true,      // Deep reasoning detection  
  enableContextContinuation: true,   // Conversation continuity
  confidenceThresholds: new Map([    // Classification confidence levels
    ['command', 1.0],
    ['prompt', 0.8], 
    ['workflow', 0.7],
  ]),
});
```

## Memory System

The enhanced context manager supports a hierarchical memory system inspired by Claude Code:

### Memory Files

- **Enterprise**: Company-wide patterns and standards
- **Project**: `CLAUDE.md` in project root with project-specific context
- **User**: `~/.claude/memory.md` with personal preferences

### Memory File Format

```markdown
# Project Memory

This project is a TypeScript CLI application using:
- Bun as runtime and package manager
- Vitest for testing
- Biome for linting and formatting

## Patterns
- Use functional programming with Result<T> types
- Always use proper error handling with @qi/base patterns

## Important Files
@src/index.ts - Main entry point
@lib/src/context/ - Context management system
```

### Memory Import System

Memory files can import other memory files:

```markdown
# Project Memory

@../shared/coding-standards.md
@~/.claude/typescript-preferences.md

## Project-Specific Rules
- Use strict TypeScript settings
- Prefer interfaces over types
```

## Testing

Comprehensive tests ensure the enhancements work correctly:

```bash
# Run context manager tests
bun test claude-code-context.test.ts

# Run all tests
bun test
```

### Test Coverage

- ✅ Session creation and management
- ✅ File reference detection and resolution
- ✅ Context-aware prompt generation
- ✅ Project structure discovery
- ✅ Memory loading and searching
- ✅ Conversation continuity
- ✅ Enhanced metadata tracking

## Architecture

### Enhanced Context Flow

```
User Input → Enhanced Classification → Context Processing → Enhanced Prompting
     ↓              ↓                        ↓                    ↓
File Refs → File Resolution → Context Assembly → LLM Processing
```

### Context Assembly

1. **Input Analysis**: Detect file references, thinking triggers, patterns
2. **File Resolution**: Read referenced files, handle errors gracefully
3. **Context Enhancement**: Add project context, memory, conversation history
4. **Prompt Construction**: Assemble enhanced prompt with all context
5. **Response Processing**: Track new references, update context

## Performance Considerations

- **File Caching**: Referenced files are cached to avoid re-reading
- **Context Window Management**: Automatic truncation when limits exceeded
- **Lazy Loading**: Project structure scanned on-demand with caching
- **Memory Limits**: Configurable limits on file size and count per session

## Integration

### Adding to Existing Projects

1. **Install Dependencies**: Ensure `@qi/base`, `@qi/core` available
2. **Replace Context Manager**: Use `ClaudeCodeContextManager`
3. **Add Enhanced Classification**: Use `ClaudeCodeEnhancedClassificationMethod`
4. **Update CLI**: Integrate enhanced event handling and commands

### Backward Compatibility

The enhancements are designed to be backward compatible:
- Base `IContextManager` interface preserved
- Enhanced features are opt-in via configuration
- Fallback behavior for disabled features
- Graceful error handling for missing files/permissions

## Future Enhancements

Planned improvements:

- **Real Session Persistence**: File-based session storage
- **Enhanced Memory Search**: Semantic search in memory entries  
- **Multi-LLM Context Sharing**: Share context across different models
- **Advanced File Processing**: Support for images, PDFs, archives
- **Collaborative Contexts**: Shared contexts across team members

## Examples Repository

See the `/demo` directory for complete working examples:

- `demo/basic-enhanced.ts` - Basic enhanced context usage
- `demo/file-reference-demo.ts` - File reference patterns
- `demo/memory-system-demo.ts` - Memory system usage
- `demo/session-continuity-demo.ts` - Session persistence patterns