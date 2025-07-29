# Unified Configuration System

**Context**: The original architecture had scattered configuration across 5+ containers (identified in opus4 review). This document defines a single, unified configuration approach.

## Overview

**Problem**: Each container had its own config schema, leading to:
- Configuration scattered across multiple files
- Inconsistent configuration patterns
- Difficult deployment and maintenance
- No unified validation

**Solution**: Single configuration file with clear sections and unified validation.

---

## 1. Unified Configuration Schema

### 1.1 Complete Configuration Structure

```yaml
# qi-agent-config.yaml - Single source of truth
agent:
  name: "qi-v2-agent"
  version: "2.0.0"
  environment: "development" # development | staging | production
  
# Model Provider Configuration
models:
  defaultProvider: "ollama"
  
  ollama:
    baseUrl: "http://localhost:11434"
    model: "qwen2.5:7b"
    temperature: 0.7
    timeout: 30000
    
  openai:
    apiKey: "${OPENAI_API_KEY}"
    model: "gpt-4o-mini"
    temperature: 0.7
    maxTokens: 4096
    timeout: 30000
    
  anthropic:
    apiKey: "${ANTHROPIC_API_KEY}"
    model: "claude-3-haiku-20240307"
    temperature: 0.7
    maxTokens: 4096
    timeout: 30000

# MCP Tool Configuration
tools:
  servers:
    - name: "sequential-thinking"
      command: "npx"
      args: ["@modelcontextprotocol/sequential-thinking"]
      timeout: 15000
      requiredFor: ["planning"]
      optionalFor: ["debugging"]
      env:
        NODE_ENV: "production"
        
    - name: "filesystem"
      command: "npx"
      args: ["@modelcontextprotocol/filesystem"]
      timeout: 10000
      requiredFor: ["coding", "debugging"]
      optionalFor: ["planning"]
      env:
        FILESYSTEM_ROOT: "${PROJECT_ROOT}"
        
    - name: "web-search"
      command: "python"
      args: ["-m", "mcp_web_search"]
      timeout: 20000
      requiredFor: ["information"]
      optionalFor: ["planning", "debugging"]
      env:
        SEARCH_API_KEY: "${SEARCH_API_KEY}"
        
    - name: "git"
      command: "npx"
      args: ["@modelcontextprotocol/git"]
      timeout: 10000
      requiredFor: []
      optionalFor: ["coding", "debugging", "planning"]
      
    - name: "memory"
      command: "npx"
      args: ["@modelcontextprotocol/memory"]
      timeout: 5000
      requiredFor: []
      optionalFor: ["planning", "coding", "debugging", "information", "generic"]

# Pattern Detection Configuration
patternDetection:
  confidenceThreshold: 0.7
  enableLLMFallback: true
  llmFallbackModel: "qwen2.5:7b"
  cacheSize: 1000
  cacheTTL: 300000 # 5 minutes
  
  # Multi-signal weights
  signalWeights:
    toolMention: 0.9
    actionVerb: 0.8
    errorIndicator: 0.9
    contextContinuation: 0.4
    fileExtension: 0.8

# Operational Configuration (New - addresses opus4 feedback)
operational:
  rateLimits:
    toolCalls:
      perSecond: 10
      perMinute: 300
      burstSize: 5
    modelCalls:
      perSecond: 5
      perMinute: 150
      tokensPerMinute: 150000
      
  timeouts:
    toolExecution: 30000
    modelGeneration: 60000
    totalRequest: 120000
    mcpServerStart: 10000
    
  retries:
    maxAttempts: 3
    baseDelayMs: 1000
    maxDelayMs: 10000
    retryableErrors: ["NETWORK_ERROR", "TIMEOUT", "RATE_LIMITED", "SERVER_ERROR"]
    
  circuitBreaker:
    enabled: true
    failureThreshold: 5
    timeoutMs: 30000
    monitoringPeriod: 60000
    
  costs:
    enableTracking: true
    budgetLimits:
      daily: 10.00
      monthly: 200.00
      warningThreshold: 0.8
    tokenCosts:
      ollama: 0.0 # Local model
      openai: 0.0001 # Per token estimate
      anthropic: 0.0001

# Logging Configuration
logging:
  level: "info" # debug | info | warn | error
  enableConsole: true
  enableFile: true
  filePath: "logs/qi-agent.log"
  enableMetrics: true
  metricsInterval: 60000

# Development/Testing Overrides
development:
  enableDebugMode: true
  skipToolValidation: false
  mockExpensiveTools: false
  enableHotReload: true
  
production:
  enableDebugMode: false
  skipToolValidation: false
  mockExpensiveTools: false
  enableSentry: true
  sentryDsn: "${SENTRY_DSN}"
```

### 1.2 Environment Variable Support

**Environment Variables**: All sensitive values use `${VAR_NAME}` syntax.

**Required Environment Variables**:
```bash
# Optional (only if using these providers)
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
SEARCH_API_KEY=your-search-key

# Development
PROJECT_ROOT=/path/to/project
NODE_ENV=development

# Production  
SENTRY_DSN=your-sentry-dsn
```

---

## 2. Configuration Loading

### 2.1 Configuration Priority (High to Low)

1. **Command line arguments**: `--config-override key=value`
2. **Environment variables**: `QI_CONFIG_KEY=value`
3. **Config file**: `qi-agent-config.yaml`
4. **Default values**: Built-in defaults

### 2.2 Configuration Validation

**Schema Validation**: Using Zod for TypeScript type safety:

```typescript
const ConfigSchema = z.object({
  agent: z.object({
    name: z.string(),
    version: z.string(),
    environment: z.enum(['development', 'staging', 'production'])
  }),
  models: z.object({
    defaultProvider: z.enum(['ollama', 'openai', 'anthropic']),
    ollama: z.object({
      baseUrl: z.string().url(),
      model: z.string(),
      temperature: z.number().min(0).max(2)
    }).optional()
    // ... other providers
  }),
  // ... rest of schema
});

type UnifiedConfig = z.infer<typeof ConfigSchema>;
```

**Validation Rules**:
- Default provider must be configured
- Tool servers must exist and be executable
- Required tools for each mode must be available
- Budget limits must be positive numbers
- Timeouts must be reasonable (>1000ms)

---

## 3. Configuration Examples

### 3.1 Minimal Development Config

```yaml
# Minimal config for local development
agent:
  name: "qi-dev"
  environment: "development"

models:
  defaultProvider: "ollama"
  ollama:
    baseUrl: "http://localhost:11434"
    model: "qwen2.5:7b"

tools:
  servers:
    - name: "filesystem"
      command: "npx"
      args: ["@modelcontextprotocol/filesystem"]
      requiredFor: ["coding"]

patternDetection:
  confidenceThreshold: 0.6
  enableLLMFallback: false

operational:
  timeouts:
    toolExecution: 30000
    totalRequest: 60000
  retries:
    maxAttempts: 2
```

### 3.2 Production Config

```yaml
# Production config with full operational features
agent:
  name: "qi-prod"
  environment: "production"

models:
  defaultProvider: "ollama"
  ollama:
    baseUrl: "http://localhost:11434"
    model: "qwen2.5:32b"
    temperature: 0.5
  # Backup providers configured
  openai:
    apiKey: "${OPENAI_API_KEY}"
    model: "gpt-4o-mini"

tools:
  servers:
    # All production MCP servers
    - name: "sequential-thinking"
      command: "npx"
      args: ["@modelcontextprotocol/sequential-thinking"]
      requiredFor: ["planning"]
    # ... full server list

patternDetection:
  confidenceThreshold: 0.8
  enableLLMFallback: true
  cacheSize: 5000

operational:
  rateLimits:
    toolCalls:
      perSecond: 20
      perMinute: 600
  costs:
    enableTracking: true
    budgetLimits:
      daily: 50.00
      monthly: 1000.00
  circuitBreaker:
    enabled: true
    failureThreshold: 3

production:
  enableSentry: true
  sentryDsn: "${SENTRY_DSN}"
```

---

## 4. Configuration Management

### 4.1 Config File Locations

**Search Order**:
1. `./qi-agent-config.yaml` (current directory)
2. `~/.config/qi-agent/config.yaml` (user config)
3. `/etc/qi-agent/config.yaml` (system config)
4. Built-in defaults

### 4.2 Configuration Hot Reload

**Development Mode**: Config changes trigger restart
**Production Mode**: Requires explicit reload command

```bash
# Reload configuration without restart
qi-agent config reload

# Validate configuration
qi-agent config validate

# Show current configuration (with secrets masked)
qi-agent config show
```

### 4.3 Configuration Templates

**Generate Config Templates**:
```bash
# Generate minimal config
qi-agent config init --template minimal

# Generate production config
qi-agent config init --template production

# Generate with specific providers
qi-agent config init --providers ollama,openai
```

---

## 5. Migration from Old Configuration

### 5.1 Legacy Config Conversion

**Automated Migration**:
```bash
# Convert old scattered configs to unified
qi-agent config migrate \
  --old-dir ./config \
  --output ./qi-agent-config.yaml
```

**Manual Migration Steps**:
1. Combine model provider configs
2. Merge MCP server configurations  
3. Add operational settings (new)
4. Validate unified config
5. Test with development environment

### 5.2 Backward Compatibility

**Compatibility Layer**: Support old config format during transition
**Deprecation Timeline**: 
- v2.0: Unified config introduced, old format supported
- v2.1: Old format deprecated with warnings
- v2.2: Old format removed

---

## 6. Benefits of Unified Configuration

### 6.1 Operational Benefits

- **Single Source of Truth**: One file to manage
- **Consistent Validation**: Unified schema validation
- **Environment Promotion**: Easy config promotion between environments
- **Security**: Centralized secret management

### 6.2 Developer Benefits

- **Type Safety**: Full TypeScript typing
- **IntelliSense**: IDE auto-completion
- **Documentation**: Self-documenting configuration
- **Testing**: Easy config mocking for tests

### 6.3 Deployment Benefits

- **Container-Friendly**: Single config file for Docker
- **Cloud-Native**: Environment variable integration
- **GitOps**: Version-controlled configuration
- **Monitoring**: Centralized config validation and health checks

This unified configuration system addresses the "scattered configuration" problem identified in the opus4 review while providing production-ready features.