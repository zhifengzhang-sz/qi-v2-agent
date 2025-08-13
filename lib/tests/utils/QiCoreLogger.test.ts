/**
 * QiCore Logger Tests
 *
 * Comprehensive tests for the logging utility including:
 * - Logger creation and fallback mechanisms
 * - Metadata building and validation
 * - Component-specific logging helpers
 * - Performance logging
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createQiLogger,
  createConditionalLogger,
  createPerformanceLogger,
  createMetadata,
  MetadataBuilder,
  logError,
  logSuccess,
  logWarning,
  logDebug,
  ComponentLogging,
  MessageLogging,
  TraceCategories,
  OperationTypes,
  type SimpleLogger,
  type LogMetadata,
} from '../../src/utils/QiCoreLogger.js';

// Mock console methods for testing fallback logger
const mockConsoleLog = vi.fn();
const mockConsoleError = vi.fn();
const mockConsoleWarn = vi.fn();

// Mock @qi/base match function
vi.mock('@qi/base', () => ({
  match: vi.fn((successFn, failureFn, result) => {
    if (result.ok) {
      return successFn(result.value);
    }
    return failureFn(result.error);
  }),
}));

// Mock QiCore logger to test both success and failure paths
vi.mock('@qi/core', () => ({
  createLogger: vi.fn(),
}));

import { createLogger as mockQiCreateLogger } from '@qi/core';

describe('QiCoreLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console methods
    global.console.log = mockConsoleLog;
    global.console.error = mockConsoleError;
    global.console.warn = mockConsoleWarn;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createQiLogger', () => {
    it('should create QiCore logger when available', () => {
      const mockQiLogger = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      };

      mockQiCreateLogger.mockReturnValue({
        ok: true,
        value: mockQiLogger,
      });

      const logger = createQiLogger({
        level: 'info',
        name: 'test-component',
        pretty: true,
      });

      // Test that logger methods are callable
      logger.info('Test message', undefined, { component: 'test' });
      logger.error('Error message', undefined, { component: 'test' });
      logger.warn('Warning message', undefined, { component: 'test' });
      logger.debug('Debug message', undefined, { component: 'test' });

      // Verify QiCore logger methods were called with correct parameters
      expect(mockQiLogger.info).toHaveBeenCalledWith('Test message', { component: 'test' });
      expect(mockQiLogger.error).toHaveBeenCalledWith('Error message', { component: 'test' });
      expect(mockQiLogger.warn).toHaveBeenCalledWith('Warning message', { component: 'test' });
      expect(mockQiLogger.debug).toHaveBeenCalledWith('Debug message', { component: 'test' });
    });

    it('should fall back to console logger when QiCore fails', () => {
      mockQiCreateLogger.mockReturnValue({
        ok: false,
        error: new Error('QiCore not available'),
      });

      const logger = createQiLogger({
        level: 'info',
        name: 'test-component',
        pretty: true,
      });

      logger.info('Test message', undefined, { component: 'test-component' });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/\[.*\] INFO \[test-component\]: Test message/),
        { component: 'test-component' }
      );
    });

    it('should fall back when QiCore throws exception', () => {
      mockQiCreateLogger.mockImplementation(() => {
        throw new Error('QiCore package not found');
      });

      const logger = createQiLogger({
        level: 'error',
        name: 'test-component',
        pretty: false,
      });

      logger.error('Error message');

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/\[.*\] ERROR \[test-component\]: Error message/)
      );
    });

    it('should respect log levels in fallback logger', () => {
      mockQiCreateLogger.mockImplementation(() => {
        throw new Error('QiCore not available');
      });

      const logger = createQiLogger({
        level: 'error',
        name: 'test-component',
      });

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');

      // Only error should be logged
      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/ERROR.*Error message/)
      );
    });
  });

  describe('createConditionalLogger', () => {
    it('should create logger that respects debugMode setting', () => {
      mockQiCreateLogger.mockImplementation(() => {
        throw new Error('Using fallback');
      });

      const debugLogger = createConditionalLogger({
        level: 'info',
        debugMode: true,
        name: 'test',
      });

      const nonDebugLogger = createConditionalLogger({
        level: 'info',
        debugMode: false,
        name: 'test',
      });

      // Test that both loggers exist and have methods
      expect(typeof debugLogger.debug).toBe('function');
      expect(typeof nonDebugLogger.debug).toBe('function');
      
      // Info messages should work for both
      debugLogger.info('Info message');
      expect(mockConsoleLog).toHaveBeenCalled();
      
      vi.clearAllMocks();
      
      nonDebugLogger.info('Info message 2');
      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('MetadataBuilder', () => {
    it('should build basic metadata', () => {
      const metadata = createMetadata('TestComponent')
        .method('testMethod')
        .step('validation')
        .build();

      expect(metadata).toEqual({
        component: 'TestComponent',
        method: 'testMethod',
        step: 'validation',
      });
    });

    it('should build metadata with performance data', () => {
      const metadata = createMetadata('TestComponent')
        .method('testMethod')
        .performance({ duration: 123, startTime: 1000 })
        .build();

      expect(metadata).toEqual({
        component: 'TestComponent',
        method: 'testMethod',
        performance: {
          duration: 123,
          startTime: 1000,
        },
      });
    });

    it('should build metadata with error information', () => {
      const error = new Error('Test error');
      const metadata = createMetadata('TestComponent')
        .method('testMethod')
        .error(error)
        .build();

      expect(metadata).toEqual({
        component: 'TestComponent',
        method: 'testMethod',
        errorMessage: 'Test error',
        errorStack: expect.any(String),
        errorContext: undefined,
      });
    });

    it('should build metadata with custom fields', () => {
      const metadata = createMetadata('TestComponent')
        .custom('requestId', 'req-123')
        .custom('userId', 'user-456')
        .build();

      expect(metadata).toEqual({
        component: 'TestComponent',
        requestId: 'req-123',
        userId: 'user-456',
      });
    });

    it('should support method chaining', () => {
      const metadata = createMetadata('TestComponent')
        .method('testMethod')
        .step('processing')
        .messageId('msg-123')
        .requestId('req-456')
        .operationType('test_operation')
        .custom('extra', 'value')
        .build();

      expect(metadata).toEqual({
        component: 'TestComponent',
        method: 'testMethod',
        step: 'processing',
        messageId: 'msg-123',
        requestId: 'req-456',
        operationType: 'test_operation',
        extra: 'value',
      });
    });
  });

  describe('Performance Logger', () => {
    it('should track timer operations', () => {
      mockQiCreateLogger.mockImplementation(() => {
        throw new Error('Using fallback');
      });

      const { performance } = createPerformanceLogger({
        name: 'test-component',
        level: 'info', // Use info level to capture both debug and info calls
      });

      performance.startTimer('test-operation', { component: 'TestComponent' });
      performance.endTimer('test-operation', 'Operation completed', { 
        component: 'TestComponent' 
      });

      // Check that at least one call was made (endTimer uses info level)
      expect(mockConsoleLog).toHaveBeenCalled();
      
      // Check end timer call which should definitely be logged
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/Operation completed/),
        expect.objectContaining({
          component: 'TestComponent',
          trace: 'performance_end',
          timerId: 'test-operation',
          performance: expect.objectContaining({
            duration: expect.any(Number),
            startTime: expect.any(Number),
            endTime: expect.any(Number),
          }),
        })
      );
    });

    it('should handle missing timer gracefully', () => {
      mockQiCreateLogger.mockImplementation(() => {
        throw new Error('Using fallback');
      });

      const { performance } = createPerformanceLogger({
        name: 'test-component',
        level: 'warn',
      });

      performance.endTimer('non-existent-timer', 'This should warn');

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/Timer not found: non-existent-timer/),
        expect.objectContaining({
          timerId: 'non-existent-timer',
        })
      );
    });

    it('should log performance metrics', () => {
      mockQiCreateLogger.mockImplementation(() => {
        throw new Error('Using fallback');
      });

      const { performance } = createPerformanceLogger({
        name: 'test-component',
        level: 'info',
      });

      performance.logPerformance('database_query', 150, {
        component: 'DatabaseHandler',
      });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/Performance: database_query/),
        expect.objectContaining({
          component: 'DatabaseHandler',
          trace: 'performance_metric',
          operation: 'database_query',
          performance: {
            duration: 150,
          },
        })
      );
    });
  });

  describe('Logging Helper Functions', () => {
    let mockLogger: SimpleLogger;

    beforeEach(() => {
      mockLogger = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      };
    });

    it('should log errors with proper metadata', () => {
      const error = new Error('Test error');
      const context: LogMetadata = {
        component: 'TestComponent',
        method: 'testMethod',
      };

      logError(mockLogger, error, context);

      expect(mockLogger.error).toHaveBeenCalledWith(
        '❌ Error occurred',
        undefined,
        expect.objectContaining({
          component: 'TestComponent',
          method: 'testMethod',
          errorMessage: 'Test error',
          errorStack: expect.any(String),
          trace: 'error',
        })
      );
    });

    it('should log success messages', () => {
      const context: LogMetadata = {
        component: 'TestComponent',
        method: 'testMethod',
      };

      logSuccess(mockLogger, 'Operation completed', context);

      expect(mockLogger.info).toHaveBeenCalledWith(
        '✅ Operation completed',
        undefined,
        expect.objectContaining({
          component: 'TestComponent',
          method: 'testMethod',
          trace: 'success',
        })
      );
    });

    it('should log warnings', () => {
      const context: LogMetadata = {
        component: 'TestComponent',
        method: 'testMethod',
      };

      logWarning(mockLogger, 'Deprecated method used', context);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '⚠️ Deprecated method used',
        undefined,
        expect.objectContaining({
          component: 'TestComponent',
          method: 'testMethod',
          trace: 'warning',
        })
      );
    });

    it('should log debug messages when debug mode is enabled', () => {
      const context: LogMetadata = {
        component: 'TestComponent',
        method: 'testMethod',
        debugMode: true,
      };

      logDebug(mockLogger, 'Debug information', context);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        '🔍 Debug information',
        undefined,
        expect.objectContaining({
          component: 'TestComponent',
          method: 'testMethod',
          trace: 'debug',
        })
      );
    });

    it('should not log debug messages when debug mode is disabled', () => {
      const context: LogMetadata = {
        component: 'TestComponent',
        method: 'testMethod',
        debugMode: false,
      };

      logDebug(mockLogger, 'Debug information', context);

      expect(mockLogger.debug).not.toHaveBeenCalled();
    });
  });

  describe('Component Logging Helpers', () => {
    let mockLogger: SimpleLogger;

    beforeEach(() => {
      mockLogger = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      };
    });

    describe('Agent Logging', () => {
      it('should log agent request received', () => {
        ComponentLogging.Agent.requestReceived(mockLogger, 'req-123');

        expect(mockLogger.info).toHaveBeenCalledWith(
          '🔄 Agent request received',
          undefined,
          expect.objectContaining({
            component: 'Agent',
            method: 'handleRequest',
            requestId: 'req-123',
            operationType: 'request_received',
            trace: 'agent_request',
          })
        );
      });

      it('should log agent request completed with performance', () => {
        ComponentLogging.Agent.requestCompleted(mockLogger, 'req-123', 250);

        expect(mockLogger.info).toHaveBeenCalledWith(
          '✅ Agent request completed',
          undefined,
          expect.objectContaining({
            component: 'Agent',
            method: 'handleRequest',
            requestId: 'req-123',
            operationType: 'request_completed',
            performance: { duration: 250 },
            trace: 'agent_response',
          })
        );
      });

      it('should log configuration updates', () => {
        ComponentLogging.Agent.configurationUpdated(mockLogger, 'model', {
          version: '1.0.0',
        });

        expect(mockLogger.info).toHaveBeenCalledWith(
          '⚙️ Agent configuration updated',
          undefined,
          expect.objectContaining({
            component: 'Agent',
            method: 'updateConfiguration',
            operationType: 'config_update',
            configKey: 'model',
            trace: 'agent_config',
            version: '1.0.0',
          })
        );
      });
    });

    describe('State Logging', () => {
      it('should log state changes', () => {
        ComponentLogging.State.stateChanged(
          mockLogger,
          'userName',
          'oldName',
          'newName'
        );

        expect(mockLogger.debug).toHaveBeenCalledWith(
          '🔄 State changed',
          undefined,
          expect.objectContaining({
            component: 'StateManager',
            method: 'updateState',
            operationType: 'state_change',
            field: 'userName',
            oldValue: 'oldName',
            newValue: 'newName',
            trace: 'state_update',
          })
        );
      });

      it('should log state loading', () => {
        ComponentLogging.State.stateLoaded(mockLogger, 'localStorage');

        expect(mockLogger.info).toHaveBeenCalledWith(
          '📂 State loaded',
          undefined,
          expect.objectContaining({
            component: 'StateManager',
            method: 'loadState',
            operationType: 'state_load',
            source: 'localStorage',
            trace: 'state_init',
          })
        );
      });

      it('should log state persistence', () => {
        ComponentLogging.State.statePersisted(mockLogger, 'database');

        expect(mockLogger.info).toHaveBeenCalledWith(
          '💾 State persisted',
          undefined,
          expect.objectContaining({
            component: 'StateManager',
            method: 'persistState',
            operationType: 'state_persist',
            target: 'database',
            trace: 'state_save',
          })
        );
      });
    });

    describe('CLI Logging', () => {
      it('should log framework initialization', () => {
        ComponentLogging.CLI.frameworkInitialized(mockLogger, 'hybrid');

        expect(mockLogger.info).toHaveBeenCalledWith(
          '🚀 CLI Framework initialized',
          undefined,
          expect.objectContaining({
            component: 'CLIFramework',
            method: 'initialize',
            operationType: 'framework_init',
            frameworkType: 'hybrid',
            trace: 'cli_init',
          })
        );
      });

      it('should log input received', () => {
        ComponentLogging.CLI.inputReceived(mockLogger, 25);

        expect(mockLogger.debug).toHaveBeenCalledWith(
          '⌨️ User input received',
          undefined,
          expect.objectContaining({
            component: 'CLIFramework',
            method: 'handleInput',
            operationType: 'user_input',
            inputLength: 25,
            trace: 'cli_input',
          })
        );
      });

      it('should log command execution', () => {
        ComponentLogging.CLI.commandExecuted(mockLogger, '/help', 150);

        expect(mockLogger.info).toHaveBeenCalledWith(
          '⚡ Command executed',
          undefined,
          expect.objectContaining({
            component: 'CLIFramework',
            method: 'executeCommand',
            operationType: 'command_execution',
            command: '/help',
            performance: { duration: 150 },
            trace: 'cli_command',
          })
        );
      });
    });

    describe('Prompt Logging', () => {
      it('should log template loading', () => {
        ComponentLogging.Prompt.templateLoaded(
          mockLogger,
          'chat',
          'templates/chat.hbs'
        );

        expect(mockLogger.debug).toHaveBeenCalledWith(
          '📄 Template loaded',
          undefined,
          expect.objectContaining({
            component: 'PromptHandler',
            method: 'loadTemplate',
            operationType: 'template_load',
            templateType: 'chat',
            templateSource: 'templates/chat.hbs',
            trace: 'prompt_template',
          })
        );
      });

      it('should log context processing', () => {
        ComponentLogging.Prompt.contextProcessed(mockLogger, 1024, 50);

        expect(mockLogger.debug).toHaveBeenCalledWith(
          '🧠 Context processed',
          undefined,
          expect.objectContaining({
            component: 'PromptHandler',
            method: 'processContext',
            operationType: 'context_processing',
            contextSize: 1024,
            performance: { duration: 50 },
            trace: 'prompt_context',
          })
        );
      });

      it('should log LLM request', () => {
        ComponentLogging.Prompt.llmRequestSent(
          mockLogger,
          'openai',
          'gpt-4',
          2048
        );

        expect(mockLogger.info).toHaveBeenCalledWith(
          '🤖 LLM request sent',
          undefined,
          expect.objectContaining({
            component: 'PromptHandler',
            method: 'sendLLMRequest',
            operationType: 'llm_request',
            provider: 'openai',
            model: 'gpt-4',
            promptLength: 2048,
            trace: 'llm_interaction',
          })
        );
      });

      it('should log LLM response', () => {
        ComponentLogging.Prompt.llmResponseReceived(
          mockLogger,
          'openai',
          'gpt-4',
          512,
          1500
        );

        expect(mockLogger.info).toHaveBeenCalledWith(
          '📝 LLM response received',
          undefined,
          expect.objectContaining({
            component: 'PromptHandler',
            method: 'receiveLLMResponse',
            operationType: 'llm_response',
            provider: 'openai',
            model: 'gpt-4',
            responseLength: 512,
            performance: { duration: 1500 },
            trace: 'llm_interaction',
          })
        );
      });
    });
  });

  describe('Message Logging Helpers', () => {
    let mockLogger: SimpleLogger;

    beforeEach(() => {
      mockLogger = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      };
    });

    it('should log message creation', () => {
      MessageLogging.messageCreated(mockLogger, 'msg-123', 'user_input');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        '📤 Message created',
        undefined,
        expect.objectContaining({
          component: 'MessageFactory',
          messageId: 'msg-123',
          messageType: 'user_input',
          operationType: 'message_creation',
          trace: 'message_lifecycle',
        })
      );
    });

    it('should log message enqueuing', () => {
      MessageLogging.messageEnqueued(mockLogger, 'msg-123', 'user_input', 5);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        '📥 Message enqueued',
        undefined,
        expect.objectContaining({
          component: 'MessageQueue',
          messageId: 'msg-123',
          messageType: 'user_input',
          queueSize: 5,
          operationType: 'message_enqueue',
          trace: 'message_lifecycle',
        })
      );
    });

    it('should log message processing start', () => {
      MessageLogging.messageProcessingStarted(mockLogger, 'msg-123', 'user_input');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        '⏳ Message processing started',
        undefined,
        expect.objectContaining({
          component: 'MessageProcessor',
          messageId: 'msg-123',
          messageType: 'user_input',
          operationType: 'message_processing_start',
          trace: 'message_lifecycle',
        })
      );
    });

    it('should log message processing completion', () => {
      MessageLogging.messageProcessingCompleted(
        mockLogger,
        'msg-123',
        'user_input',
        250
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        '✅ Message processing completed',
        undefined,
        expect.objectContaining({
          component: 'MessageProcessor',
          messageId: 'msg-123',
          messageType: 'user_input',
          performance: { duration: 250 },
          operationType: 'message_processing_complete',
          trace: 'message_lifecycle',
        })
      );
    });

    it('should log message processing failure', () => {
      const error = new Error('Processing failed');
      MessageLogging.messageProcessingFailed(
        mockLogger,
        'msg-123',
        'user_input',
        error
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        '❌ Error occurred',
        undefined,
        expect.objectContaining({
          component: 'MessageProcessor',
          messageId: 'msg-123',
          messageType: 'user_input',
          operationType: 'message_processing_error',
          trace: 'error', // logError sets trace to 'error', not 'message_lifecycle'
          errorMessage: 'Processing failed',
          errorStack: expect.any(String),
        })
      );
    });
  });

  describe('Constants and Types', () => {
    it('should provide consistent trace categories', () => {
      expect(TraceCategories.STARTUP).toBe('startup');
      expect(TraceCategories.REQUEST).toBe('request');
      expect(TraceCategories.ERROR).toBe('error');
      expect(TraceCategories.PERFORMANCE).toBe('performance');
      expect(TraceCategories.MESSAGE_LIFECYCLE).toBe('message_lifecycle');
      expect(TraceCategories.LLM_INTERACTION).toBe('llm_interaction');
    });

    it('should provide consistent operation types', () => {
      expect(OperationTypes.AGENT_REQUEST).toBe('agent_request');
      expect(OperationTypes.STATE_LOAD).toBe('state_load');
      expect(OperationTypes.CLI_INIT).toBe('cli_init');
      expect(OperationTypes.LLM_REQUEST).toBe('llm_request');
      expect(OperationTypes.MESSAGE_CREATE).toBe('message_create');
      expect(OperationTypes.SYSTEM_INIT).toBe('system_init');
    });
  });
});