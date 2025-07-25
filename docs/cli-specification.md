# CLI Command Specification

This document defines the complete command-line interface for the Qi Agent across all versions.

## Version Overview

- **v-0.2.4**: ✅ Chat implementation (current baseline)
- **v-0.2.5**: 🔧 File workflows (edit, analyze, explain)
- **v-0.2.6**: 📋 Git workflows (commit, diff, review)
- **v-0.2.7**: 🧪 Quality workflows (test, refactor, lint)
- **v-0.3.x**: 🚀 Advanced workflows (search, debug, generate)

## Current Commands (v-0.2.4) ✅

### `qi chat`
Interactive chat session with AI coding assistant.

```bash
qi chat [options]
```

**Options:**
- `-c, --config <path>` - Configuration file path (default: ../config/qi-config.yaml)
- `-m, --model <name>` - Override model to use
- `-t, --thread <id>` - Thread ID for conversation persistence
- `--debug` - Enable debug logging
- `--no-thinking` - Disable thinking mode for DeepSeek-R1

**Examples:**
```bash
qi chat                                    # Start chat with default config
qi chat --model qwen3:0.6b                # Use specific model
qi chat --thread my-session --debug       # Persistent conversation with debug
```

### `qi config`
Manage configuration settings.

```bash
qi config [options]
```

**Options:**
- `-v, --validate [path]` - Validate configuration file
- `-s, --show [path]` - Show current configuration

**Examples:**
```bash
qi config --show                          # Show current configuration
qi config --validate ../custom-config.yaml # Validate custom config
```

### `qi servers`
Manage MCP servers and tool integration.

```bash
qi servers [options]
```

**Options:**
- `-l, --list` - List configured servers
- `-t, --test` - Test server connections
- `-c, --config <path>` - Configuration file path

**Examples:**
```bash
qi servers --list                         # List all configured MCP servers
qi servers --test                         # Test connectivity to all servers
```

## File Workflows (v-0.2.5) 🔧

### `qi edit`
AI-assisted file editing with natural language instructions.

```bash
qi edit [files...] [options]
```

**Arguments:**
- `files...` - One or more files to edit

**Options:**
- `-m, --message <msg>` - Edit instruction (required)
- `-i, --interactive` - Interactive multi-file editing mode
- `-c, --config <path>` - Configuration file path
- `--debug` - Enable debug output

**Examples:**
```bash
qi edit src/app.ts -m "add error handling"
qi edit src/*.ts -m "refactor to use async/await"
qi edit --interactive -m "fix all TypeScript errors"
```

**Implementation:**
- Uses validated AgentFactory.stream() pattern
- Triggers smart routing (needsTools=true)
- Leverages MCP filesystem server for file operations
- Inherits 90% render reduction and streaming optimizations

### `qi analyze`
Code and file analysis with detailed insights.

```bash
qi analyze <target> [options]
```

**Arguments:**
- `target` - File, directory, or code pattern to analyze

**Options:**
- `--codebase` - Analyze entire codebase
- `--complexity` - Focus on complexity analysis
- `--dependencies` - Analyze dependencies and imports
- `--format <type>` - Output format (text, json, markdown)
- `-c, --config <path>` - Configuration file path

**Examples:**
```bash
qi analyze src/complex.ts                 # Analyze specific file
qi analyze src/ --complexity              # Complexity analysis of directory
qi analyze --codebase --dependencies      # Full dependency analysis
```

### `qi explain`
Code explanation and educational assistance.

```bash
qi explain <target> [options]
```

**Arguments:**
- `target` - File path, function, or concept to explain

**Options:**
- `--concept <topic>` - Explain a programming concept
- `--line <number>` - Focus on specific line number
- `--function <name>` - Explain specific function
- `--level <beginner|intermediate|advanced>` - Explanation level

**Examples:**
```bash
qi explain src/auth.ts:42                 # Explain specific line
qi explain --concept "async/await"        # Explain programming concept
qi explain src/utils.ts --function parseData # Explain specific function
```

## Git Workflows (v-0.2.6) 📋

### `qi commit`
AI-generated commit messages based on changes.

```bash
qi commit [options]
```

**Options:**
- `--conventional` - Use conventional commit format
- `--amend` - Amend last commit
- `--all` - Stage all changes before committing
- `--message <msg>` - Additional context for commit message
- `--dry-run` - Show generated message without committing

**Examples:**
```bash
qi commit                                 # Generate and apply commit message
qi commit --conventional --all            # Conventional format, stage all
qi commit --dry-run                       # Preview commit message only
```

### `qi diff`
Intelligent change analysis and review.

```bash
qi diff [options]
```

**Options:**
- `--staged` - Analyze staged changes only
- `--branch <name>` - Compare with specific branch
- `--summary` - High-level summary of changes
- `--impact` - Analyze potential impact of changes

**Examples:**
```bash
qi diff                                   # Analyze working directory changes
qi diff --staged --summary               # Summary of staged changes
qi diff --branch main --impact           # Impact analysis vs main branch
```

### `qi review`
Code review assistance and quality analysis.

```bash
qi review [target] [options]
```

**Arguments:**
- `target` - Files, commits, or PR to review (optional)

**Options:**
- `--pr <number>` - Review specific pull request
- `--commit <hash>` - Review specific commit
- `--checklist` - Generate review checklist
- `--security` - Focus on security issues

**Examples:**
```bash
qi review                                 # Review current changes
qi review --pr 123                       # Review pull request #123
qi review src/ --security                # Security-focused review
```

## Quality Workflows (v-0.2.7) 🧪

### `qi test`
Test generation and execution assistance.

```bash
qi test [target] [options]
```

**Arguments:**
- `target` - File or function to test (optional)

**Options:**
- `--generate` - Generate tests for target
- `--run` - Execute existing tests
- `--fix` - Fix failing tests
- `--coverage` - Generate coverage report

**Examples:**
```bash
qi test --generate src/utils.ts          # Generate tests for file
qi test --run --fix                      # Run tests and fix failures
qi test --coverage                       # Generate coverage report
```

### `qi refactor`
Code refactoring and improvement assistance.

```bash
qi refactor <target> [options]
```

**Arguments:**
- `target` - File or directory to refactor

**Options:**
- `--pattern <name>` - Apply specific refactoring pattern
- `--extract <type>` - Extract method, class, or component
- `--rename <old:new>` - Rename variables or functions
- `--dry-run` - Preview changes without applying

**Examples:**
```bash
qi refactor src/app.ts --extract method  # Extract methods from large functions
qi refactor src/ --pattern "extract-component" # Apply component extraction
qi refactor utils.ts --dry-run           # Preview refactoring changes
```

### `qi lint`
Code quality checks and automatic fixes.

```bash
qi lint [target] [options]
```

**Arguments:**
- `target` - Files or directories to lint (optional)

**Options:**
- `--fix` - Automatically fix issues
- `--rules <list>` - Specific rules to check
- `--format <type>` - Output format (text, json)
- `--strict` - Use strict quality standards

**Examples:**
```bash
qi lint                                   # Lint entire project
qi lint src/ --fix                       # Lint and fix issues in src/
qi lint --rules "no-unused-vars,prefer-const" # Check specific rules
```

## Advanced Workflows (v-0.3.x) 🚀

### `qi search`
Intelligent codebase search and navigation.

```bash
qi search <query> [options]
```

**Arguments:**
- `query` - Search terms or patterns

**Options:**
- `--semantic` - Semantic search across codebase
- `--pattern <type>` - Search for specific patterns
- `--scope <path>` - Limit search scope
- `--context` - Include surrounding context

### `qi debug`
Error analysis and systematic debugging assistance.

```bash
qi debug [options]
```

**Options:**
- `--error <message>` - Debug specific error message
- `--trace` - Analyze stack traces
- `--suggest` - Suggest debugging approaches

### `qi generate`
Code generation from specifications and requirements.

```bash
qi generate <type> [options]
```

**Arguments:**
- `type` - Type of code to generate (component, function, class, etc.)

**Options:**
- `--spec <file>` - Use specification file
- `--template <name>` - Use specific template
- `--framework <name>` - Target framework

## Global Options

All commands support these global options:

- `-h, --help` - Show command help
- `--version` - Show version information
- `-v, --verbose` - Verbose output
- `-q, --quiet` - Minimal output
- `--config <path>` - Override default configuration file

## Command Integration

All workflow commands integrate with the validated architecture:

1. **Smart Routing**: Commands automatically trigger appropriate LLM vs LangGraph paths
2. **MCP Integration**: Seamless tool orchestration through existing MCP servers
3. **Streaming UI**: All commands inherit optimized token batching and UI rendering
4. **Performance**: Sub-second to 4-second execution times with qwen3:0.6b model
5. **Error Handling**: Consistent timeout and completion handling across all commands

## Configuration

Commands respect the same configuration structure:

```yaml
# config/qi-config.yaml
model:
  name: "qwen3:0.6b"          # Required for optimal performance
  temperature: 0.1
  baseUrl: "http://localhost:11434"

mcp:
  servers:
    filesystem: # Required for file workflows
      transport: stdio
      command: "npx"
      args: ["-y", "@modelcontextprotocol/server-filesystem", "."]
    
    git: # Required for git workflows (v-0.2.6+)
      transport: stdio  
      command: "npx"
      args: ["-y", "@modelcontextprotocol/server-git"]
    
    shell: # Required for quality workflows (v-0.2.7+)
      transport: stdio
      command: "npx"
      args: ["-y", "@modelcontextprotocol/server-shell"]
```

This specification provides a complete roadmap for CLI development while maintaining consistency with the validated architecture patterns.