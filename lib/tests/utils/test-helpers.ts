/**
 * Comprehensive Test Helper Utilities for Qi v2 Agent
 * 
 * Provides mock implementations, test utilities, and helpers
 * for testing CLI, MCP, utilities, and infrastructure components.
 */

import { vi } from 'vitest';
import { QiAsyncMessageQueue } from '../../src/messaging/impl/QiAsyncMessageQueue.js';
import { MessageType, MessagePriority } from '../../src/messaging/types/MessageTypes.js';
import type { QiMessage, UserInputMessage } from '../../src/messaging/types/MessageTypes.js';
import type { ITerminal } from '../../src/cli/abstractions/ITerminal.js';
import type { IInputManager } from '../../src/cli/abstractions/IInputManager.js';
import type { ICommandRouter } from '../../src/cli/abstractions/ICLIServices.js';
import type { 
  IModeRenderer, 
  IProgressRenderer, 
  IStreamRenderer 
} from '../../src/cli/abstractions/IUIComponent.js';
import type { ICommandHandler } from '../../src/command/abstractions/index.js';

// ===== MOCK IMPLEMENTATIONS =====

/**
 * Mock Terminal Implementation for Testing CLI Components
 */
export class MockTerminal implements ITerminal {
  private lines: string[] = [];
  
  writeLine(content: string): void {
    this.lines.push(content);
  }
  
  write(content: string): void {
    this.lines.push(content);
  }
  
  clear(): void {
    this.lines = [];
  }
  
  // Test helpers
  getOutput(): string[] {
    return [...this.lines];
  }
  
  getLastLine(): string | undefined {
    return this.lines[this.lines.length - 1];
  }
  
  getLineCount(): number {
    return this.lines.length;
  }
  
  hasLine(content: string): boolean {
    return this.lines.includes(content);
  }
  
  hasLineContaining(substring: string): boolean {
    return this.lines.some(line => line.includes(substring));
  }
}

/**
 * Mock Input Manager for Testing CLI Input Handling
 */
export class MockInputManager implements IInputManager {
  private inputCallback?: (input: string) => void;
  private isInitialized = false;
  private config: any = {};
  
  initialize(config?: any): void {
    this.isInitialized = true;
    this.config = { ...this.config, ...config };
  }
  
  onInput(callback: (input: string) => void): void {
    this.inputCallback = callback;
  }
  
  showPrompt(): void {
    // Mock implementation
  }
  
  close(): void {
    this.inputCallback = undefined;
    this.isInitialized = false;
  }
  
  updateConfig(config: any): void {
    this.config = { ...this.config, ...config };
  }
  
  // Test helpers
  simulateInput(input: string): void {
    if (this.inputCallback && this.isInitialized) {
      this.inputCallback(input);
    }
  }
  
  isReady(): boolean {
    return this.isInitialized;
  }
  
  getConfig(): any {
    return { ...this.config };
  }
}

/**
 * Mock Progress Renderer for Testing Progress Display
 */
export class MockProgressRenderer implements IProgressRenderer {
  private currentProgress = 0;
  private currentPhase = '';
  private currentDetails?: string;
  private config: any = {};
  
  updateProgress(progress: number, phase: string, details?: string): void {
    this.currentProgress = progress;
    this.currentPhase = phase;
    this.currentDetails = details;
  }
  
  destroy(): void {
    this.currentProgress = 0;
    this.currentPhase = '';
    this.currentDetails = undefined;
  }
  
  updateConfig(config: any): void {
    this.config = { ...this.config, ...config };
  }
  
  // Test helpers
  getCurrentProgress(): number {
    return this.currentProgress;
  }
  
  getCurrentPhase(): string {
    return this.currentPhase;
  }
  
  getCurrentDetails(): string | undefined {
    return this.currentDetails;
  }
  
  getConfig(): any {
    return { ...this.config };
  }
}

/**
 * Mock Mode Renderer for Testing Mode Changes
 */
export class MockModeRenderer implements IModeRenderer {
  private currentMode: string = 'interactive';
  private config: any = {};
  
  setMode(mode: string): void {
    this.currentMode = mode;
  }
  
  destroy(): void {
    this.currentMode = 'interactive';
  }
  
  updateConfig(config: any): void {
    this.config = { ...this.config, ...config };
  }
  
  // Test helpers
  getCurrentMode(): string {
    return this.currentMode;
  }
  
  getConfig(): any {
    return { ...this.config };
  }
}

/**
 * Mock Stream Renderer for Testing Streaming Functionality
 */
export class MockStreamRenderer implements IStreamRenderer {
  private chunks: string[] = [];
  private isStreaming = false;
  private config: any = {};
  
  startStreaming(): void {
    this.isStreaming = true;
    this.chunks = [];
  }
  
  addChunk(content: string): void {
    if (this.isStreaming) {
      this.chunks.push(content);
    }
  }
  
  complete(message?: string): void {
    this.isStreaming = false;
    if (message) {
      this.chunks.push(message);
    }
  }
  
  cancel(): void {
    this.isStreaming = false;
    this.chunks = [];
  }
  
  destroy(): void {
    this.isStreaming = false;
    this.chunks = [];
  }
  
  updateConfig(config: any): void {
    this.config = { ...this.config, ...config };
  }
  
  // Test helpers
  getChunks(): string[] {
    return [...this.chunks];
  }
  
  getStreamingState(): boolean {
    return this.isStreaming;
  }
  
  getChunkCount(): number {
    return this.chunks.length;
  }
  
  hasChunk(content: string): boolean {
    return this.chunks.includes(content);
  }
  
  getConfig(): any {
    return { ...this.config };
  }
}

/**
 * Mock Command Router for Testing Command Routing
 */
export class MockCommandRouter implements ICommandRouter {
  private routes: Map<string, any> = new Map();
  private routeHistory: string[] = [];
  
  route(command: string): any {
    this.routeHistory.push(command);
    return this.routes.get(command) || { success: true, command };
  }
  
  // Test helpers
  setRoute(command: string, result: any): void {
    this.routes.set(command, result);
  }
  
  getRouteHistory(): string[] {
    return [...this.routeHistory];
  }
  
  wasRouted(command: string): boolean {
    return this.routeHistory.includes(command);
  }
  
  clearHistory(): void {
    this.routeHistory = [];
  }
}

/**
 * Mock Command Handler for Testing Command Processing
 */
export class MockCommandHandler implements ICommandHandler {
  private commands: Map<string, any> = new Map();
  private executionHistory: Array<{ command: string; args: any[] }> = [];
  
  canHandle(command: string): boolean {
    return this.commands.has(command);
  }
  
  async handle(command: string, ...args: any[]): Promise<any> {
    this.executionHistory.push({ command, args });
    return this.commands.get(command)?.(args) || { success: true };
  }
  
  // Test helpers
  addCommand(command: string, handler: (...args: any[]) => any): void {
    this.commands.set(command, handler);
  }
  
  getExecutionHistory(): Array<{ command: string; args: any[] }> {
    return [...this.executionHistory];
  }
  
  wasExecuted(command: string): boolean {
    return this.executionHistory.some(entry => entry.command === command);
  }
  
  clearHistory(): void {
    this.executionHistory = [];
  }
}

// ===== TEST UTILITY FUNCTIONS =====

/**
 * Creates a complete set of mock CLI components for testing
 */
export function createMockCLIComponents() {
  const mockTerminal = new MockTerminal();
  const mockInputManager = new MockInputManager();
  const mockProgressRenderer = new MockProgressRenderer();
  const mockModeRenderer = new MockModeRenderer();
  const mockStreamRenderer = new MockStreamRenderer();
  const mockCommandRouter = new MockCommandRouter();
  const mockCommandHandler = new MockCommandHandler();
  const messageQueue = new QiAsyncMessageQueue<QiMessage>();
  
  return {
    mockTerminal,
    mockInputManager,
    mockProgressRenderer,
    mockModeRenderer,
    mockStreamRenderer,
    mockCommandRouter,
    mockCommandHandler,
    messageQueue,
  };
}

/**
 * Creates a test message for message queue testing
 */
export function createTestMessage(
  input: string = 'test message',
  type: MessageType = MessageType.USER_INPUT
): UserInputMessage {
  return {
    id: generateTestId(),
    type,
    timestamp: new Date(),
    priority: MessagePriority.NORMAL,
    input,
    raw: false,
    source: 'test',
  };
}

/**
 * Generates a unique test ID
 */
export function generateTestId(): string {
  return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Creates a mock configuration object
 */
export function createMockConfig(overrides: Record<string, any> = {}) {
  return {
    enableHotkeys: false, // Disable hotkeys in tests
    enableModeIndicator: true,
    enableProgressDisplay: true,
    enableStreaming: true,
    prompt: '> ',
    colors: false, // Disable colors in tests
    animations: false, // Disable animations in tests
    historySize: 10,
    autoComplete: false,
    streamingThrottle: 0,
    maxBufferSize: 1000,
    debug: true,
    ...overrides,
  };
}

/**
 * Creates a spy on console methods with automatic restoration
 */
export function createConsoleSpy() {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  
  return {
    log: logSpy,
    warn: warnSpy,
    error: errorSpy,
    restore: () => {
      logSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    },
  };
}

/**
 * Waits for a specific amount of time (useful for async testing)
 */
export function waitFor(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Waits for a condition to be true with timeout
 */
export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await waitFor(interval);
  }
  
  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Creates a mock process.exit for testing exit scenarios
 */
export function createMockProcessExit() {
  return vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('Process exit called');
  });
}

/**
 * Captures and restores process.exit for testing
 */
export function withMockProcessExit(test: (exitSpy: any) => void | Promise<void>) {
  return async () => {
    const exitSpy = createMockProcessExit();
    try {
      await test(exitSpy);
    } finally {
      exitSpy.mockRestore();
    }
  };
}

// ===== ASSERTION HELPERS =====

/**
 * Custom assertion helpers for common test scenarios
 */
export const assertions = {
  /**
   * Asserts that a terminal contains specific output
   */
  terminalContains(terminal: MockTerminal, content: string) {
    if (!terminal.hasLineContaining(content)) {
      throw new Error(
        `Terminal does not contain "${content}". Actual output: ${terminal.getOutput().join('\\n')}`
      );
    }
  },

  /**
   * Asserts that a message queue has specific size
   */
  queueSize(queue: QiAsyncMessageQueue<any>, expectedSize: number) {
    const actualSize = queue.size();
    if (actualSize !== expectedSize) {
      throw new Error(`Expected queue size ${expectedSize}, got ${actualSize}`);
    }
  },

  /**
   * Asserts that a command was routed
   */
  commandRouted(router: MockCommandRouter, command: string) {
    if (!router.wasRouted(command)) {
      throw new Error(
        `Command "${command}" was not routed. History: ${router.getRouteHistory().join(', ')}`
      );
    }
  },

  /**
   * Asserts that a command was executed
   */
  commandExecuted(handler: MockCommandHandler, command: string) {
    if (!handler.wasExecuted(command)) {
      throw new Error(
        `Command "${command}" was not executed. History: ${handler.getExecutionHistory().map(e => e.command).join(', ')}`
      );
    }
  },
};

// ===== PERFORMANCE TESTING HELPERS =====

/**
 * Measures execution time of a function
 */
export async function measureTime<T>(fn: () => T | Promise<T>): Promise<{ result: T; duration: number }> {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;
  return { result, duration };
}

/**
 * Runs performance benchmarks
 */
export async function benchmark(
  name: string,
  fn: () => void | Promise<void>,
  iterations: number = 1000
): Promise<{ name: string; averageTime: number; totalTime: number; iterations: number }> {
  const times: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const { duration } = await measureTime(fn);
    times.push(duration);
  }
  
  const totalTime = times.reduce((sum, time) => sum + time, 0);
  const averageTime = totalTime / iterations;
  
  return {
    name,
    averageTime,
    totalTime,
    iterations,
  };
}

// ===== INTEGRATION TEST HELPERS =====

/**
 * Sets up a complete test environment for integration testing
 */
export async function createTestEnvironment() {
  const components = createMockCLIComponents();
  const config = createMockConfig();
  const consoleSpy = createConsoleSpy();
  
  // Initialize components
  await components.mockInputManager.initialize(config);
  
  return {
    ...components,
    config,
    consoleSpy,
    cleanup: async () => {
      components.mockInputManager.close();
      components.mockProgressRenderer.destroy();
      components.mockModeRenderer.destroy();
      components.mockStreamRenderer.destroy();
      consoleSpy.restore();
      await components.messageQueue.shutdown();
    },
  };
}

/**
 * Runs a test with automatic cleanup
 */
export function withTestEnvironment(
  test: (env: Awaited<ReturnType<typeof createTestEnvironment>>) => void | Promise<void>
) {
  return async () => {
    const env = await createTestEnvironment();
    try {
      await test(env);
    } finally {
      await env.cleanup();
    }
  };
}

// Export all utilities
export {
  MessageType,
  MessagePriority,
  type QiMessage,
  type UserInputMessage,
  type ITerminal,
  type IInputManager,
  type ICommandRouter,
  type IModeRenderer,
  type IProgressRenderer,
  type IStreamRenderer,
  type ICommandHandler,
};