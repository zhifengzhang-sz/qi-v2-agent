# Qi Agent with Ollama Setup

## Quick Setup

```bash
# 1. Install Ollama and pull a model
curl -fsSL https://ollama.ai/install.sh | sh
ollama serve
ollama pull qwen2.5-coder:7b

# 2. Install Qi Agent
cd qi-v2-agent
bun install

# 3. Start chatting
bun --cwd app src/main.ts chat
```

## Configuration

Edit `config/qi-config.yaml` to change models:

```yaml
model:
  name: "qwen2.5-coder:7b"        # Change to your preferred model  
  temperature: 0.1                # Creativity (0.0-2.0)
  baseUrl: "http://localhost:11434"
  thinkingEnabled: false          # Only for deepseek-r1
```

**Recommended models:**
- `qwen2.5-coder:7b` - Good coding performance (5GB RAM)
- `deepseek-r1:7b` - Advanced reasoning (5GB RAM)
- `llama3.1:8b` - General purpose (5GB RAM)

## Running the Agent

### Available Commands

```bash
# Interactive chat session (main feature)
bun --cwd app src/main.ts chat
bun --cwd app src/main.ts chat --model qwen2.5-coder:7b
bun --cwd app src/main.ts chat --debug

# Configuration management
bun --cwd app src/main.ts config --show
bun --cwd app src/main.ts config --validate

# MCP server management  
bun --cwd app src/main.ts servers --list
bun --cwd app src/main.ts servers --test
```

**Note**: Additional workflow commands (analyze, edit, review, etc.) are planned for future versions.

### Configuration Commands

```bash
# Check configuration
bun --cwd app src/main.ts config --show

# Test server connections  
bun --cwd app src/main.ts servers --test
```

## Troubleshooting

**"Agent health check failed"**
```bash
# Check Ollama is running
ollama serve

# Verify model exists
ollama list
```

**Command not found**
```bash
# Install dependencies first
bun install
```

**Chat UI not showing**
```bash
# Try in a fresh terminal window
clear
bun --cwd app src/main.ts chat

# Test with debug mode
bun --cwd app src/main.ts chat --debug

# If UI still doesn't appear, the welcome message should show:
# "🤖 qi-v2 agent - Ready!" 
# Type your message and press Enter even if you don't see a prompt
```

**Debug mode**
```bash
# See detailed logs
bun --cwd app src/main.ts chat --debug
```

