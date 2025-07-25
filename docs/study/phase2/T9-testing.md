# T9: Testing Strategy - Vitest + Bun Testing Guide

## Overview

This guide covers the design and implementation of a comprehensive testing strategy for the Qi V2 Agent using Vitest and Bun. The architecture addresses unit testing, integration testing, end-to-end testing, and performance testing while leveraging modern TypeScript patterns and the performance benefits of the Bun runtime.

## Architecture Decisions

### Testing Pyramid Strategy

**Recommended Testing Distribution:**

```
    E2E Tests (5%)
    ├─ Full user workflows
    ├─ Cross-system integration
    └─ Critical path validation

  Integration Tests (20%)
  ├─ Agent + MCP server integration
  ├─ UI component integration  
  ├─ Configuration system tests
  └─ Security feature tests

Unit Tests (75%)
├─ Pure function testing
├─ Component testing
├─ Service layer testing
└─ Utility function testing
```

**Testing Level Definitions:**

**Unit Tests:**
- **Scope**: Individual functions, classes, or components
- **Dependencies**: Mocked or stubbed
- **Speed**: <100ms per test
- **Coverage**: 90%+ for critical business logic

**Integration Tests:**
- **Scope**: Multiple components working together
- **Dependencies**: Real implementations where possible
- **Speed**: <5s per test suite
- **Coverage**: Critical integration points

**End-to-End Tests:**
- **Scope**: Complete user workflows
- **Dependencies**: Real systems and external services
- **Speed**: <30s per test
- **Coverage**: Happy path and critical error scenarios

### Test Boundaries and Isolation

**Unit Test Boundaries:**

```typescript
// Good unit test boundaries
interface TestBoundaries {
  // Pure business logic
  businessLogic: {
    functions: 'pure functions with deterministic outputs';
    algorithms: 'mathematical or logical computations';
    transformations: 'data transformation logic';
  };
  
  // Component behavior
  components: {
    rendering: 'component output for given props';
    interactions: 'event handling and state changes';
    lifecycle: 'component lifecycle behavior';
  };
  
  // Service layer
  services: {
    interfaces: 'service method contracts';
    errorHandling: 'error scenarios and recovery';
    validation: 'input validation logic';
  };
}
```

**Integration Test Boundaries:**

```typescript
interface IntegrationBoundaries {
  // System integration
  agentIntegration: {
    mcpServers: 'agent communication with MCP servers';
    llmProviders: 'model provider integrations';
    configurationLoading: 'configuration system integration';
  };
  
  // External service integration
  externalServices: {
    ollamaIntegration: 'Ollama service communication';
    fileSystemOperations: 'file system interactions';
    networkRequests: 'HTTP/WebSocket communications';
  };
  
  // UI integration
  uiIntegration: {
    userWorkflows: 'complete user interaction flows';
    dataFlow: 'data flow from input to display';
    errorStates: 'error handling in UI';
  };
}
```

### Mock Strategy Framework

**Mocking Decision Matrix:**

| Component Type | Mock Strategy | Rationale |
|----------------|---------------|-----------|
| **Pure Functions** | No Mocking | Deterministic, fast execution |
| **External APIs** | Mock/Stub | Unreliable, slow, expensive |
| **File System** | Mock/Fake | Side effects, test isolation |
| **Network** | Mock/Intercept | Unreliable, external dependencies |
| **Time/Dates** | Mock | Non-deterministic, test stability |
| **Random Values** | Mock | Non-deterministic testing |
| **Database** | In-Memory/Fake | Side effects, test isolation |

**Mock Implementation Patterns:**

```typescript
// Service mocking pattern
interface MockStrategy<T> {
  createMock(): T;
  createStub(behavior: Partial<T>): T;
  createSpy(implementation?: Partial<T>): T;
}

class MCPServerMockFactory implements MockStrategy<MCPServer> {
  createMock(): MCPServer {
    return {
      connect: vi.fn().mockResolvedValue(true),
      disconnect: vi.fn().mockResolvedValue(undefined),
      listTools: vi.fn().mockResolvedValue([]),
      executeTool: vi.fn().mockResolvedValue({ success: true, result: {} }),
      isConnected: vi.fn().mockReturnValue(true)
    } as MCPServer;
  }
  
  createStub(behavior: Partial<MCPServer>): MCPServer {
    const mock = this.createMock();
    return { ...mock, ...behavior };
  }
  
  createSpy(implementation?: Partial<MCPServer>): MCPServer {
    const mock = this.createMock();
    if (implementation) {
      Object.assign(mock, implementation);
    }
    return mock;
  }
}
```

### Test Environment Setup

**Multi-Environment Testing Configuration:**

```typescript
interface TestEnvironment {
  name: string;
  setup(): Promise<void>;
  teardown(): Promise<void>;
  config: TestConfig;
}

interface TestConfig {
  // Vitest configuration
  vitest: {
    environment: 'node' | 'jsdom' | 'happy-dom';
    globals: boolean;
    setupFiles: string[];
    coverage: CoverageConfig;
  };
  
  // Test data configuration
  data: {
    fixtures: string;
    mocks: string;
    seeds: string;
  };
  
  // External service configuration
  services: {
    ollama: {
      baseUrl: string;
      testModel: string;
      timeout: number;
    };
    
    testServers: {
      autoStart: boolean;
      ports: number[];
      timeout: number;
    };
  };
  
  // Performance configuration
  performance: {
    timeouts: {
      unit: number;
      integration: number;
      e2e: number;
    };
    
    thresholds: {
      coverage: number;
      performance: number;
    };
  };
}
```

**Environment Management:**

```typescript
class TestEnvironmentManager {
  private environments: Map<string, TestEnvironment> = new Map();
  
  async setupEnvironment(name: string): Promise<void> {
    const env = this.environments.get(name);
    if (!env) {
      throw new Error(`Unknown test environment: ${name}`);
    }
    
    // Setup test database/services
    await this.setupTestServices(env.config);
    
    // Load test fixtures
    await this.loadTestFixtures(env.config.data);
    
    // Configure test environment
    await env.setup();
  }
  
  async teardownEnvironment(name: string): Promise<void> {
    const env = this.environments.get(name);
    if (env) {
      await env.teardown();
      await this.cleanupTestServices();
    }
  }
}
```

## Integration Strategies

### Agent Testing Patterns

**Agent Integration Testing Architecture:**

```typescript
interface AgentTestHarness {
  agent: QiAgent;
  mockServers: Map<string, MockMCPServer>;
  testModel: MockLLMModel;
  eventCollector: EventCollector;
}

class AgentTestBuilder {
  private config: Partial<QiAgentConfig> = {};
  private serverMocks: Map<string, MockMCPServer> = new Map();
  
  withMockServer(name: string, mock: MockMCPServer): this {
    this.serverMocks.set(name, mock);
    return this;
  }
  
  withTestModel(model: string = 'test-model'): this {
    this.config.model = {
      provider: 'test',
      name: model,
      temperature: 0,
      maxTokens: 100
    };
    return this;
  }
  
  withConfiguration(config: Partial<QiAgentConfig>): this {
    this.config = { ...this.config, ...config };
    return this;
  }
  
  async build(): Promise<AgentTestHarness> {
    // Create test configuration
    const testConfig = this.createTestConfig();
    
    // Initialize agent with mocks
    const agent = new QiAgent(testConfig);
    await agent.initialize();
    
    // Setup event collection
    const eventCollector = new EventCollector();
    agent.on('*', eventCollector.collect.bind(eventCollector));
    
    return {
      agent,
      mockServers: this.serverMocks,
      testModel: this.createTestModel(),
      eventCollector
    };
  }
}
```

**Agent Behavior Testing:**

```typescript
describe('Agent Integration', () => {
  let testHarness: AgentTestHarness;
  
  beforeEach(async () => {
    testHarness = await new AgentTestBuilder()
      .withMockServer('file-server', new MockFileServer())
      .withMockServer('calc-server', new MockCalculatorServer())
      .withTestModel('test-llm')
      .build();
  });
  
  afterEach(async () => {
    await testHarness.agent.cleanup();
  });
  
  it('should execute tools through MCP servers', async () => {
    // Arrange
    const fileServer = testHarness.mockServers.get('file-server')!;
    fileServer.addFile('/test.txt', 'test content');
    
    // Act
    const response = await testHarness.agent.processMessage({
      role: 'user',
      content: 'Read the contents of /test.txt'
    });
    
    // Assert
    expect(response.content).toContain('test content');
    expect(fileServer.readFile).toHaveBeenCalledWith('/test.txt');
  });
  
  it('should handle server failures gracefully', async () => {
    // Arrange
    const calcServer = testHarness.mockServers.get('calc-server')!;
    calcServer.calculate.mockRejectedValue(new Error('Server unavailable'));
    
    // Act
    const response = await testHarness.agent.processMessage({
      role: 'user',
      content: 'Calculate 2 + 2'
    });
    
    // Assert
    expect(response.content).toContain('calculator is unavailable');
    expect(testHarness.eventCollector.getEvents('error')).toHaveLength(1);
  });
});
```

### MCP Server Mocking

**Comprehensive MCP Server Mocking:**

```typescript
class MockMCPServer {
  private tools: Map<string, MockTool> = new Map();
  private connected = false;
  private connectionDelay = 0;
  
  // Mock tool registration
  addTool(name: string, tool: MockTool): void {
    this.tools.set(name, tool);
  }
  
  // Simulate connection behavior
  setConnectionDelay(ms: number): void {
    this.connectionDelay = ms;
  }
  
  simulateConnectionFailure(): void {
    this.connected = false;
  }
  
  // MCP protocol implementation
  async connect(): Promise<void> {
    if (this.connectionDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.connectionDelay));
    }
    
    if (!this.connected) {
      throw new Error('Connection failed');
    }
  }
  
  async listTools(): Promise<ToolDefinition[]> {
    return Array.from(this.tools.entries()).map(([name, tool]) => ({
      name,
      description: tool.description,
      parameters: tool.parameters
    }));
  }
  
  async executeTool(name: string, parameters: any): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }
    
    return await tool.execute(parameters);
  }
}

interface MockTool {
  description: string;
  parameters: Record<string, any>;
  execute(parameters: any): Promise<ToolResult>;
}

class MockFileServer extends MockMCPServer {
  private files: Map<string, string> = new Map();
  
  constructor() {
    super();
    this.setupFileTools();
  }
  
  private setupFileTools(): void {
    this.addTool('read_file', {
      description: 'Read file contents',
      parameters: {
        path: { type: 'string', required: true }
      },
      execute: async (params) => {
        const content = this.files.get(params.path);
        if (!content) {
          throw new Error(`File not found: ${params.path}`);
        }
        return { success: true, content };
      }
    });
    
    this.addTool('write_file', {
      description: 'Write file contents',
      parameters: {
        path: { type: 'string', required: true },
        content: { type: 'string', required: true }
      },
      execute: async (params) => {
        this.files.set(params.path, params.content);
        return { success: true, message: 'File written successfully' };
      }
    });
  }
  
  // Test helper methods
  addFile(path: string, content: string): void {
    this.files.set(path, content);
  }
  
  getFile(path: string): string | undefined {
    return this.files.get(path);
  }
  
  getFiles(): Map<string, string> {
    return new Map(this.files);
  }
}
```

### UI Component Testing

**Ink Component Testing Strategy:**

```typescript
interface UITestRenderer {
  render(component: React.ComponentType<any>, props?: any): RenderResult;
  rerender(component: React.ComponentType<any>, props?: any): void;
  unmount(): void;
  getOutput(): string;
  findByText(text: string | RegExp): HTMLElement | null;
  findByRole(role: string): HTMLElement | null;
}

class InkTestRenderer implements UITestRenderer {
  private instance: any;
  private lastOutput = '';
  
  render(component: React.ComponentType<any>, props = {}): RenderResult {
    const { render } = require('ink-testing-library');
    this.instance = render(React.createElement(component, props));
    this.lastOutput = this.instance.lastFrame();
    
    return {
      container: this.instance,
      output: this.lastOutput,
      rerender: this.rerender.bind(this),
      unmount: this.unmount.bind(this)
    };
  }
  
  rerender(component: React.ComponentType<any>, props = {}): void {
    this.instance.rerender(React.createElement(component, props));
    this.lastOutput = this.instance.lastFrame();
  }
  
  getOutput(): string {
    return this.instance.lastFrame();
  }
  
  findByText(text: string | RegExp): HTMLElement | null {
    const output = this.getOutput();
    const pattern = typeof text === 'string' ? text : text.source;
    return output.includes(pattern) ? ({ textContent: output } as any) : null;
  }
}
```

**Component Testing Examples:**

```typescript
describe('ConversationView Component', () => {
  let renderer: InkTestRenderer;
  
  beforeEach(() => {
    renderer = new InkTestRenderer();
  });
  
  afterEach(() => {
    renderer.unmount();
  });
  
  it('should display conversation messages', () => {
    // Arrange
    const messages = [
      { role: 'user', content: 'Hello', timestamp: new Date() },
      { role: 'assistant', content: 'Hi there!', timestamp: new Date() }
    ];
    
    // Act
    const { output } = renderer.render(ConversationView, { messages });
    
    // Assert
    expect(output).toContain('Hello');
    expect(output).toContain('Hi there!');
  });
  
  it('should show streaming indicator during response', () => {
    // Arrange
    const messages = [
      { role: 'user', content: 'Test', timestamp: new Date() }
    ];
    
    // Act
    const { output } = renderer.render(ConversationView, { 
      messages, 
      isStreaming: true 
    });
    
    // Assert
    expect(output).toContain('...');  // Streaming indicator
  });
  
  it('should handle keyboard shortcuts', async () => {
    // Arrange
    const onClear = vi.fn();
    
    // Act
    renderer.render(ConversationView, { 
      messages: [],
      onClear
    });
    
    // Simulate Ctrl+L
    await userEvent.keyboard('{Control>}l{/Control}');
    
    // Assert
    expect(onClear).toHaveBeenCalled();
  });
});
```

## Configuration Patterns

### Test Configuration Management

**Hierarchical Test Configuration:**

```typescript
interface TestConfiguration {
  // Environment configuration
  environment: {
    name: string;
    isolationLevel: 'process' | 'thread' | 'suite' | 'test';
    cleanupStrategy: 'immediate' | 'batched' | 'end_of_suite';
  };
  
  // Mock configuration
  mocks: {
    external_services: boolean;
    file_system: boolean;
    network_requests: boolean;
    time_functions: boolean;
  };
  
  // Test data configuration
  data: {
    fixtures_path: string;
    seed_data: boolean;
    cleanup_data: boolean;
    snapshot_path: string;
  };
  
  // Performance configuration
  performance: {
    timeouts: {
      unit_test: number;
      integration_test: number;
      e2e_test: number;
    };
    
    parallel_workers: number;
    memory_limit: string;
    cpu_limit: string;
  };
  
  // Coverage configuration
  coverage: {
    enabled: boolean;
    threshold: {
      global: number;
      functions: number;
      branches: number;
      lines: number;
    };
    
    exclude: string[];
    include: string[];
    reporter: string[];
  };
}
```

**Dynamic Test Configuration:**

```typescript
class TestConfigManager {
  private configs: Map<string, TestConfiguration> = new Map();
  
  async loadConfiguration(env: string): Promise<TestConfiguration> {
    // Load base configuration
    const baseConfig = await this.loadBaseConfig();
    
    // Load environment-specific overrides
    const envConfig = await this.loadEnvironmentConfig(env);
    
    // Merge configurations
    const merged = this.mergeConfigs(baseConfig, envConfig);
    
    // Apply runtime overrides
    const final = this.applyRuntimeOverrides(merged);
    
    return final;
  }
  
  private async detectOptimalConfiguration(): Promise<Partial<TestConfiguration>> {
    const systemInfo = await this.getSystemInfo();
    
    return {
      performance: {
        parallel_workers: Math.min(systemInfo.cpuCores - 1, 8),
        memory_limit: `${Math.floor(systemInfo.totalMemory * 0.7)}MB`,
        timeouts: {
          unit_test: systemInfo.isCI ? 10000 : 5000,
          integration_test: systemInfo.isCI ? 30000 : 15000,
          e2e_test: systemInfo.isCI ? 120000 : 60000
        }
      }
    };
  }
}
```

### Coverage Requirements

**Coverage Strategy Framework:**

```typescript
interface CoverageRequirements {
  global: {
    minimum: number;
    target: number;
    enforced: boolean;
  };
  
  perComponent: {
    critical: { minimum: 95; target: 100 };
    business_logic: { minimum: 90; target: 95 };
    ui_components: { minimum: 80; target: 90 };
    utilities: { minimum: 85; target: 95 };
    configuration: { minimum: 75; target: 85 };
  };
  
  exclusions: {
    test_files: string[];
    generated_files: string[];
    vendor_code: string[];
    deprecated_code: string[];
  };
  
  reporting: {
    formats: ['html', 'lcov', 'json', 'text'];
    output_directory: string;
    include_untested: boolean;
    branch_coverage: boolean;
  };
}

class CoverageAnalyzer {
  async analyzeCoverage(
    coverageData: CoverageData
  ): Promise<CoverageAnalysis> {
    const analysis: CoverageAnalysis = {
      overall: this.calculateOverallCoverage(coverageData),
      byComponent: this.analyzeComponentCoverage(coverageData),
      gaps: this.identifyGaps(coverageData),
      recommendations: this.generateRecommendations(coverageData)
    };
    
    return analysis;
  }
  
  private identifyGaps(coverageData: CoverageData): CoverageGap[] {
    const gaps: CoverageGap[] = [];
    
    // Identify uncovered critical paths
    const criticalPaths = this.identifyCriticalPaths(coverageData);
    for (const path of criticalPaths) {
      if (path.coverage < 95) {
        gaps.push({
          type: 'critical_path',
          path: path.file,
          lines: path.uncoveredLines,
          priority: 'high',
          impact: 'potential system failure'
        });
      }
    }
    
    // Identify uncovered error handling
    const errorHandlers = this.identifyErrorHandlers(coverageData);
    for (const handler of errorHandlers) {
      if (handler.coverage < 80) {
        gaps.push({
          type: 'error_handling',
          path: handler.file,
          lines: handler.uncoveredLines,
          priority: 'medium',
          impact: 'poor error recovery'
        });
      }
    }
    
    return gaps;
  }
}
```

### CI/CD Integration

**Continuous Integration Testing Strategy:**

```typescript
interface CIPipeline {
  stages: CIStage[];
  triggers: CITrigger[];
  artifacts: CIArtifact[];
  notifications: CINotification[];
}

interface CIStage {
  name: string;
  dependencies: string[];
  timeout: number;
  retries: number;
  parallel: boolean;
  steps: CIStep[];
}

interface CIStep {
  name: string;
  command: string;
  environment: Record<string, string>;
  artifacts: string[];
  conditions: CICondition[];
}

const testingPipeline: CIPipeline = {
  stages: [
    {
      name: 'code_quality',
      dependencies: [],
      timeout: 300,
      retries: 1,
      parallel: true,
      steps: [
        {
          name: 'lint',
          command: 'bun run lint',
          environment: {},
          artifacts: ['lint-results.json'],
          conditions: []
        },
        {
          name: 'type_check',
          command: 'bun run type-check',
          environment: {},
          artifacts: ['type-check-results.json'],
          conditions: []
        }
      ]
    },
    
    {
      name: 'unit_tests',
      dependencies: ['code_quality'],
      timeout: 600,
      retries: 2,
      parallel: false,
      steps: [
        {
          name: 'run_unit_tests',
          command: 'bun run test:unit --coverage',
          environment: { NODE_ENV: 'test' },
          artifacts: ['coverage/', 'test-results.xml'],
          conditions: [
            { type: 'coverage_threshold', value: 80 }
          ]
        }
      ]
    },
    
    {
      name: 'integration_tests',
      dependencies: ['unit_tests'],
      timeout: 1800,
      retries: 2,
      parallel: false,
      steps: [
        {
          name: 'start_test_services',
          command: 'bun run test:start-services',
          environment: {},
          artifacts: [],
          conditions: []
        },
        {
          name: 'run_integration_tests',
          command: 'bun run test:integration',
          environment: { TEST_SERVICES_RUNNING: 'true' },
          artifacts: ['integration-test-results.xml'],
          conditions: []
        }
      ]
    }
  ],
  
  triggers: [
    { type: 'push', branches: ['main', 'develop'] },
    { type: 'pull_request', target_branches: ['main'] },
    { type: 'schedule', cron: '0 2 * * *' }  // Nightly builds
  ],
  
  artifacts: [
    { name: 'test_reports', path: 'test-results/', retention: 30 },
    { name: 'coverage_reports', path: 'coverage/', retention: 90 }
  ],
  
  notifications: [
    { type: 'email', recipients: ['team@example.com'], on: ['failure'] },
    { type: 'slack', channel: '#ci-notifications', on: ['failure', 'success'] }
  ]
};
```

## Key API Concepts

### Vitest Patterns

**Advanced Vitest Testing Patterns:**

```typescript
// Custom test utilities
export const testUtils = {
  // Async testing helpers
  waitFor: async (condition: () => boolean, timeout = 5000): Promise<void> => {
    const start = Date.now();
    while (!condition() && Date.now() - start < timeout) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    if (!condition()) {
      throw new Error(`Condition not met within ${timeout}ms`);
    }
  },
  
  // Mock factories
  createMockAgent: (overrides?: Partial<QiAgent>): QiAgent => {
    return {
      initialize: vi.fn().mockResolvedValue(undefined),
      processMessage: vi.fn().mockResolvedValue({ role: 'assistant', content: 'test' }),
      getAvailableTools: vi.fn().mockResolvedValue([]),
      cleanup: vi.fn().mockResolvedValue(undefined),
      ...overrides
    } as QiAgent;
  },
  
  // Test data generators
  generateMessage: (overrides?: Partial<Message>): Message => ({
    id: `msg-${Date.now()}`,
    role: 'user',
    content: 'test message',
    timestamp: new Date(),
    ...overrides
  }),
  
  // Snapshot testing helpers
  normalizeSnapshot: (data: any): any => {
    // Remove non-deterministic fields for snapshot testing
    return JSON.parse(JSON.stringify(data, (key, value) => {
      if (key === 'timestamp' || key === 'id') {
        return '[NORMALIZED]';
      }
      return value;
    }));
  }
};

// Custom matchers
expect.extend({
  toBeValidMessage(received: any) {
    const isValid = received &&
      typeof received.role === 'string' &&
      typeof received.content === 'string' &&
      received.timestamp instanceof Date;
    
    return {
      message: () => `expected ${received} to be a valid message`,
      pass: isValid
    };
  },
  
  toHaveExecutedTool(received: MockMCPServer, toolName: string) {
    const calls = received.executeTool.mock.calls;
    const executed = calls.some(call => call[0] === toolName);
    
    return {
      message: () => `expected server to have executed tool "${toolName}"`,
      pass: executed
    };
  }
});
```

**Test Suite Organization:**

```typescript
// Test suite structure
describe('QiAgent', () => {
  // Setup and teardown
  let agent: QiAgent;
  let testHarness: AgentTestHarness;
  
  beforeAll(async () => {
    // One-time setup for the entire suite
    await setupTestEnvironment();
  });
  
  afterAll(async () => {
    // One-time cleanup
    await teardownTestEnvironment();
  });
  
  beforeEach(async () => {
    // Setup for each test
    testHarness = await createTestHarness();
    agent = testHarness.agent;
  });
  
  afterEach(async () => {
    // Cleanup for each test
    await testHarness.cleanup();
  });
  
  // Grouped tests
  describe('initialization', () => {
    it('should initialize with valid configuration', async () => {
      // Test implementation
    });
    
    it('should fail with invalid configuration', async () => {
      // Test implementation
    });
  });
  
  describe('message processing', () => {
    it('should process simple messages', async () => {
      // Test implementation
    });
    
    it('should handle streaming responses', async () => {
      // Test implementation
    });
  });
  
  // Parameterized tests
  describe.each([
    ['openai', 'gpt-4'],
    ['anthropic', 'claude-3'],
    ['ollama', 'llama3.2']
  ])('with %s provider', (provider, model) => {
    it(`should work with ${model}`, async () => {
      const config = { model: { provider, name: model } };
      const testAgent = await createTestAgent(config);
      
      expect(testAgent).toBeDefined();
    });
  });
});
```

### Bun-Specific Testing

**Leveraging Bun Performance:**

```typescript
// Bun test runner optimization
const bunTestConfig = {
  // Use Bun's native test runner for maximum performance
  test: {
    runner: 'bun',
    
    // Bun-specific optimizations
    preload: ['./test/setup.ts'],  // Preload common modules
    bail: false,  // Continue running tests after failures
    timeout: 5000,  // Default timeout
    
    // Parallel execution
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: Math.min(8, require('os').cpus().length)
      }
    }
  }
};

// Bun-optimized test utilities
class BunTestUtils {
  // Fast file operations using Bun's native APIs
  static async createTempFile(content: string): Promise<string> {
    const tempPath = `/tmp/test-${Date.now()}-${Math.random().toString(36)}`;
    await Bun.write(tempPath, content);
    return tempPath;
  }
  
  static async readTempFile(path: string): Promise<string> {
    const file = Bun.file(path);
    return await file.text();
  }
  
  // Fast process spawning
  static async spawnTestProcess(
    command: string[], 
    options: { timeout?: number } = {}
  ): Promise<TestProcessResult> {
    const proc = Bun.spawn({
      cmd: command,
      stdout: 'pipe',
      stderr: 'pipe'
    });
    
    const timeout = options.timeout || 10000;
    const timeoutId = setTimeout(() => proc.kill(), timeout);
    
    try {
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited
      ]);
      
      clearTimeout(timeoutId);
      
      return { stdout, stderr, exitCode };
    } catch (error) {
      clearTimeout(timeoutId);
      proc.kill();
      throw error;
    }
  }
}
```

### Async Testing Patterns

**Async Operation Testing:**

```typescript
// Async testing best practices
describe('Async Operations', () => {
  it('should handle concurrent operations', async () => {
    // Test concurrent operations
    const promises = Array.from({ length: 10 }, (_, i) => 
      agent.processMessage({ role: 'user', content: `Message ${i}` })
    );
    
    const results = await Promise.all(promises);
    
    expect(results).toHaveLength(10);
    results.forEach((result, i) => {
      expect(result.content).toContain(`Message ${i}`);
    });
  });
  
  it('should handle timeout scenarios', async () => {
    // Mock a slow operation
    const slowOperation = vi.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 10000))
    );
    
    agent.processMessage = slowOperation;
    
    // Test with timeout
    await expect(
      agent.processMessage({ role: 'user', content: 'test' })
    ).rejects.toThrow('Operation timed out');
  });
  
  it('should handle streaming operations', async () => {
    const chunks: string[] = [];
    const streamingPromise = agent.streamResponse(
      { role: 'user', content: 'Tell me a story' },
      {
        onChunk: (chunk) => chunks.push(chunk),
        onComplete: () => console.log('Streaming completed'),
        onError: (error) => console.error('Streaming error:', error)
      }
    );
    
    await streamingPromise;
    
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.join('')).toContain('story');
  });
  
  it('should handle race conditions', async () => {
    // Test race condition scenarios
    const operation1 = agent.processMessage({ role: 'user', content: 'First' });
    const operation2 = agent.processMessage({ role: 'user', content: 'Second' });
    
    const [result1, result2] = await Promise.all([operation1, operation2]);
    
    // Verify operations don't interfere with each other
    expect(result1.content).not.toBe(result2.content);
  });
});

// Testing event-driven systems
describe('Event-Driven Testing', () => {
  it('should handle event sequences', async () => {
    const events: string[] = [];
    
    agent.on('tool:start', (event) => events.push('tool:start'));
    agent.on('tool:complete', (event) => events.push('tool:complete'));
    agent.on('response:complete', (event) => events.push('response:complete'));
    
    await agent.processMessage({ role: 'user', content: 'Use the calculator' });
    
    expect(events).toEqual(['tool:start', 'tool:complete', 'response:complete']);
  });
});
```

## Performance Testing

### Benchmark Testing Strategy

**Performance Benchmarking Framework:**

```typescript
interface BenchmarkResult {
  name: string;
  duration: number;
  iterations: number;
  throughput: number;
  memoryUsage: MemoryUsage;
  errors: number;
}

interface MemoryUsage {
  heap: number;
  external: number;
  arrayBuffers: number;
}

class PerformanceBenchmark {
  async runBenchmark(
    name: string,
    operation: () => Promise<void>,
    options: BenchmarkOptions = {}
  ): Promise<BenchmarkResult> {
    
    const {
      iterations = 100,
      warmupIterations = 10,
      timeout = 30000
    } = options;
    
    // Warmup phase
    for (let i = 0; i < warmupIterations; i++) {
      await operation();
    }
    
    // Force garbage collection
    if (global.gc) global.gc();
    
    // Benchmark phase
    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    let errors = 0;
    
    for (let i = 0; i < iterations; i++) {
      try {
        await operation();
      } catch (error) {
        errors++;
      }
    }
    
    const endTime = performance.now();
    const endMemory = process.memoryUsage();
    
    const duration = endTime - startTime;
    const throughput = (iterations - errors) / (duration / 1000);
    
    return {
      name,
      duration,
      iterations,
      throughput,
      memoryUsage: {
        heap: endMemory.heapUsed - startMemory.heapUsed,
        external: endMemory.external - startMemory.external,
        arrayBuffers: endMemory.arrayBuffers - startMemory.arrayBuffers
      },
      errors
    };
  }
}
```

**Performance Test Examples:**

```typescript
describe('Performance Tests', () => {
  let benchmark: PerformanceBenchmark;
  
  beforeEach(() => {
    benchmark = new PerformanceBenchmark();
  });
  
  it('should process messages within performance targets', async () => {
    const result = await benchmark.runBenchmark(
      'message_processing',
      async () => {
        await agent.processMessage({
          role: 'user',
          content: 'What is 2+2?'
        });
      },
      { iterations: 50 }
    );
    
    // Performance assertions
    expect(result.throughput).toBeGreaterThan(10); // > 10 ops/sec
    expect(result.duration / result.iterations).toBeLessThan(1000); // < 1sec per op
    expect(result.memoryUsage.heap).toBeLessThan(10 * 1024 * 1024); // < 10MB
    expect(result.errors).toBe(0);
  });
  
  it('should handle concurrent requests efficiently', async () => {
    const concurrency = 10;
    
    const result = await benchmark.runBenchmark(
      'concurrent_processing',
      async () => {
        const promises = Array.from({ length: concurrency }, () =>
          agent.processMessage({
            role: 'user',
            content: 'Process this concurrently'
          })
        );
        
        await Promise.all(promises);
      },
      { iterations: 20 }
    );
    
    // Concurrency performance targets
    expect(result.throughput).toBeGreaterThan(5); // > 5 concurrent batches/sec
    expect(result.errors).toBe(0);
  });
});
```

### Load Testing

**Load Testing Framework:**

```typescript
interface LoadTestConfig {
  users: number;
  duration: number;
  rampUp: number;
  thinkTime: number;
  scenarios: LoadTestScenario[];
}

interface LoadTestScenario {
  name: string;
  weight: number;
  steps: LoadTestStep[];
}

class LoadTestRunner {
  async runLoadTest(config: LoadTestConfig): Promise<LoadTestResult> {
    const results: LoadTestResult = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      throughput: 0,
      errorRate: 0,
      scenarios: new Map()
    };
    
    // Create virtual users
    const users = Array.from({ length: config.users }, (_, i) => 
      new VirtualUser(i, config, results)
    );
    
    // Ramp up users
    const rampUpInterval = config.rampUp / config.users;
    for (const user of users) {
      setTimeout(() => user.start(), rampUpInterval * user.id * 1000);
    }
    
    // Wait for test duration
    await new Promise(resolve => setTimeout(resolve, config.duration * 1000));
    
    // Stop all users
    await Promise.all(users.map(user => user.stop()));
    
    return this.calculateResults(results);
  }
}

class VirtualUser {
  private running = false;
  private requestTimes: number[] = [];
  
  constructor(
    public id: number,
    private config: LoadTestConfig,
    private results: LoadTestResult
  ) {}
  
  async start(): Promise<void> {
    this.running = true;
    
    while (this.running) {
      try {
        const scenario = this.selectScenario();
        const startTime = performance.now();
        
        await this.executeScenario(scenario);
        
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        this.recordSuccess(responseTime, scenario.name);
        
        // Think time between requests
        await this.sleep(this.config.thinkTime);
        
      } catch (error) {
        this.recordFailure(error);
      }
    }
  }
  
  private async executeScenario(scenario: LoadTestScenario): Promise<void> {
    for (const step of scenario.steps) {
      await this.executeStep(step);
    }
  }
}
```

## Error Testing

### Error Scenarios

**Comprehensive Error Testing:**

```typescript
describe('Error Handling', () => {
  describe('Network Errors', () => {
    it('should handle connection timeouts', async () => {
      // Mock network timeout
      const mockServer = new MockMCPServer();
      mockServer.setConnectionDelay(10000); // 10 second delay
      
      await expect(
        agent.connectToServer('timeout-server', mockServer)
      ).rejects.toThrow('Connection timeout');
    });
    
    it('should handle connection drops', async () => {
      const mockServer = new MockMCPServer();
      
      // Connect successfully
      await agent.connectToServer('unstable-server', mockServer);
      
      // Simulate connection drop
      mockServer.simulateConnectionFailure();
      
      // Verify graceful handling
      const result = await agent.processMessage({
        role: 'user',
        content: 'Use the unstable server'
      });
      
      expect(result.content).toContain('server is unavailable');
    });
  });
  
  describe('Input Validation Errors', () => {
    it('should handle malformed messages', async () => {
      const malformedMessage = {
        role: 'invalid_role',
        content: null
      } as any;
      
      await expect(
        agent.processMessage(malformedMessage)
      ).rejects.toThrow('Invalid message format');
    });
    
    it('should handle oversized inputs', async () => {
      const oversizedContent = 'x'.repeat(1000000); // 1MB string
      
      await expect(
        agent.processMessage({
          role: 'user',
          content: oversizedContent
        })
      ).rejects.toThrow('Input too large');
    });
  });
  
  describe('Resource Exhaustion', () => {
    it('should handle memory pressure', async () => {
      // Simulate memory pressure
      const largeObjects = Array.from({ length: 1000 }, () => 
        new Array(10000).fill('memory pressure test')
      );
      
      const result = await agent.processMessage({
        role: 'user',
        content: 'Simple request during memory pressure'
      });
      
      expect(result).toBeDefined();
      
      // Cleanup
      largeObjects.length = 0;
    });
  });
});
```

### Recovery Testing

**System Recovery Validation:**

```typescript
describe('Recovery Testing', () => {
  it('should recover from server restart', async () => {
    const mockServer = new MockMCPServer();
    
    // Initial connection
    await agent.connectToServer('recovery-test', mockServer);
    
    // Simulate server crash and restart
    mockServer.simulateConnectionFailure();
    await new Promise(resolve => setTimeout(resolve, 1000));
    mockServer.reset();
    
    // Verify automatic recovery
    await testUtils.waitFor(
      () => agent.isServerConnected('recovery-test'),
      5000
    );
    
    expect(agent.isServerConnected('recovery-test')).toBe(true);
  });
  
  it('should maintain state during partial failures', async () => {
    // Setup multiple servers
    const servers = ['server1', 'server2', 'server3'].map(name => {
      const server = new MockMCPServer();
      return { name, server };
    });
    
    await Promise.all(
      servers.map(({ name, server }) => 
        agent.connectToServer(name, server)
      )
    );
    
    // Fail one server
    servers[1].server.simulateConnectionFailure();
    
    // Verify other servers still work
    const result = await agent.processMessage({
      role: 'user',
      content: 'Use server1 and server3'
    });
    
    expect(result.content).not.toContain('error');
    expect(agent.isServerConnected('server1')).toBe(true);
    expect(agent.isServerConnected('server3')).toBe(true);
  });
});
```

## Continuous Testing

### Automated Test Execution

**Test Automation Pipeline:**

```typescript
interface TestPipeline {
  stages: TestStage[];
  triggers: TestTrigger[];
  reports: TestReport[];
  notifications: TestNotification[];
}

interface TestStage {
  name: string;
  tests: TestSuite[];
  parallelism: number;
  timeout: number;
  retries: number;
  conditions: TestCondition[];
}

class ContinuousTestRunner {
  async executePipeline(pipeline: TestPipeline): Promise<PipelineResult> {
    const results: StageResult[] = [];
    
    for (const stage of pipeline.stages) {
      try {
        const stageResult = await this.executeStage(stage);
        results.push(stageResult);
        
        // Check if stage passed conditions
        if (!this.checkStageConditions(stage, stageResult)) {
          throw new Error(`Stage ${stage.name} failed conditions`);
        }
        
      } catch (error) {
        return {
          success: false,
          error: error.message,
          results,
          failedStage: stage.name
        };
      }
    }
    
    return {
      success: true,
      results,
      totalDuration: results.reduce((sum, r) => sum + r.duration, 0)
    };
  }
  
  private async executeStage(stage: TestStage): Promise<StageResult> {
    const startTime = performance.now();
    
    // Execute test suites in parallel
    const suitePromises = stage.tests.map(suite => 
      this.executeTestSuite(suite)
    );
    
    const suiteResults = await Promise.all(suitePromises);
    
    const endTime = performance.now();
    
    return {
      name: stage.name,
      duration: endTime - startTime,
      suites: suiteResults,
      passed: suiteResults.every(r => r.passed),
      coverage: this.calculateStageCoverage(suiteResults)
    };
  }
}
```

### Quality Gates

**Automated Quality Validation:**

```typescript
interface QualityGate {
  name: string;
  criteria: QualityCriterion[];
  enforcement: 'blocking' | 'warning' | 'informational';
}

interface QualityCriterion {
  metric: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  threshold: number;
  weight: number;
}

class QualityGateValidator {
  async validateQualityGates(
    gates: QualityGate[],
    testResults: TestResults
  ): Promise<QualityGateResult> {
    
    const gateResults: GateResult[] = [];
    
    for (const gate of gates) {
      const criterionResults: CriterionResult[] = [];
      
      for (const criterion of gate.criteria) {
        const actualValue = this.extractMetricValue(testResults, criterion.metric);
        const passed = this.evaluateCriterion(criterion, actualValue);
        
        criterionResults.push({
          criterion: criterion.metric,
          expected: criterion.threshold,
          actual: actualValue,
          passed,
          weight: criterion.weight
        });
      }
      
      const gateScore = this.calculateGateScore(criterionResults);
      const gatePassed = gateScore >= 0.8; // 80% threshold
      
      gateResults.push({
        name: gate.name,
        passed: gatePassed,
        score: gateScore,
        criteria: criterionResults,
        enforcement: gate.enforcement
      });
    }
    
    const overallPassed = gateResults
      .filter(r => r.enforcement === 'blocking')
      .every(r => r.passed);
    
    return {
      passed: overallPassed,
      gates: gateResults,
      recommendations: this.generateRecommendations(gateResults)
    };
  }
}

// Quality gates configuration
const qualityGates: QualityGate[] = [
  {
    name: 'Code Coverage',
    criteria: [
      { metric: 'coverage.lines', operator: '>=', threshold: 80, weight: 1.0 },
      { metric: 'coverage.branches', operator: '>=', threshold: 75, weight: 0.8 },
      { metric: 'coverage.functions', operator: '>=', threshold: 85, weight: 0.9 }
    ],
    enforcement: 'blocking'
  },
  
  {
    name: 'Test Performance',
    criteria: [
      { metric: 'test.duration', operator: '<=', threshold: 300000, weight: 1.0 }, // 5 minutes
      { metric: 'test.flakiness', operator: '<=', threshold: 0.05, weight: 1.0 }, // 5% flaky
      { metric: 'test.failures', operator: '==', threshold: 0, weight: 1.0 }
    ],
    enforcement: 'blocking'
  },
  
  {
    name: 'Security',
    criteria: [
      { metric: 'security.vulnerabilities.critical', operator: '==', threshold: 0, weight: 1.0 },
      { metric: 'security.vulnerabilities.high', operator: '<=', threshold: 2, weight: 0.8 }
    ],
    enforcement: 'blocking'
  }
];
```

## Next Steps

After completing T9 testing strategy architecture:

1. **Proceed to T10**: [Build & Deployment](./T10-build-deployment.md) for production deployment guide
2. **Implement Core Testing**: Set up basic unit and integration test framework
3. **Configure CI/CD**: Implement continuous testing pipeline
4. **Performance Baseline**: Establish performance benchmarks and monitoring

This T9 implementation guide provides the architectural foundation for comprehensive testing strategy, leveraging Vitest and Bun for optimal performance while ensuring code quality, reliability, and maintainability through systematic testing approaches.