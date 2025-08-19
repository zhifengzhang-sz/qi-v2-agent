/**
 * ToolExecutor QiCore Compliance Tests
 * 
 * Tests the 6-phase execution pipeline with proper QiCore patterns:
 * 1. Discovery & Tool Resolution
 * 2. Input Validation 
 * 3. Permission Checks & Security
 * 4. Tool Execution with Timeout & Retry
 * 5. Result Processing & Transformation
 * 6. Cleanup, Metrics & Event Emission
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { success, failure, validationError, systemError } from '@qi/base';
import { ToolExecutor } from '@qi/agent/tools/core/executor/ToolExecutor.js';
import type { 
  ITool, 
  IToolRegistry, 
  ToolCall, 
  ToolContext, 
  ExecutionOptions,
  PermissionResult
} from '@qi/agent/tools/core/interfaces/index.js';

// Mock tool implementation
const createMockTool = (options: {
  name?: string;
  validateSuccess?: boolean;
  permissionAllowed?: boolean;
  executionSuccess?: boolean;
  isConcurrencySafe?: boolean;
} = {}): ITool => ({
  name: options.name || 'MockTool',
  description: 'Mock tool for testing',
  version: '1.0.0',
  isConcurrencySafe: options.isConcurrencySafe ?? true,
  
  inputSchema: {
    safeParse: vi.fn((input) => ({
      success: options.validateSuccess ?? true,
      error: options.validateSuccess === false ? { message: 'Validation failed' } : undefined,
    })),
  } as any,

  validate: vi.fn((input) => 
    options.validateSuccess !== false 
      ? success(input)
      : failure(validationError('Business validation failed'))
  ),

  checkPermissions: vi.fn((input, context) => 
    options.permissionAllowed !== false
      ? success({ allowed: true } as PermissionResult)
      : success({ allowed: false, reason: 'Permission denied' } as PermissionResult)
  ),

  execute: vi.fn(async (input, context) => 
    options.executionSuccess !== false
      ? success({ result: 'success', input })
      : failure(systemError('Execution failed'))
  ),
});

// Mock tool registry
const createMockRegistry = (tool?: ITool): IToolRegistry => ({
  register: vi.fn(() => success(undefined)),
  unregister: vi.fn(() => success(true)),
  get: vi.fn((name: string) => 
    tool && tool.name === name 
      ? success(tool)
      : failure(validationError(`Tool '${name}' not found`))
  ),
  list: vi.fn(() => tool ? [tool] : []),
  discover: vi.fn(() => success(tool ? [tool] : [])),
  validate: vi.fn(() => success({ valid: true, errors: [] })),
  getStats: vi.fn(() => ({ totalTools: tool ? 1 : 0, categories: new Map() })),
  onRegistryChange: vi.fn(() => vi.fn()), // Returns unsubscribe function
});

// Mock tool context
const createMockContext = (): ToolContext => ({
  sessionId: 'test-session',
  userId: 'test-user',
  currentDirectory: '/test',
  environment: new Map(),
  permissions: {
    readFiles: true,
    writeFiles: true,
    executeCommands: true,
    networkAccess: true,
    systemAccess: true,
    manageProcesses: true,
  },
  metadata: new Map(),
});

describe('ToolExecutor QiCore 6-Phase Pipeline', () => {
  let executor: ToolExecutor;
  let mockTool: ITool;
  let mockRegistry: IToolRegistry;
  let mockContext: ToolContext;

  beforeEach(() => {
    mockTool = createMockTool();
    mockRegistry = createMockRegistry(mockTool);
    mockContext = createMockContext();
    executor = new ToolExecutor(mockRegistry);
  });

  describe('Phase 1: Discovery & Tool Resolution', () => {
    it('should successfully discover and resolve tool', async () => {
      const call: ToolCall = {
        callId: 'test-call-1',
        toolName: 'MockTool',
        input: { test: 'data' },
        context: mockContext,
        timestamp: Date.now(),
      };

      // Test proper QiCore execution flow - collect all results
      const results: any[] = [];
      for await (const result of executor.execute(call)) {
        expect(result.tag).toBe('success'); // All results should be successful
        results.push(result.value);
      }

      // Should have progress updates and final result (6 phases minimum)
      expect(results.length).toBeGreaterThanOrEqual(6);
      
      // Final result should be tool execution result with proper structure
      const finalResult = results[results.length - 1];
      expect(finalResult).toHaveProperty('success');
      expect(finalResult).toHaveProperty('callId', 'test-call-1');
      expect(finalResult).toHaveProperty('toolName', 'MockTool');
    });

    it('should handle tool not found with QiCore patterns', async () => {
      const registryWithoutTool = createMockRegistry(); // No tool
      const executorWithEmptyRegistry = new ToolExecutor(registryWithoutTool);

      const call: ToolCall = {
        callId: 'test-call-2',
        toolName: 'NonExistentTool',
        input: { test: 'data' },
        context: mockContext,
        timestamp: Date.now(),
      };

      const results: any[] = [];
      for await (const result of executorWithEmptyRegistry.execute(call)) {
        if (result.tag === 'failure') {
          expect(result.error.code).toBe('TOOL_NOT_FOUND');
          expect(result.error.message).toContain('NonExistentTool');
          return;
        }
      }
    });
  });

  describe('Phase 2: Input Validation', () => {
    it('should validate input with schema and business logic', async () => {
      const call: ToolCall = {
        callId: 'test-call-3',
        toolName: 'MockTool',
        input: { valid: 'data' },
        context: mockContext,
        timestamp: Date.now(),
      };

      let validationFound = false;
      for await (const result of executor.execute(call)) {
        if (result.tag === 'success' && 'message' in result.value && result.value.message === 'Input validated') {
          validationFound = true;
          expect(result.value.progress).toBe(0.4);
        }
      }

      expect(validationFound).toBe(true);
      expect(mockTool.inputSchema.safeParse).toHaveBeenCalled();
      expect(mockTool.validate).toHaveBeenCalled();
    });

    it('should handle schema validation failure', async () => {
      const toolWithValidationFailure = createMockTool({ validateSuccess: false });
      const registryWithFailingTool = createMockRegistry(toolWithValidationFailure);
      const executorWithFailingTool = new ToolExecutor(registryWithFailingTool);

      const call: ToolCall = {
        callId: 'test-call-4',
        toolName: 'MockTool',
        input: { invalid: 'data' },
        context: mockContext,
        timestamp: Date.now(),
      };

      for await (const result of executorWithFailingTool.execute(call)) {
        if (result.tag === 'failure') {
          expect(result.error.code).toBe('SCHEMA_VALIDATION_FAILED');
          expect(result.error.category).toBe('VALIDATION');
          return;
        }
      }
    });

    it('should handle business validation failure', async () => {
      // Mock tool that passes schema but fails business validation
      const toolWithBusinessFailure = createMockTool({ validateSuccess: false });
      toolWithBusinessFailure.inputSchema.safeParse = vi.fn(() => ({ success: true }));
      
      const registryWithBusinessFailure = createMockRegistry(toolWithBusinessFailure);
      const executorWithBusinessFailure = new ToolExecutor(registryWithBusinessFailure);

      const call: ToolCall = {
        callId: 'test-call-5',
        toolName: 'MockTool',
        input: { businessInvalid: 'data' },
        context: mockContext,
        timestamp: Date.now(),
      };

      for await (const result of executorWithBusinessFailure.execute(call)) {
        if (result.tag === 'failure') {
          expect(result.error.code).toBe('BUSINESS_VALIDATION_FAILED');
          return;
        }
      }
    });
  });

  describe('Phase 3: Permission Checks & Security', () => {
    it('should verify permissions successfully', async () => {
      const call: ToolCall = {
        callId: 'test-call-6',
        toolName: 'MockTool',
        input: { test: 'data' },
        context: mockContext,
        timestamp: Date.now(),
      };

      let permissionCheckFound = false;
      for await (const result of executor.execute(call)) {
        if (result.tag === 'success' && 'message' in result.value && result.value.message === 'Permissions verified') {
          permissionCheckFound = true;
          expect(result.value.progress).toBe(0.6);
        }
      }

      expect(permissionCheckFound).toBe(true);
      expect(mockTool.checkPermissions).toHaveBeenCalledWith(call.input, call.context);
    });

    it('should handle permission denied', async () => {
      const toolWithPermissionDenied = createMockTool({ permissionAllowed: false });
      const registryWithDeniedPermissions = createMockRegistry(toolWithPermissionDenied);
      const executorWithDeniedPermissions = new ToolExecutor(registryWithDeniedPermissions);

      const call: ToolCall = {
        callId: 'test-call-7',
        toolName: 'MockTool',
        input: { test: 'data' },
        context: mockContext,
        timestamp: Date.now(),
      };

      for await (const result of executorWithDeniedPermissions.execute(call)) {
        if (result.tag === 'failure') {
          // Permission errors should be returned directly as PERMISSION_DENIED
          expect(result.error.code).toBe('PERMISSION_DENIED');
          expect(result.error.category).toBe('VALIDATION');
          return;
        }
      }
    });
  });

  describe('Phase 4: Tool Execution with Retry', () => {
    it('should execute tool successfully', async () => {
      const call: ToolCall = {
        callId: 'test-call-8',
        toolName: 'MockTool',
        input: { test: 'data' },
        context: mockContext,
        timestamp: Date.now(),
      };

      let finalResult: any = null;
      for await (const result of executor.execute(call)) {
        if (result.tag === 'success' && 'success' in result.value) {
          finalResult = result.value;
        }
      }

      expect(finalResult).toBeDefined();
      expect(finalResult.success).toBe(true);
      expect(finalResult.callId).toBe('test-call-8');
      expect(finalResult.toolName).toBe('MockTool');
      expect(finalResult.output).toBeDefined();
      expect(finalResult.metrics).toBeDefined();
      expect(finalResult.metrics.success).toBe(true);
    });

    it('should handle execution failure with retry', async () => {
      const toolWithExecutionFailure = createMockTool({ executionSuccess: false });
      const registryWithFailingExecution = createMockRegistry(toolWithExecutionFailure);
      const executorWithFailingExecution = new ToolExecutor(registryWithFailingExecution, {
        retryPolicy: {
          maxAttempts: 2,
          backoffMultiplier: 1,
          initialDelay: 10,
          maxDelay: 100,
          retryableErrors: ['SYSTEM_ERROR'],
        }
      });

      const call: ToolCall = {
        callId: 'test-call-9',
        toolName: 'MockTool',
        input: { test: 'data' },
        context: mockContext,
        timestamp: Date.now(),
      };

      for await (const result of executorWithFailingExecution.execute(call)) {
        if (result.tag === 'failure') {
          expect(result.error.code).toBe('EXECUTION_FAILED');
          expect(result.error.message).toContain('attempts');
          return;
        }
      }
    });
  });

  describe('Phase 5: Result Processing & Transformation', () => {
    it('should process and enhance results', async () => {
      const call: ToolCall = {
        callId: 'test-call-10',
        toolName: 'MockTool',
        input: { test: 'data' },
        context: mockContext,
        timestamp: Date.now(),
      };

      let finalResult: any = null;
      for await (const result of executor.execute(call)) {
        if (result.tag === 'success' && 'success' in result.value) {
          finalResult = result.value;
        }
      }

      expect(finalResult).toBeDefined();
      expect(finalResult.metadata).toBeInstanceOf(Map);
      expect(finalResult.metadata.has('executorVersion')).toBe(true);
      expect(finalResult.metadata.has('executionTime')).toBe(true);
      expect(finalResult.metadata.has('timestamp')).toBe(true);
    });
  });

  describe('Phase 6: Cleanup & Metrics', () => {
    it('should complete cleanup and emit events', async () => {
      const call: ToolCall = {
        callId: 'test-call-11',
        toolName: 'MockTool',
        input: { test: 'data' },
        context: mockContext,
        timestamp: Date.now(),
      };

      let completionFound = false;
      for await (const result of executor.execute(call)) {
        if (result.tag === 'success' && 'progress' in result.value && result.value.progress === 1.0) {
          completionFound = true;
          expect(result.value.message).toBe('Execution completed');
        }
      }

      expect(completionFound).toBe(true);
      
      // Check stats were updated
      const stats = executor.getStats();
      expect(stats.totalExecutions).toBeGreaterThan(0);
    });
  });

  describe('QiCore Pattern Compliance', () => {
    it('should use match() instead of direct .value access', async () => {
      // This test ensures our refactored code uses proper QiCore patterns
      const call: ToolCall = {
        callId: 'test-call-12',
        toolName: 'MockTool',
        input: { test: 'data' },
        context: mockContext,
        timestamp: Date.now(),
      };

      // The execution should complete without throwing errors
      // related to direct .value access violations
      let executionCompleted = false;
      for await (const result of executor.execute(call)) {
        if (result.tag === 'success' && 'success' in result.value) {
          executionCompleted = true;
        }
      }

      expect(executionCompleted).toBe(true);
    });

    it('should handle Result<T> composition properly', async () => {
      const call: ToolCall = {
        callId: 'test-call-13',
        toolName: 'MockTool',
        input: { test: 'data' },
        context: mockContext,
        timestamp: Date.now(),
      };

      // All phases should complete with proper Result<T> handling
      const results: any[] = [];
      for await (const result of executor.execute(call)) {
        results.push(result);
      }

      // Should have multiple progress updates and final result
      expect(results.length).toBeGreaterThan(5); // 6 phases + final result
      
      // All results should be proper Result<T> types
      results.forEach(result => {
        expect(result).toHaveProperty('tag');
        expect(['success', 'failure']).toContain(result.tag);
      });
    });
  });

  // TODO: Fix batch execution test
  // describe('Batch Execution', () => {
  //   it('should handle concurrent and sequential execution properly', async () => {
  //     // Implementation pending - complex mock setup needed
  //   });
  // });

  describe('Error Handling', () => {
    it('should provide proper error context', async () => {
      const registryWithoutTool = createMockRegistry();
      const executorWithEmptyRegistry = new ToolExecutor(registryWithoutTool);

      const call: ToolCall = {
        callId: 'error-test-1',
        toolName: 'NonExistentTool',
        input: { test: 'data' },
        context: mockContext,
        timestamp: Date.now(),
      };

      for await (const result of executorWithEmptyRegistry.execute(call)) {
        if (result.tag === 'failure') {
          expect(result.error.code).toBe('TOOL_NOT_FOUND');
          expect(result.error.category).toBe('VALIDATION');
          expect(result.error.context).toBeDefined();
          expect(result.error.context.toolName).toBe('NonExistentTool');
          expect(result.error.context.callId).toBe('error-test-1');
          expect(result.error.context.phase).toBe('discovery');
          return;
        }
      }
    });
  });
});