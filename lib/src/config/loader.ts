import { readFileSync } from 'node:fs';
import * as YAML from 'js-yaml';
import { QiConfigSchema, type QiConfig } from './schema.js';

export class ConfigLoader {
  private configPath: string;

  constructor(configPath: string = './config/qi-config.yaml') {
    this.configPath = configPath;
  }

  loadConfig(): QiConfig {
    try {
      const configFile = readFileSync(this.configPath, 'utf-8');
      const rawConfig = YAML.load(configFile);
      
      // Environment variable substitution
      const processedConfig = this.substituteEnvVars(rawConfig);
      
      // Validate with Zod
      const config = QiConfigSchema.parse(processedConfig);
      
      console.log('✅ Configuration loaded successfully');
      return config;
      
    } catch (error) {
      console.error('❌ Configuration error:', error);
      throw new Error(`Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  getDefaultConfig(): QiConfig {
    return QiConfigSchema.parse({
      model: {
        name: 'deepseek-r1',
        temperature: 0.1,
        baseUrl: 'http://localhost:11434',
        thinkingEnabled: true,
      },
      mcp: {
        servers: {},
      },
      memory: {
        enabled: true,
        type: 'memory',
      },
      ui: {
        theme: 'dark',
        showTimestamps: true,
        progressIndicators: true,
      },
    });
  }

  private substituteEnvVars(obj: unknown): unknown {
    if (typeof obj === 'string') {
      return obj.replace(/\$\{([^}]+)\}/g, (_, varName) => {
        return process.env[varName] || '';
      });
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => this.substituteEnvVars(item));
    }
    if (obj && typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.substituteEnvVars(value);
      }
      return result;
    }
    return obj;
  }

  validateConfig(config: unknown): QiConfig {
    return QiConfigSchema.parse(config);
  }
}