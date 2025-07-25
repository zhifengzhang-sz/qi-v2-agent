# Running Qi Agent v-0.2.3 with Ollama

This guide explains how to set up and run the Qi Agent v-0.2.3 with Ollama for local LLM support.

## Prerequisites

1. **Node.js 18+** and **Bun runtime**
2. **Ollama installed and running**

### Install Ollama

```bash
# macOS/Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Or download from https://ollama.ai/download
```

Start Ollama service:
```bash
ollama serve
```

### Install a Model

```bash
# For coding tasks - recommended models:
ollama pull qwen2.5-coder:4b      # Fast, efficient (4B params)
ollama pull deepseek-r1           # Advanced reasoning (default)
ollama pull phi-4                 # Microsoft's latest model
ollama pull llama3.3:8b          # Meta's latest model

# Verify installation
ollama list
```

## Installation

1. **Clone and install the Qi Agent:**
```bash
git clone <repository-url>
cd qi-v2-agent
bun install
```

2. **Build the project:**
```bash
bun run build
```

## Configuration

### Default Configuration

The agent uses `config/qi-config.yaml` by default:

```yaml
model:
  name: "deepseek-r1"              # Model name from 'ollama list'
  temperature: 0.1                 # Creativity (0.0-2.0)
  baseUrl: "http://localhost:11434"  # Ollama API endpoint
  thinkingEnabled: true            # Enable reasoning mode (DeepSeek-R1 only)

mcp:
  servers:
    time-server:
      transport: stdio
      command: "bun"
      args: ["./servers/time-server.ts"]
    
    filesystem:
      transport: stdio
      command: "npx"
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]

memory:
  enabled: true
  type: "memory"

ui:
  theme: "dark"
  showTimestamps: true
  progressIndicators: true
```

### Using Different Models

Edit `config/qi-config.yaml` to change the model:

```yaml
# For Qwen 2.5 Coder
model:
  name: "qwen2.5-coder:4b"
  temperature: 0.1
  baseUrl: "http://localhost:11434"
  thinkingEnabled: false  # Qwen doesn't support thinking mode

# For Phi-4
model:
  name: "phi-4"
  temperature: 0.2
  baseUrl: "http://localhost:11434"
  thinkingEnabled: false

# For Llama 3.3
model:
  name: "llama3.3:8b"
  temperature: 0.1
  baseUrl: "http://localhost:11434"
  thinkingEnabled: false
```

## CLI Commands

### Basic Usage

```bash
# Start interactive chat with default config
bun run dev

# Or use the compiled binary
./app/qi-agent chat

# Start chat with specific model
bun --cwd app src/main.ts chat --model qwen2.5-coder:4b

# Start chat with custom config file
bun --cwd app src/main.ts chat --config /path/to/config.yaml

# Disable thinking mode for DeepSeek-R1
bun --cwd app src/main.ts chat --no-thinking

# Enable debug logging
bun --cwd app src/main.ts chat --debug

# Continue previous conversation
bun --cwd app src/main.ts chat --thread my-session-id
```

### Configuration Management

```bash
# Validate configuration
bun run config:validate
# or
bun --cwd app src/main.ts config --validate ../config/qi-config.yaml

# Show current configuration
bun run config:show
# or
bun --cwd app src/main.ts config --show ../config/qi-config.yaml
```

### MCP Server Management

```bash
# List configured servers
bun run servers:list
# or
bun --cwd app src/main.ts servers --list --config ../config/qi-config.yaml

# Test server connections
bun run servers:test
# or
bun --cwd app src/main.ts servers --test --config ../config/qi-config.yaml
```

## Development Commands

```bash
# Development mode with file watching
bun run dev

# Run tests
bun run test

# Type checking
bun run typecheck

# Linting
bun run lint

# Format code
bun run format

# Full check (typecheck + lint + test)
bun run check

# Build for production
bun run build

# Compile to standalone binary
bun run compile
```

## Example Session

```bash
# 1. Ensure Ollama is running
ollama serve

# 2. Pull a model (if not already done)
ollama pull qwen2.5-coder:4b

# 3. Start the agent
cd qi-v2-agent
bun run dev

# 4. You'll see the startup sequence:
🚀 Starting Qi Agent...
✅ Connected to 2 server(s)
🔧 3 tools available
Available tools:
  • time_get_current
  • filesystem_read_file
  • filesystem_write_file

# 5. Start chatting!
┌─ Qi Agent v-0.2.3 ─────────────────────────┐
│ Model: qwen2.5-coder:4b                    │
│ Type 'exit' to quit, 'help' for commands  │
└────────────────────────────────────────────┘

You: What's the current time?

🤖 The current time is 2025-01-25 14:30:45 UTC.

You: Create a simple Python script

🤖 I'll create a simple Python script for you...
[Writing to filesystem...]
✅ Created hello.py with a greeting function
```

## Troubleshooting

### Common Issues

1. **"Agent health check failed"**
   - Ensure Ollama is running: `ollama serve`
   - Verify model is installed: `ollama list`
   - Check baseUrl in config matches Ollama endpoint

2. **"Model not found"**
   - Pull the model: `ollama pull <model-name>`
   - Verify exact model name: `ollama list`

3. **"Server connection failed"**
   - Check MCP server configurations in `qi-config.yaml`
   - Ensure required dependencies are installed (bun, npx)

4. **Performance Issues**
   - Use smaller models (qwen2.5-coder:4b instead of larger models)
   - Adjust temperature and maxTokens in config
   - Monitor system resources

### Debug Mode

Enable detailed logging:
```bash
bun --cwd app src/main.ts chat --debug
```

This will show:
- Configuration loading
- Server connection attempts
- Tool availability
- Request/response details

## Model Recommendations

| Model | Size | Best For | Thinking Mode |
|-------|------|----------|---------------|
| `qwen2.5-coder:4b` | 4B | Coding, fast responses | ❌ |
| `deepseek-r1` | 32B | Complex reasoning, analysis | ✅ |
| `phi-4` | 14B | General purpose, balanced | ❌ |
| `llama3.3:8b` | 8B | General purpose, good quality | ❌ |

Choose based on your hardware capabilities and use case requirements.