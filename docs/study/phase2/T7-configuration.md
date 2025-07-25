# T7: Configuration Management - Runtime Config System Guide

## Overview

This guide covers the design and implementation of a comprehensive configuration management system for the Qi V2 Agent. The architecture provides type-safe, hierarchical configuration with runtime updates, environment-specific overrides, and seamless migration support using Zod schema validation and modern TypeScript patterns.

## Architecture Decisions

### Configuration Format Selection

**YAML as Primary Format (Recommended)**

**Decision Rationale:**
- **Human Readability**: Excellent for user editing and documentation
- **Comment Support**: Inline documentation and explanations
- **Hierarchical Structure**: Natural nesting for complex configurations
- **Industry Standard**: Common choice for DevOps and configuration files
- **Multi-line Support**: Clean handling of long strings and templates

**Format Comparison:**

| Feature | YAML | JSON | TOML | Decision |
|---------|------|------|------|----------|
| **Readability** | Excellent | Good | Very Good | ✅ YAML |
| **Comments** | Yes | No | Yes | ✅ YAML/TOML |
| **Parsing Speed** | Moderate | Fast | Moderate | ⚖️ Acceptable |
| **Type Safety** | Via Schema | Native | Via Schema | ✅ Schema |
| **Ecosystem** | Mature | Mature | Growing | ✅ YAML |
| **Nesting** | Natural | Natural | Verbose | ✅ YAML |

**Multi-Format Support Strategy:**
```typescript
type ConfigFormat = 'yaml' | 'json' | 'toml';

interface ConfigLoader {
  loadYAML(path: string): Promise<unknown>;
  loadJSON(path: string): Promise<unknown>;
  loadTOML(path: string): Promise<unknown>;
  detectFormat(path: string): ConfigFormat;
}
```

### Schema Validation Approach

**Zod-Based Validation (Recommended)**

**Advantages of Zod:**
- **Type Safety**: Automatic TypeScript type generation
- **Runtime Validation**: Schema validation at runtime
- **Rich Error Messages**: Detailed validation errors
- **Composition**: Easy schema composition and reuse
- **Transform Support**: Data transformation during validation
- **Ecosystem**: Excellent TypeScript ecosystem integration

**Schema Architecture:**
```typescript
// Hierarchical schema design
const ServerConfigSchema = z.object({
  transport: z.enum(['stdio', 'sse', 'streamable_http', 'websocket']),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  url: z.string().url().optional(),
  env: z.record(z.string()).optional(),
  timeout: z.number().positive().default(30000)
});

const ModelConfigSchema = z.object({
  provider: z.enum(['ollama', 'openai', 'anthropic']),
  name: z.string(),
  temperature: z.number().min(0).max(2).default(0.1),
  maxTokens: z.number().positive().default(4000)
});

const QiConfigSchema = z.object({
  version: z.string().default('1.0.0'),
  servers: z.record(ServerConfigSchema).default({}),
  model: ModelConfigSchema,
  ui: UIConfigSchema.default({}),
  security: SecurityConfigSchema.default({})
});

type QiConfig = z.infer<typeof QiConfigSchema>;
```

### Configuration Inheritance Strategy

**Multi-Level Configuration Hierarchy:**

**Priority Order (Highest to Lowest):**
1. **CLI Arguments**: Command-line overrides
2. **Environment Variables**: Runtime environment settings
3. **User Config**: User-specific configuration file
4. **Project Config**: Project-specific configuration
5. **Default Config**: Built-in defaults

**Inheritance Implementation:**
```typescript
interface ConfigSource {
  name: string;
  priority: number;
  load(): Promise<Partial<QiConfig>>;
}

class ConfigManager {
  private sources: ConfigSource[] = [
    new CLIConfigSource(100),
    new EnvironmentConfigSource(90),
    new UserConfigSource(80),
    new ProjectConfigSource(70),
    new DefaultConfigSource(0)
  ];
  
  async loadConfig(): Promise<QiConfig> {
    const configs = await Promise.all(
      this.sources.map(source => source.load())
    );
    
    // Merge configurations by priority
    const merged = this.mergeConfigs(configs);
    
    // Validate final configuration
    return QiConfigSchema.parse(merged);
  }
}
```

## Integration Strategies

### Runtime Configuration Updates

**Hot Configuration Reloading:**

**Update Mechanisms:**
- **File Watching**: Monitor configuration files for changes
- **API Updates**: Programmatic configuration updates
- **CLI Commands**: Runtime configuration commands
- **UI Settings**: Interactive configuration updates

**Update Strategies:**
```typescript
interface ConfigUpdateStrategy {
  canHotReload(key: string): boolean;
  validateUpdate(key: string, value: unknown): boolean;
  applyUpdate(key: string, value: unknown): Promise<void>;
  rollbackUpdate(key: string): Promise<void>;
}

class RuntimeConfigManager {
  private watchers: Map<string, FileWatcher> = new Map();
  private updateStrategies: Map<string, ConfigUpdateStrategy> = new Map();
  
  async watchConfig(path: string): Promise<void> {
    const watcher = new FileWatcher(path);
    watcher.on('change', async () => {
      await this.reloadConfig(path);
    });
    this.watchers.set(path, watcher);
  }
  
  async updateConfig(key: string, value: unknown): Promise<void> {
    const strategy = this.updateStrategies.get(key);
    if (strategy?.canHotReload(key)) {
      await strategy.applyUpdate(key, value);
    } else {
      throw new Error(`Configuration key '${key}' requires restart`);
    }
  }
}
```

**Hot-Reloadable vs Restart-Required:**
```typescript
const ConfigUpdateRules = {
  // Hot-reloadable configurations
  'ui.theme': { hotReload: true, validator: UIThemeSchema },
  'model.temperature': { hotReload: true, validator: z.number().min(0).max(2) },
  'security.permissions': { hotReload: true, validator: PermissionsSchema },
  
  // Restart-required configurations
  'servers': { hotReload: false, reason: 'Server connections need restart' },
  'model.provider': { hotReload: false, reason: 'Model provider change requires restart' },
  'logging.level': { hotReload: true, validator: z.enum(['debug', 'info', 'warn', 'error']) }
};
```

### Environment-Specific Configurations

**Multi-Environment Strategy:**

**Environment Detection:**
```typescript
type Environment = 'development' | 'staging' | 'production' | 'test';

interface EnvironmentConfig {
  name: Environment;
  configPath: string;
  overrides: Partial<QiConfig>;
  secrets: Record<string, string>;
}

class EnvironmentManager {
  private currentEnv: Environment;
  
  detectEnvironment(): Environment {
    // Check NODE_ENV, QI_ENV, or other indicators
    return process.env.QI_ENV as Environment || 'development';
  }
  
  getConfigPath(): string {
    const env = this.detectEnvironment();
    return `./config/qi-config.${env}.yaml`;
  }
  
  loadEnvironmentOverrides(): Partial<QiConfig> {
    // Load environment-specific overrides
  }
}
```

**Environment-Specific Files:**
```yaml
# config/qi-config.development.yaml
model:
  provider: ollama
  name: llama3.2
  temperature: 0.1

servers:
  file-server:
    transport: stdio
    command: bun
    args: ["./servers/file-server.ts"]

logging:
  level: debug
  file: "./logs/qi-agent-dev.log"

# config/qi-config.production.yaml
model:
  provider: ollama
  name: deepseek-r1
  temperature: 0.0

security:
  audit_logging: true
  rate_limiting: true

logging:
  level: info
  file: "/var/log/qi-agent.log"
```

### User vs Project Settings

**Configuration Scope Strategy:**

**User-Level Configuration:**
- **Location**: `~/.config/qi-agent/config.yaml`
- **Purpose**: Personal preferences, global settings
- **Scope**: All projects for the user
- **Examples**: Theme, keyboard shortcuts, default model

**Project-Level Configuration:**
- **Location**: `./qi-config.yaml` (project root)
- **Purpose**: Project-specific settings
- **Scope**: Current project only
- **Examples**: Server configurations, project-specific tools

**Workspace-Level Configuration:**
- **Location**: `./.qi/config.yaml` (workspace)
- **Purpose**: Team/workspace shared settings
- **Scope**: Shared across team members
- **Examples**: Coding standards, shared servers

**Configuration Resolution:**
```typescript
class ConfigResolver {
  async resolveConfig(): Promise<QiConfig> {
    const configs = await Promise.all([
      this.loadUserConfig(),
      this.loadWorkspaceConfig(),
      this.loadProjectConfig(),
      this.loadEnvironmentConfig()
    ]);
    
    return this.mergeConfigs(configs);
  }
  
  private mergeConfigs(configs: Partial<QiConfig>[]): QiConfig {
    // Deep merge with proper precedence
    return configs.reduce((merged, config) => {
      return deepMerge(merged, config);
    }, this.getDefaultConfig());
  }
}
```

## Configuration Patterns

### Zod Schema Design

**Modular Schema Architecture:**

**Base Schemas:**
```typescript
// Primitive schemas with validation
const PortSchema = z.number().int().min(1).max(65535);
const URLSchema = z.string().url();
const PathSchema = z.string().min(1);
const EnvironmentVariableSchema = z.string().regex(/^[A-Z_][A-Z0-9_]*$/);

// Common patterns
const TimeoutSchema = z.number().positive().default(30000);
const RetrySchema = z.number().int().min(0).max(10).default(3);
const LogLevelSchema = z.enum(['debug', 'info', 'warn', 'error']).default('info');
```

**Composite Schemas:**
```typescript
// Transport-specific schemas
const StdioTransportSchema = z.object({
  transport: z.literal('stdio'),
  command: z.string(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).optional(),
  cwd: PathSchema.optional(),
  timeout: TimeoutSchema
});

const HTTPTransportSchema = z.object({
  transport: z.enum(['sse', 'streamable_http']),
  url: URLSchema,
  headers: z.record(z.string()).optional(),
  timeout: TimeoutSchema,
  retryAttempts: RetrySchema
});

// Union schemas for flexibility
const TransportSchema = z.discriminatedUnion('transport', [
  StdioTransportSchema,
  HTTPTransportSchema,
  WebSocketTransportSchema
]);
```

**Advanced Schema Patterns:**
```typescript
// Conditional validation
const ModelConfigSchema = z.object({
  provider: z.enum(['ollama', 'openai', 'anthropic']),
  name: z.string(),
  apiKey: z.string().optional()
}).refine((data) => {
  // Require API key for remote providers
  if (['openai', 'anthropic'].includes(data.provider)) {
    return data.apiKey !== undefined;
  }
  return true;
}, {
  message: "API key required for remote providers",
  path: ['apiKey']
});

// Transform schemas
const ServerConfigSchema = z.object({
  enabled: z.boolean().default(true),
  transport: TransportSchema,
  healthCheck: z.object({
    enabled: z.boolean().default(false),
    interval: z.number().positive().default(30000),
    timeout: z.number().positive().default(5000)
  }).optional()
}).transform((data) => {
  // Auto-enable health check for remote transports
  if (['sse', 'streamable_http', 'websocket'].includes(data.transport.transport)) {
    data.healthCheck = data.healthCheck || { enabled: true, interval: 30000, timeout: 5000 };
  }
  return data;
});
```

### Default Configuration Strategy

**Intelligent Defaults System:**

**Default Configuration Hierarchy:**
```typescript
class DefaultConfigProvider {
  getDefaults(): QiConfig {
    return {
      version: '1.0.0',
      
      // Model defaults based on availability
      model: this.getDefaultModel(),
      
      // Server defaults - empty but with examples
      servers: this.getDefaultServers(),
      
      // UI defaults based on terminal capabilities
      ui: this.getDefaultUI(),
      
      // Security defaults - secure by default
      security: this.getSecurityDefaults(),
      
      // Logging defaults based on environment
      logging: this.getLoggingDefaults()
    };
  }
  
  private getDefaultModel(): ModelConfig {
    // Auto-detect available models
    const availableModels = this.detectAvailableModels();
    return {
      provider: 'ollama',
      name: availableModels.includes('deepseek-r1') ? 'deepseek-r1' : 'llama3.2',
      temperature: 0.1,
      maxTokens: 4000
    };
  }
}
```

**Context-Aware Defaults:**
```typescript
interface DefaultContext {
  environment: Environment;
  terminalCapabilities: TerminalCapabilities;
  systemResources: SystemResources;
  userPreferences: Partial<QiConfig>;
}

class ContextAwareDefaults {
  generateDefaults(context: DefaultContext): QiConfig {
    return {
      model: this.selectOptimalModel(context.systemResources),
      ui: this.configureUI(context.terminalCapabilities),
      logging: this.configureLogging(context.environment),
      security: this.configureSecurity(context.environment)
    };
  }
  
  private selectOptimalModel(resources: SystemResources): ModelConfig {
    if (resources.availableMemory > 16 * 1024 * 1024 * 1024) { // 16GB
      return { provider: 'ollama', name: 'deepseek-r1', temperature: 0.1 };
    } else if (resources.availableMemory > 8 * 1024 * 1024 * 1024) { // 8GB
      return { provider: 'ollama', name: 'phi-4:7b', temperature: 0.1 };
    } else {
      return { provider: 'ollama', name: 'gemma-3:2b', temperature: 0.1 };
    }
  }
}
```

### Migration Patterns

**Configuration Migration System:**

**Version-Based Migration:**
```typescript
interface ConfigMigration {
  fromVersion: string;
  toVersion: string;
  migrate(config: unknown): unknown;
  validate(config: unknown): boolean;
}

class ConfigMigrationManager {
  private migrations: ConfigMigration[] = [
    new Migration_1_0_to_1_1(),
    new Migration_1_1_to_1_2(),
    new Migration_1_2_to_2_0()
  ];
  
  async migrateConfig(config: unknown, currentVersion: string): Promise<QiConfig> {
    let migratedConfig = config;
    let version = currentVersion;
    
    for (const migration of this.migrations) {
      if (migration.fromVersion === version) {
        console.log(`Migrating config from ${migration.fromVersion} to ${migration.toVersion}`);
        migratedConfig = migration.migrate(migratedConfig);
        version = migration.toVersion;
      }
    }
    
    return QiConfigSchema.parse(migratedConfig);
  }
}
```

**Migration Examples:**
```typescript
class Migration_1_0_to_1_1 implements ConfigMigration {
  fromVersion = '1.0.0';
  toVersion = '1.1.0';
  
  migrate(config: any): any {
    // Rename 'llm' to 'model'
    if (config.llm) {
      config.model = config.llm;
      delete config.llm;
    }
    
    // Add new security section
    if (!config.security) {
      config.security = {
        auditLogging: false,
        rateLimiting: false
      };
    }
    
    config.version = this.toVersion;
    return config;
  }
  
  validate(config: any): boolean {
    return config.version === this.fromVersion;
  }
}
```

## Key API Concepts

### Configuration Loading Lifecycle

**Loading Process Architecture:**

**Phase 1: Discovery**
```typescript
class ConfigDiscovery {
  async discoverConfigs(): Promise<ConfigSource[]> {
    const sources: ConfigSource[] = [];
    
    // 1. Check for CLI config override
    const cliConfigPath = this.getCLIConfigPath();
    if (cliConfigPath) {
      sources.push(new FileConfigSource(cliConfigPath, 100));
    }
    
    // 2. Discover user config
    const userConfigPath = this.getUserConfigPath();
    if (await this.exists(userConfigPath)) {
      sources.push(new FileConfigSource(userConfigPath, 80));
    }
    
    // 3. Discover project config
    const projectConfigPath = this.getProjectConfigPath();
    if (await this.exists(projectConfigPath)) {
      sources.push(new FileConfigSource(projectConfigPath, 70));
    }
    
    // 4. Add environment variables
    sources.push(new EnvironmentConfigSource(90));
    
    // 5. Add defaults
    sources.push(new DefaultConfigSource(0));
    
    return sources.sort((a, b) => b.priority - a.priority);
  }
}
```

**Phase 2: Loading and Merging**
```typescript
class ConfigLoader {
  async loadConfig(): Promise<QiConfig> {
    const sources = await this.discovery.discoverConfigs();
    const configs: Partial<QiConfig>[] = [];
    
    for (const source of sources) {
      try {
        const config = await source.load();
        configs.push(config);
      } catch (error) {
        console.warn(`Failed to load config from ${source.name}:`, error);
      }
    }
    
    // Deep merge configurations
    const merged = this.deepMerge(...configs);
    
    // Migrate if necessary
    const migrated = await this.migrationManager.migrate(merged);
    
    // Validate final configuration
    return QiConfigSchema.parse(migrated);
  }
}
```

### Validation Patterns

**Multi-Level Validation:**

**Schema Validation:**
```typescript
class ConfigValidator {
  validateSchema(config: unknown): ValidationResult {
    try {
      const validated = QiConfigSchema.parse(config);
      return { success: true, data: validated };
    } catch (error) {
      return { 
        success: false, 
        errors: this.formatZodErrors(error) 
      };
    }
  }
  
  private formatZodErrors(error: ZodError): ValidationError[] {
    return error.errors.map(err => ({
      path: err.path.join('.'),
      message: err.message,
      code: err.code,
      value: err.received
    }));
  }
}
```

**Business Logic Validation:**
```typescript
class BusinessConfigValidator {
  async validateBusinessRules(config: QiConfig): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    
    // Validate server connectivity
    for (const [name, server] of Object.entries(config.servers)) {
      try {
        await this.validateServerConfig(name, server);
      } catch (error) {
        errors.push({
          path: `servers.${name}`,
          message: `Server validation failed: ${error.message}`,
          code: 'server_unreachable'
        });
      }
    }
    
    // Validate model availability
    try {
      await this.validateModelConfig(config.model);
    } catch (error) {
      errors.push({
        path: 'model',
        message: `Model validation failed: ${error.message}`,
        code: 'model_unavailable'
      });
    }
    
    return errors.length === 0 
      ? { success: true, data: config }
      : { success: false, errors };
  }
}
```

### Type Safety Implementation

**Type-Safe Configuration Access:**

**Configuration Proxy:**
```typescript
class TypeSafeConfigProxy {
  constructor(private config: QiConfig) {}
  
  get<K extends keyof QiConfig>(key: K): QiConfig[K] {
    return this.config[key];
  }
  
  getModel(): ModelConfig {
    return this.config.model;
  }
  
  getServer(name: string): ServerConfig | undefined {
    return this.config.servers[name];
  }
  
  getUIConfig(): UIConfig {
    return this.config.ui;
  }
  
  // Type-safe updates
  updateModel<K extends keyof ModelConfig>(
    key: K, 
    value: ModelConfig[K]
  ): void {
    this.config.model[key] = value;
  }
}
```

**Configuration Builder Pattern:**
```typescript
class ConfigBuilder {
  private config: Partial<QiConfig> = {};
  
  withModel(model: ModelConfig): this {
    this.config.model = model;
    return this;
  }
  
  withServer(name: string, server: ServerConfig): this {
    this.config.servers = { ...this.config.servers, [name]: server };
    return this;
  }
  
  withUI(ui: UIConfig): this {
    this.config.ui = ui;
    return this;
  }
  
  build(): QiConfig {
    return QiConfigSchema.parse(this.config);
  }
}

// Usage
const config = new ConfigBuilder()
  .withModel({ provider: 'ollama', name: 'deepseek-r1', temperature: 0.1 })
  .withServer('file-server', { transport: 'stdio', command: 'bun' })
  .build();
```

## Configuration UI Integration

### Interactive Configuration

**Configuration Management Interface:**

**CLI Configuration Commands:**
```typescript
interface ConfigCLI {
  // View configuration
  show(path?: string): void;
  
  // Update configuration
  set(path: string, value: string): void;
  get(path: string): void;
  
  // Manage servers
  addServer(name: string, config: ServerConfig): void;
  removeServer(name: string): void;
  listServers(): void;
  
  // Model management
  setModel(provider: string, name: string): void;
  listModels(): void;
  
  // Configuration validation
  validate(): void;
  migrate(): void;
}
```

**Interactive Configuration Wizard:**
```typescript
class ConfigWizard {
  async runWizard(): Promise<QiConfig> {
    console.log('🎯 Qi Agent Configuration Wizard');
    
    // Model selection
    const model = await this.selectModel();
    
    // Server setup
    const servers = await this.setupServers();
    
    // UI preferences
    const ui = await this.configureUI();
    
    // Security settings
    const security = await this.configureSecurity();
    
    const config = new ConfigBuilder()
      .withModel(model)
      .withServers(servers)
      .withUI(ui)
      .withSecurity(security)
      .build();
    
    // Save configuration
    await this.saveConfig(config);
    
    return config;
  }
}
```

### Configuration Validation UI

**Validation Feedback System:**

**Real-time Validation:**
```typescript
class ConfigValidationUI {
  showValidationResults(results: ValidationResult): void {
    if (results.success) {
      console.log('✅ Configuration is valid');
      return;
    }
    
    console.log('❌ Configuration validation failed:');
    for (const error of results.errors) {
      console.log(`  • ${error.path}: ${error.message}`);
    }
    
    // Provide suggestions
    this.showSuggestions(results.errors);
  }
  
  private showSuggestions(errors: ValidationError[]): void {
    const suggestions = this.generateSuggestions(errors);
    if (suggestions.length > 0) {
      console.log('\n💡 Suggestions:');
      suggestions.forEach(suggestion => {
        console.log(`  • ${suggestion}`);
      });
    }
  }
}
```

## Performance Considerations

### Configuration Caching

**Multi-Level Caching Strategy:**

**In-Memory Caching:**
```typescript
class ConfigCache {
  private cache = new Map<string, CacheEntry>();
  private ttl = 5 * 60 * 1000; // 5 minutes
  
  get(key: string): QiConfig | undefined {
    const entry = this.cache.get(key);
    if (entry && Date.now() - entry.timestamp < this.ttl) {
      return entry.config;
    }
    this.cache.delete(key);
    return undefined;
  }
  
  set(key: string, config: QiConfig): void {
    this.cache.set(key, {
      config,
      timestamp: Date.now()
    });
  }
  
  invalidate(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
}
```

**File System Caching:**
```typescript
class FileSystemConfigCache {
  private cacheDir = path.join(os.homedir(), '.cache', 'qi-agent');
  
  async getCacheKey(configPaths: string[]): Promise<string> {
    const stats = await Promise.all(
      configPaths.map(path => fs.stat(path).catch(() => null))
    );
    
    const mtimes = stats
      .filter(stat => stat !== null)
      .map(stat => stat!.mtime.getTime());
    
    return crypto
      .createHash('sha256')
      .update(JSON.stringify({ configPaths, mtimes }))
      .digest('hex');
  }
  
  async getCachedConfig(cacheKey: string): Promise<QiConfig | null> {
    const cachePath = path.join(this.cacheDir, `${cacheKey}.json`);
    try {
      const data = await fs.readFile(cachePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
}
```

### Configuration Loading Performance

**Optimized Loading Strategies:**

**Parallel Loading:**
```typescript
class OptimizedConfigLoader {
  async loadConfigOptimized(): Promise<QiConfig> {
    const sources = await this.discovery.discoverConfigs();
    
    // Load configurations in parallel
    const configPromises = sources.map(async source => ({
      priority: source.priority,
      config: await source.load().catch(() => null)
    }));
    
    const results = await Promise.all(configPromises);
    
    // Filter out failed loads and sort by priority
    const configs = results
      .filter(result => result.config !== null)
      .sort((a, b) => b.priority - a.priority)
      .map(result => result.config!);
    
    return this.mergeAndValidate(configs);
  }
}
```

**Lazy Loading:**
```typescript
class LazyConfigManager {
  private configPromise: Promise<QiConfig> | null = null;
  
  getConfig(): Promise<QiConfig> {
    if (!this.configPromise) {
      this.configPromise = this.loadConfig();
    }
    return this.configPromise;
  }
  
  invalidateConfig(): void {
    this.configPromise = null;
  }
}
```

## Security Considerations

### Configuration Security

**Secrets Management:**

**Environment Variable Strategy:**
```typescript
class SecretsManager {
  resolveSecrets(config: QiConfig): QiConfig {
    return this.deepResolveSecrets(config);
  }
  
  private deepResolveSecrets(obj: any): any {
    if (typeof obj === 'string') {
      return this.resolveSecret(obj);
    } else if (Array.isArray(obj)) {
      return obj.map(item => this.deepResolveSecrets(item));
    } else if (obj && typeof obj === 'object') {
      const resolved: any = {};
      for (const [key, value] of Object.entries(obj)) {
        resolved[key] = this.deepResolveSecrets(value);
      }
      return resolved;
    }
    return obj;
  }
  
  private resolveSecret(value: string): string {
    // Resolve ${ENV_VAR} patterns
    return value.replace(/\$\{([^}]+)\}/g, (match, envVar) => {
      const envValue = process.env[envVar];
      if (envValue === undefined) {
        throw new Error(`Environment variable ${envVar} not found`);
      }
      return envValue;
    });
  }
}
```

**Configuration Encryption:**
```typescript
class EncryptedConfigManager {
  private cipher = 'aes-256-gcm';
  private keyDerivation = 'pbkdf2';
  
  async encryptConfig(config: QiConfig, password: string): Promise<string> {
    const key = await this.deriveKey(password);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.cipher, key);
    
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(config), 'utf-8'),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }
  
  async decryptConfig(encryptedData: string, password: string): Promise<QiConfig> {
    const key = await this.deriveKey(password);
    const data = Buffer.from(encryptedData, 'base64');
    
    const iv = data.slice(0, 16);
    const authTag = data.slice(16, 32);
    const encrypted = data.slice(32);
    
    const decipher = crypto.createDecipher(this.cipher, key);
    decipher.setAuthTag(authTag);
    
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    return QiConfigSchema.parse(JSON.parse(decrypted.toString('utf-8')));
  }
}
```

## Testing Strategy

### Configuration Testing

**Test Categories:**

**Schema Validation Tests:**
```typescript
describe('QiConfigSchema', () => {
  it('should validate valid configuration', () => {
    const validConfig = {
      version: '1.0.0',
      model: { provider: 'ollama', name: 'deepseek-r1', temperature: 0.1 },
      servers: {},
      ui: {},
      security: {}
    };
    
    expect(() => QiConfigSchema.parse(validConfig)).not.toThrow();
  });
  
  it('should reject invalid model temperature', () => {
    const invalidConfig = {
      model: { provider: 'ollama', name: 'test', temperature: 3.0 }
    };
    
    expect(() => QiConfigSchema.parse(invalidConfig)).toThrow();
  });
});
```

**Integration Tests:**
```typescript
describe('ConfigManager', () => {
  it('should merge configurations correctly', async () => {
    const manager = new ConfigManager();
    
    // Mock configuration sources
    const userConfig = { model: { temperature: 0.2 } };
    const projectConfig = { servers: { 'test-server': { transport: 'stdio' } } };
    
    const merged = await manager.mergeConfigs([userConfig, projectConfig]);
    
    expect(merged.model.temperature).toBe(0.2);
    expect(merged.servers['test-server']).toBeDefined();
  });
});
```

### Migration Testing

**Migration Test Strategy:**
```typescript
describe('ConfigMigration', () => {
  it('should migrate from v1.0 to v1.1', () => {
    const v1Config = {
      version: '1.0.0',
      llm: { provider: 'ollama', name: 'test' }
    };
    
    const migration = new Migration_1_0_to_1_1();
    const migrated = migration.migrate(v1Config);
    
    expect(migrated.version).toBe('1.1.0');
    expect(migrated.model).toBeDefined();
    expect(migrated.llm).toBeUndefined();
  });
});
```

## Next Steps

After completing T7 configuration management architecture:

1. **Proceed to T8**: [Security Implementation](./T8-security.md) for 2025 security practices
2. **Implement Core Configuration**: Build basic configuration loading and validation
3. **Add Configuration UI**: Create interactive configuration management
4. **Test Migration System**: Implement and test configuration migrations

This T7 implementation guide provides the architectural foundation for a robust, type-safe configuration management system that supports complex hierarchical configurations, runtime updates, and seamless migration while maintaining security and performance standards.