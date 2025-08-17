# qi-v2-agent

**Dual-Agent Architecture** - Two specialized AI agents: **qi-prompt** (advanced prompt app) and **qi-code** (full coding agent)

## 🤖 Agent Architecture

### **qi-prompt** - Advanced Prompt Application *(Current: v-0.8.0, Target: v-0.8.x)*
- **Focus**: Context management and simple workflows
- **Strength**: Professional context optimization with RAG integration
- **Workflows**: Well-defined, simple patterns (no fancy complexity)
- **Current Status**: v-0.8.0 working implementation ✅
- **Milestone**: v-0.8.x complete (qi-prompt enhanced with upgraded modules)

### **qi-code** - Full Coding Agent *(Target: v-0.10.x)*
- **Focus**: Complete workflow orchestration and tool ecosystem
- **Strength**: Advanced agent capabilities with MCP server integration
- **Workflows**: Full pattern library (ReAct, ReWOO, ADaPT) with intelligent selection
- **Milestone**: v-0.10.x Advanced Agent Capabilities

## Install & Run

### **qi-prompt** *(Currently Available)*

```bash
bun install
bun --cwd lib build
cd app && bun run qi-prompt
```

**Prerequisites**: 
- **Development**: Node.js 18+, Bun, [Ollama](https://ollama.ai) running locally
- **Production Binary**: Just the qi-prompt executable and your config files

### **qi-code** *(Coming in v-0.10.x)*
Full agent capabilities with advanced workflows and MCP integration - under development.

## Usage Examples

```bash
# Development usage
bun run qi-prompt --config-path config/llm-providers.yaml --schema-path config/schema.json --env-path .env
bun run qi-prompt --framework ink --config-path /path/to/config.yaml --schema-path /path/to/schema.json
bun run qi-prompt --help           # Show all options

# Production binary usage (NEW in v-0.8.0)
./app/qi-prompt --config-path config/llm-providers.yaml --schema-path config/schema.json --env-path .env
./app/qi-prompt --framework ink --config-path ./config.yaml --schema-path ./schema.json --env-path ./.env
```

**Framework Options:**
- `--framework readline` - Basic terminal interface (default, works everywhere)  
- `--framework ink` - Rich React-based UI with colors and animations

## ✨ qi-prompt Features (v-0.8.0)

### 📁 File Reference System
Use `@file` patterns to include file content in your prompts:

```bash
@package.json what dependencies do I have?
@src/index.ts explain this code
@config/llm-providers.yaml @README.md summarize these files
```

### 🧰 Toolbox Architecture
- **4 registered tools** across 3 categories
- **File Tools**: FileContentResolver, ProjectStructureScanner  
- **Parsing Tools**: FileReferenceParser for @file pattern detection
- **Context Tools**: SessionManager for conversation persistence

### 🔄 Simple Workflow System
- **FILE_REFERENCE Workflow**: Processes `@file + prompt` patterns automatically
- **Well-Defined Patterns**: Simple, clear workflows with no fancy complexity
- **Bounded Complexity**: Max 3 operations per workflow for predictable performance
- **Theoretically Sound**: Clean, straightforward design principles
- **Workflow Statistics**: Track execution performance with `/workflows` command

### 🎛️ Multi-Provider LLM Support
- **5 Providers**: Ollama (local), OpenRouter, Groq, Hugging Face, Together AI
- **25+ Models**: Including Claude 3.5, GPT-4, Llama 3.2, Qwen3 Coder, Qwen3 32B, Gemini Flash
- **Smart Fallback**: Automatic provider switching on failure
- **Cost Optimization**: Prefer free/local models by default

## 📋 Commands

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

## 🏗️ Architecture

- **Two-Layer Pattern**: Clean interface hiding QiCore complexity
- **Event-Driven Design**: PromptAppOrchestrator with workflow integration
- **Result<T> Patterns**: Professional error handling with QiCore
- **Single File Strategy**: Consolidated implementation in `qi-prompt.ts`

## ⌨️ Hotkeys & Controls

The CLI provides responsive keyboard shortcuts for efficient interaction:

### 🔄 Mode Navigation
- **Shift+Tab**: Cycle through Interactive/Command/Streaming modes
- Visual indicator shows current mode with cycling hint

### 📚 Command History Navigation
- **↑ Arrow Key**: Navigate backward through command history (newest to oldest)
- **↓ Arrow Key**: Navigate forward through command history (return to current input)
- **Smart Context**: History navigation works when no command suggestions are shown
- **Session Persistence**: History maintained throughout the CLI session

### 📝 Input & Commands
- **Tab**: Auto-complete commands when typing `/` (shows suggestions)
- **↑/↓ with `/`**: Navigate command suggestions instead of history
- **Enter**: Submit input or select highlighted command suggestion

### ⏹️ Cancellation & Control
- **ESC**: 
  - **During processing**: Cancel running operations (LLM requests, workflows)
  - **While idle**: Clear current input and provide feedback
  - **Always responsive**: Works in all interface states
- **Ctrl+C**: Clear current input line (different from ESC - no status messages)
- **Ctrl+D**: Graceful exit with goodbye message

### 🎯 Smart Behavior
- **Context-aware**: ESC behavior adapts to current activity
- **Visual feedback**: Clear status messages for all actions
- **Non-destructive**: Cancellation safely stops operations without data loss
- **Framework agnostic**: Works consistently in both Readline and Ink modes

## 📦 Binary Compilation (NEW in v-0.8.0)

```bash
# Build and compile portable binary
bun run compile                          # Creates app/qi-prompt executable

# Run compiled binary with config files
./app/qi-prompt --config-path config/llm-providers.yaml --schema-path config/schema.json --env-path .env
./app/qi-prompt --framework ink --config-path /path/to/config.yaml --schema-path /path/to/schema.json
./app/qi-prompt --help                   # Show all binary options
```

**Binary Features:**
- **Portable**: Single 8.74MB executable with no dependencies
- **Professional CLI**: Full argument parsing with `--config-path`, `--schema-path`, `--env-path`
- **No Hardcoded Paths**: Complete configuration flexibility
- **Framework Support**: Works with all UI frameworks (readline, ink, hybrid)

## 🧪 Testing & Development

```bash
# Run tests
bun run test                    # Architecture tests (lib)
bun run typecheck              # TypeScript compilation check
bun run check                  # Full quality check (typecheck + lint + test)

# Build and compilation
bun run build                   # Build library and validate app
bun run compile                 # Create portable binary

# Performance studies
bun --cwd app run study:rule-based      # Classification study
```

## 📈 Dual-Agent Roadmap

### **qi-prompt Evolution**
- **v-0.4.x**: Pure prompt app ✅
- **v-0.5.x**: Toolbox preview with file references ✅
- **v-0.6.x**: Message-driven architecture with QiCore integration ✅
- **v-0.7.x**: XState v5 agent state management ✅
- **v-0.8.0**: First working qi-prompt implementation ✅
- **v-0.8.x**: **Target** - Enhanced Core Infrastructure ← **qi-prompt MILESTONE**
  - qi-prompt enhanced with upgraded modules
  - Advanced context management with RAG integration
  - Enhanced state manager, model manager, MCP client integration
  - Simple, well-defined workflows (no fancy complexity)

### **qi-code Development Path**
- **v-0.9.x**: Enhanced Workflow System
  - Intelligent pattern selection (ReAct, ReWOO, ADaPT)
  - Production-ready workflow execution
- **v-0.10.x**: **qi-code MILESTONE** - Advanced Agent Capabilities
  - Complete workflow orchestration
  - Full tool layer with MCP server integration
  - Multi-agent coordination
- **v-0.11.x**: Continuous Learning System
- **v-1.0.x**: Production-ready dual-agent system

---

**Status**: 
- **qi-prompt v-0.8.0**: ✅ Working implementation, **v-0.8.x target**: Enhanced with upgraded modules
- **qi-code**: 🚧 Under development (v-0.10.x milestone) - Full agent capabilities with advanced workflows and MCP integration