import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { ConfigLoader } from '@qi/agent/config/loader';

describe('ConfigLoader', () => {
  const testConfigPath = './test-config.yaml';

  afterEach(() => {
    // Clean up test config file
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
  });

  describe('loadConfig', () => {
    it('should load valid configuration successfully', () => {
      const validConfig = `
model:
  name: "test-model"
  temperature: 0.5
  baseUrl: "http://localhost:11434"
  thinkingEnabled: false
mcp:
  servers:
    test-server:
      transport: stdio
      command: "echo"
      args: ["hello"]
memory:
  enabled: true
  type: "memory"
ui:
  theme: "light"
  showTimestamps: false
  progressIndicators: true
`;

      writeFileSync(testConfigPath, validConfig);
      const configLoader = new ConfigLoader(testConfigPath);
      const config = configLoader.loadConfig();
      
      expect(config.model.name).toBe('test-model');
      expect(config.model.temperature).toBe(0.5);
      expect(config.model.thinkingEnabled).toBe(false);
      expect(config.ui.theme).toBe('light');
      expect(config.mcp.servers['test-server'].transport).toBe('stdio');
    });

    it('should handle environment variable substitution', () => {
      process.env.TEST_MODEL = 'env-model';
      process.env.TEST_URL = 'http://localhost:9999';
      
      const configWithEnv = `
model:
  name: "\${TEST_MODEL}"
  temperature: 0.1
  baseUrl: "\${TEST_URL}"
  thinkingEnabled: true
mcp:
  servers: {}
memory:
  enabled: true
  type: "memory"
ui:
  theme: "dark"
  showTimestamps: true
  progressIndicators: true
`;

      writeFileSync(testConfigPath, configWithEnv);
      const configLoader = new ConfigLoader(testConfigPath);
      const config = configLoader.loadConfig();
      
      expect(config.model.name).toBe('env-model');
      expect(config.model.baseUrl).toBe('http://localhost:9999');
      
      delete process.env.TEST_MODEL;
      delete process.env.TEST_URL;
    });

    it('should throw error for invalid configuration', () => {
      const invalidConfig = `
model:
  name: "test"
  temperature: 5.0  # Invalid: temperature must be <= 2
  baseUrl: "invalid-url"  # Invalid: not a valid URL
mcp:
  servers: {}
memory:
  enabled: true
  type: "memory"
ui:
  theme: "dark"
  showTimestamps: true
  progressIndicators: true
`;

      writeFileSync(testConfigPath, invalidConfig);
      const configLoader = new ConfigLoader(testConfigPath);
      
      expect(() => configLoader.loadConfig()).toThrow();
    });

    it('should provide default configuration', () => {
      const configLoader = new ConfigLoader();
      const defaultConfig = configLoader.getDefaultConfig();
      
      expect(defaultConfig.model.name).toBe('deepseek-r1');
      expect(defaultConfig.model.temperature).toBe(0.1);
      expect(defaultConfig.model.thinkingEnabled).toBe(true);
      expect(defaultConfig.memory.enabled).toBe(true);
      expect(defaultConfig.ui.theme).toBe('dark');
    });
  });
});