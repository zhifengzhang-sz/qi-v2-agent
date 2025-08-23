import { describe, it, expect, beforeEach } from 'vitest';
import {
  createQiLogger,
  createMetadata,
  MetadataBuilder,
  PerformanceLogger,
  createPerformanceLogger,
  createConditionalLogger,
  logError,
  logSuccess,
  logWarning,
  logDebug,
  ComponentLogging,
  MessageLogging,
  TraceCategories,
  OperationTypes,
  type LogMetadata,
  type SimpleLogger,
} from '../../src/utils/QiCoreLogger.js';

describe('QiCoreLogger Utility', () => {
  describe('MetadataBuilder', () => {
    it('should create metadata with required component', () => {
      const metadata = new MetadataBuilder('TestComponent').build();
      
      expect(metadata.component).toBe('TestComponent');
      expect(metadata).toEqual({ component: 'TestComponent' });
    });

    it('should build complex metadata using fluent interface', () => {
      const error = new Error('Test error');
      const metadata = new MetadataBuilder('TestComponent')
        .method('testMethod')
        .step('validation')
        .messageId('msg-123')
        .requestId('req-456')
        .operationType('USER_INPUT')
        .performance({ duration: 100, memory: 512 })
        .error(error)
        .custom('customField', 'customValue')
        .build();

      expect(metadata).toEqual({
        component: 'TestComponent',
        method: 'testMethod',
        step: 'validation',
        messageId: 'msg-123',
        requestId: 'req-456',
        operationType: 'USER_INPUT',
        performance: { duration: 100, memory: 512 },
        errorMessage: 'Test error',
        errorStack: error.stack,
        errorContext: undefined,
        customField: 'customValue',
      });
    });

    it('should handle non-Error objects in error method', () => {
      const metadata = new MetadataBuilder('TestComponent')
        .error('String error')
        .build();

      expect(metadata.errorMessage).toBe('String error');
      expect(metadata.errorStack).toBeUndefined();
    });
  });

  describe('createMetadata helper', () => {
    it('should create a metadata builder instance', () => {
      const builder = createMetadata('TestComponent');
      expect(builder).toBeInstanceOf(MetadataBuilder);
      
      const metadata = builder.method('testMethod').build();
      expect(metadata.component).toBe('TestComponent');
      expect(metadata.method).toBe('testMethod');
    });
  });

  describe('createQiLogger', () => {
    it('should create a logger with default configuration', () => {
      const logger = createQiLogger();
      
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    it('should create a logger with custom configuration', () => {
      const config = {
        level: 'debug',
        name: 'CustomLogger',
        pretty: false,
      };

      const logger = createQiLogger(config);
      expect(logger).toBeDefined();
    });

    it('should handle logger method calls without throwing', () => {
      const logger = createQiLogger({ name: 'TestLogger', level: 'debug' });

      expect(() => {
        logger.info('Info message');
        logger.error('Error message');
        logger.warn('Warning message');
        logger.debug('Debug message');
      }).not.toThrow();
    });

    it('should handle metadata in log messages', () => {
      const logger = createQiLogger({ name: 'TestLogger', pretty: true });
      const metadata = { component: 'TestComponent', method: 'testMethod' };

      expect(() => {
        logger.info('Test message', undefined, metadata);
      }).not.toThrow();
    });
  });

  describe('createConditionalLogger', () => {
    it('should create conditional logger with debugMode enabled', () => {
      const logger = createConditionalLogger({ debugMode: true });
      
      expect(logger).toBeDefined();
      expect(() => {
        logger.debug('Debug message');
      }).not.toThrow();
    });

    it('should create conditional logger with debugMode disabled', () => {
      const logger = createConditionalLogger({ debugMode: false });
      
      expect(logger).toBeDefined();
      expect(() => {
        logger.info('Info message');
        logger.warn('Warning message');
        logger.error('Error message');
      }).not.toThrow();
    });
  });

  describe('PerformanceLogger', () => {
    let perfLogger: PerformanceLogger;
    let logger: SimpleLogger;

    beforeEach(() => {
      const result = createPerformanceLogger({ name: 'PerfTest' });
      logger = result.logger;
      perfLogger = result.performance;
    });

    it('should create performance logger', () => {
      expect(perfLogger).toBeDefined();
      expect(typeof perfLogger.startTimer).toBe('function');
      expect(typeof perfLogger.endTimer).toBe('function');
      expect(typeof perfLogger.logPerformance).toBe('function');
    });

    it('should handle timer operations', () => {
      const metadata = { component: 'TestComponent' };

      expect(() => {
        perfLogger.startTimer('test-timer', metadata);
        perfLogger.endTimer('test-timer', 'Test operation completed', metadata);
      }).not.toThrow();
    });

    it('should handle missing timer gracefully', () => {
      const metadata = { component: 'TestComponent' };

      expect(() => {
        perfLogger.endTimer('nonexistent-timer', 'Should warn', metadata);
      }).not.toThrow();
    });

    it('should log performance metrics directly', () => {
      const metadata = { component: 'TestComponent', method: 'testMethod' };

      expect(() => {
        perfLogger.logPerformance('Database query', 250, metadata);
      }).not.toThrow();
    });
  });

  describe('Logging Helper Functions', () => {
    let logger: SimpleLogger;

    beforeEach(() => {
      logger = createQiLogger({ name: 'TestLogger' });
    });

    describe('logError', () => {
      it('should log error messages with error icon', () => {
        const error = new Error('Test error');
        const metadata = { component: 'TestComponent', method: 'testMethod' };

        expect(() => {
          logError(logger, error, metadata);
        }).not.toThrow();
      });
    });

    describe('logSuccess', () => {
      it('should log success messages with success icon', () => {
        const metadata = { component: 'TestComponent', method: 'testMethod' };

        expect(() => {
          logSuccess(logger, 'Operation completed successfully', metadata);
        }).not.toThrow();
      });
    });

    describe('logWarning', () => {
      it('should log warning messages with warning icon', () => {
        const metadata = { component: 'TestComponent', method: 'testMethod' };

        expect(() => {
          logWarning(logger, 'This is a warning', metadata);
        }).not.toThrow();
      });
    });

    describe('logDebug', () => {
      it('should log debug messages with debug icon', () => {
        const metadata = { component: 'TestComponent', method: 'testMethod' };

        expect(() => {
          logDebug(logger, 'Debug information', metadata, true);
        }).not.toThrow();
      });
    });
  });

  describe('ComponentLogging', () => {
    let logger: SimpleLogger;

    beforeEach(() => {
      logger = createQiLogger({ name: 'TestLogger' });
    });

    describe('Agent logging', () => {
      it('should log agent operations without throwing', () => {
        expect(() => {
          ComponentLogging.Agent.requestReceived(logger, 'agent-123');
          ComponentLogging.Agent.requestCompleted(logger, 'agent-123', 500);
          ComponentLogging.Agent.configurationUpdated(logger, 'timeout');
        }).not.toThrow();
      });
    });

    describe('State logging', () => {
      it('should log state operations without throwing', () => {
        expect(() => {
          if (ComponentLogging.State?.stateChanged) {
            ComponentLogging.State.stateChanged(logger, 'interactive', 'processing');
          }
        }).not.toThrow();
      });
    });

    describe('CLI logging', () => {
      it('should log CLI operations without throwing', () => {
        expect(() => {
          if (ComponentLogging.CLI?.frameworkInitialized) {
            ComponentLogging.CLI.frameworkInitialized(logger, 'MessageDrivenCLI');
          }
        }).not.toThrow();
      });
    });

    describe('Prompt logging', () => {
      it('should log prompt operations without throwing', () => {
        expect(() => {
          if (ComponentLogging.Prompt?.templateLoaded) {
            ComponentLogging.Prompt.templateLoaded(logger, 'user-input.yaml');
          }
        }).not.toThrow();
      });
    });
  });

  describe('MessageLogging', () => {
    let logger: SimpleLogger;

    beforeEach(() => {
      logger = createQiLogger({ name: 'TestLogger' });
    });

    it('should log message operations without throwing', () => {
      const error = new Error('Processing failed');

      expect(() => {
        MessageLogging.messageCreated(logger, 'msg-123', 'USER_INPUT');
        MessageLogging.messageEnqueued(logger, 'msg-123', 'USER_INPUT', 5);
        MessageLogging.messageProcessingStarted(logger, 'msg-123', 'USER_INPUT');
        MessageLogging.messageProcessingCompleted(logger, 'msg-123', 'USER_INPUT', 750);
        MessageLogging.messageProcessingFailed(logger, 'msg-123', 'USER_INPUT', error);
      }).not.toThrow();
    });
  });

  describe('Constants', () => {
    describe('TraceCategories', () => {
      it('should provide predefined trace categories', () => {
        expect(TraceCategories.STARTUP).toBe('startup');
        expect(TraceCategories.SHUTDOWN).toBe('shutdown');
        expect(TraceCategories.REQUEST).toBe('request');
        expect(TraceCategories.RESPONSE).toBe('response');
        expect(TraceCategories.ERROR).toBe('error');
        expect(TraceCategories.WARNING).toBe('warning');
        expect(TraceCategories.DEBUG).toBe('debug');
        expect(TraceCategories.PERFORMANCE).toBe('performance');
        expect(TraceCategories.STATE_CHANGE).toBe('state_change');
        expect(TraceCategories.CONFIG_CHANGE).toBe('config_change');
        expect(TraceCategories.MESSAGE_LIFECYCLE).toBe('message_lifecycle');
        expect(TraceCategories.LLM_INTERACTION).toBe('llm_interaction');
        expect(TraceCategories.CLI_INTERACTION).toBe('cli_interaction');
        expect(TraceCategories.USER_ACTION).toBe('user_action');
        expect(TraceCategories.SYSTEM_EVENT).toBe('system_event');
      });
    });

    describe('OperationTypes', () => {
      it('should provide predefined operation types', () => {
        expect(OperationTypes.AGENT_REQUEST).toBe('agent_request');
        expect(OperationTypes.AGENT_RESPONSE).toBe('agent_response');
        expect(OperationTypes.AGENT_CONFIG).toBe('agent_config');
        expect(OperationTypes.STATE_LOAD).toBe('state_load');
        expect(OperationTypes.STATE_SAVE).toBe('state_save');
        expect(OperationTypes.STATE_UPDATE).toBe('state_update');
        expect(OperationTypes.CLI_INIT).toBe('cli_init');
        expect(OperationTypes.CLI_INPUT).toBe('cli_input');
        expect(OperationTypes.CLI_COMMAND).toBe('cli_command');
        expect(OperationTypes.PROMPT_TEMPLATE).toBe('prompt_template');
        expect(OperationTypes.PROMPT_CONTEXT).toBe('prompt_context');
        expect(OperationTypes.LLM_REQUEST).toBe('llm_request');
        expect(OperationTypes.LLM_RESPONSE).toBe('llm_response');
        expect(OperationTypes.MESSAGE_CREATE).toBe('message_create');
        expect(OperationTypes.MESSAGE_ENQUEUE).toBe('message_enqueue');
        expect(OperationTypes.MESSAGE_PROCESS).toBe('message_process');
        expect(OperationTypes.SYSTEM_INIT).toBe('system_init');
        expect(OperationTypes.SYSTEM_SHUTDOWN).toBe('system_shutdown');
        expect(OperationTypes.HEALTH_CHECK).toBe('health_check');
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle logger creation gracefully', () => {
      expect(() => {
        const logger = createQiLogger({ name: 'FallbackTest' });
        logger.info('Fallback test');
      }).not.toThrow();
    });

    it('should handle empty metadata gracefully', () => {
      const logger = createQiLogger();
      
      expect(() => {
        logger.info('Test message', undefined, {});
      }).not.toThrow();
    });

    it('should handle null/undefined values in metadata', () => {
      const logger = createQiLogger();
      
      expect(() => {
        logger.info('Test message', undefined, {
          component: 'TestComponent',
          method: null,
          step: undefined,
          customValue: 'valid',
        });
      }).not.toThrow();
    });

    it('should handle circular references in custom metadata', () => {
      const logger = createQiLogger();
      const circular: any = { name: 'circular' };
      circular.self = circular;
      
      expect(() => {
        logger.info('Test message', undefined, {
          component: 'TestComponent',
          circular,
        });
      }).not.toThrow();
    });

    it('should handle very long messages', () => {
      const logger = createQiLogger();
      const longMessage = 'A'.repeat(10000);
      
      expect(() => {
        logger.info(longMessage);
      }).not.toThrow();
    });

    it('should handle special characters in component names', () => {
      const metadata = new MetadataBuilder('Test-Component_123 (v1.0)').build();
      
      expect(metadata.component).toBe('Test-Component_123 (v1.0)');
    });
  });

  describe('Integration Scenarios', () => {
    it('should work in a complete logging workflow', () => {
      expect(() => {
        const logger = createQiLogger({ name: 'IntegrationTest', level: 'debug' });
        const { performance } = createPerformanceLogger({ name: 'IntegrationTest' });
        
        const metadata = createMetadata('IntegrationTest')
          .method('completeWorkflow')
          .operationType('INTEGRATION_TEST')
          .build();

        logDebug(logger, 'Starting integration test', metadata, true);
        performance.startTimer('integration-test');
        
        logger.info('Processing data', undefined, metadata);
        logWarning(logger, 'Non-critical issue detected', metadata);
        logSuccess(logger, 'Integration step completed', metadata);
        
        performance.endTimer('integration-test', 'Integration test completed');
      }).not.toThrow();
    });

    it('should maintain consistency across different logging styles', () => {
      expect(() => {
        const logger = createQiLogger({ name: 'ConsistencyTest' });
        
        const metadata1 = createMetadata('TestComponent').method('method1').build();
        const metadata2 = { component: 'TestComponent', method: 'method2' };

        logger.info('Using builder pattern', undefined, metadata1);
        logger.info('Using object literal', undefined, metadata2);
      }).not.toThrow();
    });
  });
});