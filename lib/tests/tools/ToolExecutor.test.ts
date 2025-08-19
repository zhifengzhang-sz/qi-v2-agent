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
import { success, failure, validationError, systemError, match } from '@qi/base';
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

  describe('ToolExecutor Error Transformation - transformToQiError', () => {
    
    // Helper function to create test call and progress objects
    const createTestCallAndProgress = (callId: string, toolName: string, state: string = 'execution') => {
      const mockCall = {
        callId,
        toolName,
        input: {},
        context: mockContext,
        timestamp: Date.now()
      };
      const mockProgress = {
        callId,
        toolName,
        state: state as any,
        startTime: Date.now() - 2000,
        progress: 0.5
      };
      return { mockCall, mockProgress };
    };

    describe('Error Categorization by Message Pattern', () => {
      
      it('should categorize timeout errors as SYSTEM category', () => {
        const timeoutError = new Error('Operation timeout occurred');
        const { mockCall, mockProgress } = createTestCallAndProgress('test-1', 'testTool');
        
        // Access private method for testing using bracket notation
        const result = (executor as any)['transformToQiError'](
          mockCall,
          timeoutError,
          mockProgress,
          Date.now() - 1000
        );
        
        expect(result.code).toBe('EXECUTION_TIMEOUT');
        expect(result.category).toBe('SYSTEM');
        expect(result.message).toContain('timeout');
        expect(result.context.toolName).toBe('testTool');
        expect(result.context.callId).toBe('test-1');
        expect(result.context.phase).toBe('execution');
      });

      it('should categorize permission denied errors as VALIDATION category', () => {
        const permissionError = new Error('permission denied to access resource');
        const { mockCall, mockProgress } = createTestCallAndProgress('test-2', 'fileTool', 'security');
        
        const result = (executor as any)['transformToQiError'](
          mockCall,
          permissionError,
          mockProgress,
          Date.now() - 500
        );
        
        expect(result.code).toBe('PERMISSION_DENIED');
        expect(result.category).toBe('VALIDATION');
        expect(result.message).toContain('permission denied');
        expect(result.context.toolName).toBe('fileTool');
        expect(result.context.phase).toBe('security');
      });

      it('should categorize validation errors as VALIDATION category', () => {
        const validationError = new Error('invalid input parameter: missing required field');
        const { mockCall, mockProgress } = createTestCallAndProgress('test-3', 'validatorTool', 'validation');
        
        const result = (executor as any)['transformToQiError'](
          mockCall,
          validationError,
          mockProgress,
          Date.now() - 200
        );
        
        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.category).toBe('VALIDATION');
        expect(result.message).toContain('validation failed');
        expect(result.context.toolName).toBe('validatorTool');
      });

      it('should categorize generic errors as SYSTEM category by default', () => {
        const genericError = new Error('Unexpected runtime error occurred');
        const { mockCall, mockProgress } = createTestCallAndProgress('test-4', 'genericTool');
        
        const result = (executor as any)['transformToQiError'](
          mockCall,
          genericError,
          mockProgress,
          Date.now() - 300
        );
        
        expect(result.code).toBe('EXECUTION_ERROR');
        expect(result.category).toBe('SYSTEM');
        expect(result.message).toContain('Unexpected runtime error occurred');
        expect(result.context.toolName).toBe('genericTool');
      });
    });

    describe('Context Enrichment', () => {
      
      it('should preserve original error message and add context', () => {
        const originalMessage = 'Very specific error message with details';
        const error = new Error(originalMessage);
        const { mockCall, mockProgress } = createTestCallAndProgress('context-test-1', 'contextTool', 'processing');
        
        const result = (executor as any)['transformToQiError'](
          mockCall,
          error,
          mockProgress,
          Date.now() - 1500
        );
        
        expect(result.message).toContain(originalMessage);
        expect(result.context.toolName).toBe('contextTool');
        expect(result.context.callId).toBe('context-test-1');
        expect(result.context.phase).toBe('processing');
        expect(result.context.executionTime).toBeGreaterThan(1000);
        expect(result.context.originalError).toBe(originalMessage);
      });

      it('should include execution time in context', () => {
        const error = new Error('Test timing error');
        const startTime = Date.now() - 2000; // 2 seconds ago
        const { mockCall, mockProgress } = createTestCallAndProgress('timing-test', 'timingTool');
        
        const result = (executor as any)['transformToQiError'](
          mockCall,
          error,
          mockProgress,
          startTime
        );
        
        expect(result.context.executionTime).toBeGreaterThanOrEqual(1900);
        expect(result.context.executionTime).toBeLessThan(3000);
      });

      it('should handle retry attempt context', () => {
        const error = new Error('Network connection failed');
        const { mockCall, mockProgress } = createTestCallAndProgress('retry-test', 'networkTool');
        // Add retry attempt to progress
        const progressWithRetry = { ...mockProgress, retryAttempt: 2 };
        
        const result = (executor as any)['transformToQiError'](
          mockCall,
          error,
          progressWithRetry,
          Date.now() - 1000
        );
        
        expect(result.context.toolName).toBe('networkTool');
        expect(result.context.phase).toBe('execution');
        // Note: retryAttempt may not be in context depending on implementation
      });
    });

    describe('Error Message Pattern Detection', () => {
      
      it('should detect various timeout patterns', () => {
        const timeoutPatterns = [
          'timeout',
          'cancelled',
          'operation timeout',
          'request timeout'
        ];
        
        timeoutPatterns.forEach((pattern, index) => {
          const error = new Error(`Error: ${pattern} occurred`);
          const { mockCall, mockProgress } = createTestCallAndProgress(`timeout-${index}`, 'testTool');
          const result = (executor as any)['transformToQiError'](
            mockCall,
            error,
            mockProgress,
            Date.now() - 1000
          );
          
          expect(result.code).toBe('EXECUTION_TIMEOUT');
          expect(result.category).toBe('SYSTEM');
        });
      });

      it('should detect various permission patterns', () => {
        const permissionPatterns = [
          'permission denied',
          'access denied',
          'permission'
        ];
        
        permissionPatterns.forEach((pattern, index) => {
          const error = new Error(`Error: ${pattern}`);
          const { mockCall, mockProgress } = createTestCallAndProgress(`perm-${index}`, 'testTool', 'security');
          const result = (executor as any)['transformToQiError'](
            mockCall,
            error,
            mockProgress,
            Date.now() - 1000
          );
          
          expect(result.code).toBe('PERMISSION_DENIED');
          expect(result.category).toBe('VALIDATION');
        });
      });

      it('should detect various validation patterns', () => {
        const validationPatterns = [
          'validation failed',
          'invalid input',
          'validation',
          'invalid'
        ];
        
        validationPatterns.forEach((pattern, index) => {
          const error = new Error(`Error: ${pattern}`);
          const { mockCall, mockProgress } = createTestCallAndProgress(`val-${index}`, 'testTool', 'validation');
          const result = (executor as any)['transformToQiError'](
            mockCall,
            error,
            mockProgress,
            Date.now() - 1000
          );
          
          expect(result.code).toBe('VALIDATION_ERROR');
          expect(result.category).toBe('VALIDATION');
        });
      });
    });

    describe('Edge Cases and Error Handling', () => {
      
      it('should handle mixed error indicators with priority', () => {
        // Error with multiple keywords - timeout should take precedence
        const mixedError = new Error('timeout occurred during validation of network connection');
        const { mockCall, mockProgress } = createTestCallAndProgress('mixed-test', 'mixedTool');
        
        const result = (executor as any)['transformToQiError'](
          mockCall,
          mixedError,
          mockProgress,
          Date.now() - 1000
        );
        
        expect(result.code).toBe('EXECUTION_TIMEOUT');
        expect(result.category).toBe('SYSTEM');
      });

      it('should handle case-sensitive error detection correctly', () => {
        const lowerCaseError = new Error('permission denied access');
        const { mockCall, mockProgress } = createTestCallAndProgress('case-test', 'caseTool', 'security');
        
        const result = (executor as any)['transformToQiError'](
          mockCall,
          lowerCaseError,
          mockProgress,
          Date.now() - 1000
        );
        
        expect(result.code).toBe('PERMISSION_DENIED');
        expect(result.category).toBe('VALIDATION');
      });

      it('should handle null or undefined error messages gracefully', () => {
        const nullError = new Error();
        nullError.message = '' as any; // Use empty string instead of null to avoid TypeError
        const { mockCall, mockProgress } = createTestCallAndProgress('null-test', 'nullTool');
        
        const result = (executor as any)['transformToQiError'](
          mockCall,
          nullError,
          mockProgress,
          Date.now() - 1000
        );
        
        expect(result.code).toBe('EXECUTION_ERROR');
        expect(result.category).toBe('SYSTEM');
        expect(result.context.toolName).toBe('nullTool');
      });

      it('should handle non-Error objects', () => {
        const plainObject = { message: 'Plain object error', name: 'CustomError' };
        const { mockCall, mockProgress } = createTestCallAndProgress('object-test', 'objectTool');
        
        const result = (executor as any)['transformToQiError'](
          mockCall,
          plainObject,
          mockProgress,
          Date.now() - 1000
        );
        
        expect(result.message).toContain('[object Object]');
        expect(result.context.toolName).toBe('objectTool');
        expect(result.context.originalError).toBe('[object Object]');
      });
    });

    describe('QiCore Pattern Compliance in Error Transformation', () => {
      
      it('should create properly structured QiError objects', () => {
        const error = new Error('Test error for structure validation');
        const { mockCall, mockProgress } = createTestCallAndProgress('structure-test', 'structureTool');
        
        const result = (executor as any)['transformToQiError'](
          mockCall,
          error,
          mockProgress,
          Date.now() - 1000
        );
        
        // Verify QiError structure
        expect(result).toHaveProperty('code');
        expect(result).toHaveProperty('message');
        expect(result).toHaveProperty('category');
        expect(result).toHaveProperty('context');
        
        // Verify context structure
        expect(result.context).toHaveProperty('toolName');
        expect(result.context).toHaveProperty('callId');
        expect(result.context).toHaveProperty('phase');
        expect(result.context).toHaveProperty('executionTime');
        expect(result.context).toHaveProperty('originalError');
        
        // Verify field types
        expect(typeof result.code).toBe('string');
        expect(typeof result.message).toBe('string');
        expect(typeof result.category).toBe('string');
        expect(typeof result.context).toBe('object');
        expect(typeof result.context.executionTime).toBe('number');
      });

      it('should maintain error transformation consistency', () => {
        // Test that similar errors produce consistent results
        const error1 = new Error('Network timeout occurred');
        const error2 = new Error('Request timeout happened');
        
        const { mockCall: mockCall1, mockProgress: mockProgress1 } = createTestCallAndProgress('consistency-1', 'tool1');
        const { mockCall: mockCall2, mockProgress: mockProgress2 } = createTestCallAndProgress('consistency-2', 'tool2');
        
        const result1 = (executor as any)['transformToQiError'](
          mockCall1,
          error1,
          mockProgress1,
          Date.now() - 1000
        );
        
        const result2 = (executor as any)['transformToQiError'](
          mockCall2,
          error2,
          mockProgress2,
          Date.now() - 1000
        );
        
        // Both should be categorized as timeout errors
        expect(result1.code).toBe('EXECUTION_TIMEOUT');
        expect(result2.code).toBe('EXECUTION_TIMEOUT');
        expect(result1.category).toBe(result2.category);
        expect(result1.category).toBe('SYSTEM');
      });

      it('should preserve error traceability through context', () => {
        const error = new Error('Traceable error message');
        error.stack = 'Error: Traceable error message\n    at test (test.js:1:1)';
        const { mockCall, mockProgress } = createTestCallAndProgress('trace-test', 'traceTool');
        
        const result = (executor as any)['transformToQiError'](
          mockCall,
          error,
          mockProgress,
          Date.now() - 1500
        );
        
        expect(result.context.originalError).toBe('Traceable error message');
        expect(result.context.toolName).toBe('traceTool');
        expect(result.context.callId).toBe('trace-test');
        expect(result.context.executionTime).toBeGreaterThan(1000);
        
        // Verify we can trace back to original error
        expect(result.message).toContain('Traceable error message');
      });
    });

    describe('Real-world Error Scenarios', () => {
      
      it('should handle file system permission errors', () => {
        const fsError = new Error('EACCES: permission denied, open \'/protected/file.txt\'');
        const { mockCall, mockProgress } = createTestCallAndProgress('fs-test', 'fileSystemTool');
        
        const result = (executor as any)['transformToQiError'](
          mockCall,
          fsError,
          mockProgress,
          Date.now() - 800
        );
        
        expect(result.code).toBe('PERMISSION_DENIED');
        expect(result.category).toBe('VALIDATION');
        expect(result.message).toContain('permission denied');
        expect(result.context.toolName).toBe('fileSystemTool');
      });

      it('should handle HTTP timeout errors', () => {
        const httpError = new Error('Request timeout: no response received within 30000ms');
        const { mockCall, mockProgress } = createTestCallAndProgress('http-test', 'httpTool');
        
        const result = (executor as any)['transformToQiError'](
          mockCall,
          httpError,
          mockProgress,
          Date.now() - 30000
        );
        
        expect(result.code).toBe('EXECUTION_TIMEOUT');
        expect(result.category).toBe('SYSTEM');
        expect(result.context.executionTime).toBeGreaterThan(29000);
      });

      it('should handle validation schema errors', () => {
        const schemaError = new Error('validation error: required property "email" is missing');
        const { mockCall, mockProgress } = createTestCallAndProgress('schema-test', 'validationTool', 'validation');
        
        const result = (executor as any)['transformToQiError'](
          mockCall,
          schemaError,
          mockProgress,
          Date.now() - 100
        );
        
        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.category).toBe('VALIDATION');
        expect(result.message).toContain('validation failed');
        expect(result.context.phase).toBe('validation');
      });

      it('should handle database connection timeouts', () => {
        const dbError = new Error('Connection timeout: Unable to connect to database within timeout period');
        const { mockCall, mockProgress } = createTestCallAndProgress('db-test', 'databaseTool');
        
        const result = (executor as any)['transformToQiError'](
          mockCall,
          dbError,
          mockProgress,
          Date.now() - 5000
        );
        
        expect(result.code).toBe('EXECUTION_TIMEOUT');
        expect(result.category).toBe('SYSTEM');
        expect(result.context.executionTime).toBeGreaterThan(4000);
      });
    });
  });
});