# Configuration Examples

This directory contains example configuration files for the qi-v2 agent practical framework.

## Available Examples

### development.json
Complete development configuration with:
- Debug logging enabled
- Relaxed rate limits and timeouts
- All MCP servers configured
- Mock model provider support
- Comprehensive metrics and monitoring

**Usage:**
```bash
bun --cwd app src/main.ts --config config/examples/development.json
```

### production.json
Production-ready configuration with:
- Info-level logging
- Strict rate limits and timeouts
- Essential MCP servers only
- Circuit breaker protection
- Performance-optimized settings

**Usage:**
```bash
bun --cwd app src/main.ts --config config/examples/production.json
```

### minimal.json
Minimal configuration for testing:
- Basic agent settings with defaults
- Single memory MCP server
- Generic mode only
- Ideal for quick testing and demos

**Usage:**
```bash
bun --cwd app src/main.ts --config config/examples/minimal.json
```

## Environment Variable Overrides

All configuration values can be overridden with environment variables:

```bash
# Model configuration
export QI_MODEL_PROVIDER=anthropic
export QI_MODEL_API_KEY=your-api-key
export QI_MODEL_DEFAULT=claude-3-sonnet

# Agent settings
export QI_AGENT_ENVIRONMENT=production
export QI_AGENT_LOG_LEVEL=warn

# Operational settings
export QI_RATE_LIMIT_TOOL_CALLS=50
export QI_TIMEOUT_TOOL_EXECUTION=15000

# Run with overrides
bun --cwd app src/main.ts --config config/examples/development.json
```

## Configuration Schema

The configuration follows a unified schema with these main sections:

- **agent**: Basic agent identity and environment settings
- **model**: LLM provider configuration (Ollama, OpenAI, Anthropic)
- **mcpServers**: MCP server definitions with tool-mode mappings
- **operational**: Rate limiting, retries, circuit breakers, cost tracking
- **detection**: Pattern matching and context tracking settings
- **workflows**: Workflow orchestration and custom mode specifications

## Creating Custom Configurations

1. Start with one of the example files
2. Modify the settings for your use case
3. Validate the configuration:

```bash
bun --cwd lib src/agent/unified-config.ts validate config/my-config.json
```

4. Test with the agent:

```bash
bun --cwd app src/main.ts --config config/my-config.json
```

## MCP Server Configuration

MCP servers are configured with tool-mode relationships:

- **requiredFor**: Modes that cannot function without this tool
- **optionalFor**: Modes that can use this tool if available
- **forbiddenFor**: Modes that should never use this tool (for safety)

Example:
```json
{
  "name": "filesystem",
  "command": "npx",
  "args": ["@modelcontextprotocol/server-filesystem", "/workspace"],
  "requiredFor": ["coding"],
  "optionalFor": ["debugging"],
  "forbiddenFor": ["planning"]
}
```

## Cognitive Mode System

The agent uses direct cognitive modes:

- **planning**: Strategic analysis with sequential-thinking tools
- **coding**: Implementation with filesystem, git tools
- **information**: Knowledge sharing with web-search tools
- **debugging**: Problem resolution with comprehensive tool access
- **generic**: Safe conversational mode with minimal tools

Each mode has specific tool requirements and forbidden tools for safety.

## Operational Features

Production configurations include:

- **Rate Limiting**: Prevent tool/model overuse
- **Circuit Breakers**: Automatic failure protection
- **Retry Logic**: Exponential backoff for transient failures
- **Cost Tracking**: Monitor usage and expenses
- **Health Monitoring**: Component status and metrics

## Security Considerations

- Keep API keys in environment variables, not config files
- Use minimal tool access for each mode
- Enable operational protections in production
- Validate configurations before deployment
- Monitor agent behavior and costs