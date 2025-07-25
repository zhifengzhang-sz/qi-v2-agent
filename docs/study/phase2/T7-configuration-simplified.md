# T7: Configuration Management - Simple Config System

## Overview

This simplified guide covers configuration management using basic YAML with Zod validation. Based on Phase 1 analysis showing dramatic simplification through TypeScript SDKs, we focus on essential configuration needs rather than complex enterprise-grade systems.

**Key Principle:** Simple, type-safe configuration that covers 90% of use cases with minimal complexity.

## Architecture Decisions

### Simple YAML + Zod Approach

**Decision: Basic Configuration with Type Safety**

**Benefits:**
- **Simplicity**: Easy to read and edit YAML files
- **Type Safety**: Zod provides runtime validation and TypeScript types
- **Maintainability**: No complex inheritance or migration systems
- **User-Friendly**: Clear configuration structure

### Essential Configuration Areas

**Core Configuration:**
1. **Model Settings**: LLM provider and parameters
2. **Server List**: MCP servers to connect to
3. **UI Preferences**: Terminal interface settings
4. **Basic Security**: Simple permission and logging settings

## Configuration Schema

### Core Configuration Types

```typescript
import { z } from 'zod';

// Model configuration
const ModelConfigSchema = z.object({
  provider: z.enum(['ollama', 'openai', 'anthropic']),
  name: z.string(),
  temperature: z.number().min(0).max(2).default(0.1),
  maxTokens: z.number().positive().default(4000),
  apiKey: z.string().optional()
});

// Server configuration
const ServerConfigSchema = z.object({
  transport: z.enum(['stdio', 'sse', 'websocket']),
  command: z.string().optional(),
  args: z.array(z.string()).default([]),
  url: z.string().url().optional(),
  env: z.record(z.string()).optional(),
  enabled: z.boolean().default(true)
});

// UI configuration
const UIConfigSchema = z.object({
  theme: z.enum(['dark', 'light', 'auto']).default('auto'),
  showThinking: z.boolean().default(true),
  streamingEnabled: z.boolean().default(true),
  maxHistoryLength: z.number().positive().default(1000)
});

// Security configuration
const SecurityConfigSchema = z.object({
  auditLogging: z.boolean().default(false),
  allowedPaths: z.array(z.string()).default(['./workspace', './temp']),
  deniedPaths: z.array(z.string()).default(['/etc', '/usr', '~/.ssh']),
  maxFileSize: z.string().default('10MB')
});

// Main configuration schema
const QiConfigSchema = z.object({
  version: z.string().default('1.0.0'),
  model: ModelConfigSchema,
  servers: z.record(ServerConfigSchema).default({}),
  ui: UIConfigSchema.default({}),
  security: SecurityConfigSchema.default({})
});

type QiConfig = z.infer<typeof QiConfigSchema>;
```

### Example Configuration File

```yaml
# qi-config.yaml
version: "1.0.0"

# Model configuration
model:
  provider: ollama
  name: deepseek-r1
  temperature: 0.1
  maxTokens: 4000

# MCP servers
servers:
  file-server:
    transport: stdio
    command: bun
    args: ["./servers/file-server.ts"]
    enabled: true
    
  web-search:
    transport: sse
    url: "http://localhost:8001/mcp"
    enabled: false
    
  calculator:
    transport: stdio
    command: node
    args: ["./servers/calc-server.js"]
    enabled: true

# UI preferences
ui:
  theme: dark
  showThinking: true
  streamingEnabled: true
  maxHistoryLength: 1000

# Basic security settings
security:
  auditLogging: true
  allowedPaths:
    - "./workspace"
    - "./temp"
    - "./projects"
  deniedPaths:
    - "/etc"
    - "/usr"
    - "~/.ssh"
    - "/System"
  maxFileSize: "10MB"
```

## Configuration Loading

### Simple Configuration Manager

```typescript
import { readFile } from 'fs/promises';
import { parse as parseYAML } from 'yaml';

class ConfigManager {
  private config: QiConfig | null = null;

  async loadConfig(configPath = './qi-config.yaml'): Promise<QiConfig> {
    try {
      // Read and parse YAML
      const configFile = await readFile(configPath, 'utf-8');
      const rawConfig = parseYAML(configFile);
      
      // Validate with Zod
      this.config = QiConfigSchema.parse(rawConfig);
      
      console.log('✅ Configuration loaded successfully');
      return this.config;
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('❌ Configuration validation errors:');
        error.errors.forEach(err => {
          console.error(`  • ${err.path.join('.')}: ${err.message}`);
        });
      } else {
        console.error('❌ Failed to load configuration:', error.message);
      }
      
      throw new Error('Configuration loading failed');
    }
  }

  getConfig(): QiConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }
    return this.config;
  }

  // Simple getters for common config sections
  getModelConfig(): ModelConfig {
    return this.getConfig().model;
  }

  getServerConfig(serverName: string): ServerConfig | undefined {
    return this.getConfig().servers[serverName];
  }

  getEnabledServers(): Record<string, ServerConfig> {
    const servers = this.getConfig().servers;
    return Object.fromEntries(
      Object.entries(servers).filter(([_, config]) => config.enabled)
    );
  }

  getUIConfig(): UIConfig {
    return this.getConfig().ui;
  }

  getSecurityConfig(): SecurityConfig {
    return this.getConfig().security;
  }
}
```

### Environment Variable Support

```typescript
class ConfigManager {
  // ... previous methods ...

  private resolveEnvironmentVariables(obj: any): any {
    if (typeof obj === 'string') {
      // Replace ${VAR_NAME} with environment variable
      return obj.replace(/\$\{([^}]+)\}/g, (_, varName) => {
        const value = process.env[varName];
        if (value === undefined) {
          throw new Error(`Environment variable ${varName} not found`);
        }
        return value;
      });
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.resolveEnvironmentVariables(item));
    }
    
    if (obj && typeof obj === 'object') {
      const resolved: any = {};
      for (const [key, value] of Object.entries(obj)) {
        resolved[key] = this.resolveEnvironmentVariables(value);
      }
      return resolved;
    }
    
    return obj;
  }

  async loadConfig(configPath = './qi-config.yaml'): Promise<QiConfig> {
    try {
      const configFile = await readFile(configPath, 'utf-8');
      let rawConfig = parseYAML(configFile);
      
      // Resolve environment variables
      rawConfig = this.resolveEnvironmentVariables(rawConfig);
      
      // Validate with Zod
      this.config = QiConfigSchema.parse(rawConfig);
      
      console.log('✅ Configuration loaded successfully');
      return this.config;
      
    } catch (error) {
      // ... error handling ...
    }
  }
}
```

### Configuration with Environment Variables

```yaml
# qi-config.yaml with environment variable support
version: "1.0.0"

model:
  provider: ollama
  name: ${MODEL_NAME:-deepseek-r1}  # Default to deepseek-r1
  temperature: 0.1
  apiKey: ${OPENAI_API_KEY}  # Only needed for OpenAI

servers:
  file-server:
    transport: stdio
    command: ${BUN_PATH:-bun}
    args: ["./servers/file-server.ts"]
    
  remote-api:
    transport: sse
    url: ${API_BASE_URL}/mcp
    enabled: ${ENABLE_REMOTE_API:-false}

security:
  auditLogging: ${AUDIT_ENABLED:-false}
```

## Configuration Validation

### Enhanced Validation with Custom Rules

```typescript
class ConfigValidator {
  static validateBusinessRules(config: QiConfig): string[] {
    const errors: string[] = [];

    // Check model configuration
    if (config.model.provider === 'openai' && !config.model.apiKey) {
      errors.push('OpenAI provider requires apiKey');
    }

    // Check server configurations
    for (const [name, server] of Object.entries(config.servers)) {
      if (server.transport === 'stdio' && !server.command) {
        errors.push(`Server ${name}: stdio transport requires command`);
      }
      
      if (server.transport === 'sse' && !server.url) {
        errors.push(`Server ${name}: sse transport requires url`);
      }
    }

    // Check security settings
    const security = config.security;
    if (security.allowedPaths.length === 0) {
      errors.push('At least one allowed path must be specified');
    }

    return errors;
  }

  static validateConfiguration(config: QiConfig): void {
    const businessErrors = this.validateBusinessRules(config);
    
    if (businessErrors.length > 0) {
      console.error('❌ Configuration validation failed:');
      businessErrors.forEach(error => {
        console.error(`  • ${error}`);
      });
      throw new Error('Configuration validation failed');
    }
  }
}

// Enhanced config manager
class ConfigManager {
  async loadConfig(configPath = './qi-config.yaml'): Promise<QiConfig> {
    try {
      const configFile = await readFile(configPath, 'utf-8');
      let rawConfig = parseYAML(configFile);
      
      rawConfig = this.resolveEnvironmentVariables(rawConfig);
      this.config = QiConfigSchema.parse(rawConfig);
      
      // Additional business rule validation
      ConfigValidator.validateConfiguration(this.config);
      
      console.log('✅ Configuration loaded and validated successfully');
      return this.config;
      
    } catch (error) {
      // ... error handling ...
    }
  }
}
```

## Default Configuration

### Intelligent Defaults

```typescript
class ConfigDefaults {
  static createDefaultConfig(): QiConfig {
    return {
      version: '1.0.0',
      
      model: {
        provider: 'ollama',
        name: 'deepseek-r1',
        temperature: 0.1,
        maxTokens: 4000
      },
      
      servers: {
        'file-server': {
          transport: 'stdio',
          command: 'bun',
          args: ['./servers/file-server.ts'],
          enabled: true
        }
      },
      
      ui: {
        theme: 'auto',
        showThinking: true,
        streamingEnabled: true,
        maxHistoryLength: 1000
      },
      
      security: {
        auditLogging: false,
        allowedPaths: ['./workspace', './temp'],
        deniedPaths: ['/etc', '/usr', '~/.ssh'],
        maxFileSize: '10MB'
      }
    };
  }

  static async initializeDefaultConfig(configPath = './qi-config.yaml'): Promise<void> {
    try {
      // Check if config exists
      await readFile(configPath, 'utf-8');
      console.log('Configuration file already exists');
    } catch (error) {
      // Create default config
      const defaultConfig = this.createDefaultConfig();
      const yamlContent = stringify(defaultConfig, {
        indent: 2,
        lineWidth: 80
      });
      
      await writeFile(configPath, yamlContent, 'utf-8');
      console.log(`✅ Created default configuration at ${configPath}`);
    }
  }
}
```

## Configuration Usage

### Integration with Application

```typescript
// app.ts - Main application setup
async function initializeApp(): Promise<void> {
  // Initialize default config if needed
  await ConfigDefaults.initializeDefaultConfig();
  
  // Load configuration
  const configManager = new ConfigManager();
  const config = await configManager.loadConfig();
  
  // Initialize MCP manager with config
  const mcpManager = new SimpleMCPManager();
  const enabledServers = configManager.getEnabledServers();
  
  for (const [name, serverConfig] of Object.entries(enabledServers)) {
    try {
      await mcpManager.connectServer({ name, ...serverConfig });
      console.log(`✅ Connected to ${name}`);
    } catch (error) {
      console.warn(`⚠️  Failed to connect to ${name}:`, error.message);
    }
  }
  
  // Initialize model with config
  const modelConfig = configManager.getModelConfig();
  const model = createModelFromConfig(modelConfig);
  
  // Start application
  console.log('🚀 Qi Agent started successfully');
}

function createModelFromConfig(config: ModelConfig): any {
  switch (config.provider) {
    case 'ollama':
      return new ChatOllama({
        model: config.name,
        temperature: config.temperature,
        maxTokens: config.maxTokens
      });
      
    case 'openai':
      return new ChatOpenAI({
        modelName: config.name,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        openAIApiKey: config.apiKey
      });
      
    default:
      throw new Error(`Unsupported model provider: ${config.provider}`);
  }
}
```

## Testing Configuration

### Simple Configuration Tests

```typescript
describe('Configuration Management', () => {
  it('should load valid configuration', async () => {
    const configManager = new ConfigManager();
    const config = await configManager.loadConfig('./test/fixtures/valid-config.yaml');
    
    expect(config.version).toBe('1.0.0');
    expect(config.model.provider).toBe('ollama');
    expect(config.servers).toHaveProperty('file-server');
  });

  it('should reject invalid configuration', async () => {
    const configManager = new ConfigManager();
    
    await expect(
      configManager.loadConfig('./test/fixtures/invalid-config.yaml')
    ).rejects.toThrow('Configuration validation failed');
  });

  it('should resolve environment variables', async () => {
    process.env.TEST_MODEL = 'test-model';
    
    const configManager = new ConfigManager();
    const config = await configManager.loadConfig('./test/fixtures/env-config.yaml');
    
    expect(config.model.name).toBe('test-model');
  });
});
```

## Next Steps

After implementing T7 configuration:

1. **Proceed to T8**: [Security](./T8-security-simplified.md) for basic security patterns
2. **Test Configuration**: Verify config loading and validation
3. **Add User Config**: Support user-specific configuration files
4. **Environment Setup**: Document environment variable usage

This simplified approach focuses on essential configuration needs while maintaining type safety and ease of use, reducing complexity from 1,100+ lines to ~300 lines.