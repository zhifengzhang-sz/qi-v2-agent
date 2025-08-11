# qi-v2-agent

**v-0.5.1** - AI coding assistant with toolbox architecture, file reference system, and multi-provider LLM support.

## Install & Run

```bash
bun install
bun --cwd lib build
cd app && bun run qi-prompt
```

**Prerequisites**: Node.js 18+, Bun, [Ollama](https://ollama.ai) running locally

## Usage Examples

```bash
# Basic usage
bun run qi-prompt                    # Default CLI (readline)
bun run qi-prompt --framework ink   # Rich UI with React components
bun run qi-prompt --help           # Show all options

# Alternative (same as qi-prompt)
bun run qi-code                     # Legacy alias for qi-prompt
```

**Framework Options:**
- `--framework readline` - Basic terminal interface (default, works everywhere)  
- `--framework ink` - Rich React-based UI with colors and animations

## ✨ Key Features (v-0.5.1)

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
- **Workflow Statistics**: Track execution performance with `/workflows` command
- **Bounded Complexity**: Max 3 operations per workflow for predictable performance

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

## 🧪 Testing & Development

```bash
# Run tests
bun run test                    # Architecture tests (lib)
bun run typecheck              # TypeScript compilation check
bun run check                  # Full quality check (typecheck + lint + test)

# Performance studies
bun --cwd app run study:rule-based      # Classification study
```

## 📈 Version Roadmap

- **v-0.4.x**: Pure prompt app ✅
- **v-0.5.x**: Current - toolbox preview ← **HERE**
- **v-0.6.x**: Full toolbox (100+ tools, MCP integration)
- **v-0.7.x**: Advanced workflows  
- **v-0.8.x**: Full agent capabilities

---

**Status**: v-0.5.1 foundation complete with working file reference system and clean architecture.