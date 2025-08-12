/**
 * Tests for QiMessageFactory
 * 
 * Comprehensive test suite for message factory functionality using proper QiCore Result<T> patterns
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { match } from '@qi/base';
import { 
  QiMessageFactory,
  MessageType,
  MessagePriority,
  type CommandMessage,
  type UserInputMessage,
  type AgentOutputMessage,
  type SystemControlMessage
} from '@qi/agent/messaging';

describe('QiMessageFactory', () => {
  let factory: QiMessageFactory;

  beforeEach(() => {
    factory = new QiMessageFactory();
  });

  describe('createMessage', () => {
    it('should create valid message with base properties', () => {
      const result = factory.createMessage(MessageType.USER_INPUT, {
        input: 'test input',
        source: 'cli' as const,
        raw: false,
        priority: MessagePriority.NORMAL
      });

      match(
        message => {
          expect(message.id).toBeDefined();
          expect(message.type).toBe(MessageType.USER_INPUT);
          expect(message.timestamp).toBeInstanceOf(Date);
          expect(message.priority).toBe(MessagePriority.NORMAL);
        },
        error => {
          throw new Error(`Expected success but got error: ${error.message}`);
        },
        result
      );
    });

    it('should reject invalid message type', () => {
      const result = factory.createMessage('invalid_type' as any, {
        input: 'test'
      });

      match(
        message => {
          throw new Error(`Expected error but got success: ${JSON.stringify(message)}`);
        },
        error => {
          expect(error.code).toBe('INVALID_MESSAGE_TYPE');
        },
        result
      );
    });

    it('should generate unique IDs for messages', () => {
      const result1 = factory.createMessage(MessageType.USER_INPUT, {
        input: 'test 1',
        source: 'cli' as const,
        raw: false,
        priority: MessagePriority.NORMAL
      });

      const result2 = factory.createMessage(MessageType.USER_INPUT, {
        input: 'test 2',
        source: 'cli' as const,
        raw: false,
        priority: MessagePriority.NORMAL
      });

      // Test that both results are successful and have different IDs
      match(
        message1 => {
          match(
            message2 => {
              expect(message1.id).not.toBe(message2.id);
            },
            error => {
              throw new Error(`Expected result2 to be success but got error: ${error.message}`);
            },
            result2
          );
        },
        error => {
          throw new Error(`Expected result1 to be success but got error: ${error.message}`);
        },
        result1
      );
    });
  });

  describe('createCommandMessage', () => {
    it('should create valid command message', () => {
      const result = factory.createCommandMessage(
        'test-command',
        ['arg1', 'arg2'],
        { executionId: 'exec-123' }
      );

      match(
        message => {
          const commandMessage = message as CommandMessage;
          expect(commandMessage.type).toBe(MessageType.COMMAND);
          expect(commandMessage.command).toBe('test-command');
          expect(commandMessage.args).toEqual(['arg1', 'arg2']);
          expect(commandMessage.context.executionId).toBe('exec-123');
          expect(commandMessage.priority).toBe(MessagePriority.NORMAL);
        },
        error => {
          throw new Error(`Expected success but got error: ${error.message}`);
        },
        result
      );
    });

    it('should reject empty command', () => {
      const result = factory.createCommandMessage(
        '',
        [],
        { executionId: 'exec-123' }
      );

      match(
        message => {
          throw new Error(`Expected error but got success: ${JSON.stringify(message)}`);
        },
        error => {
          expect(error.code).toBe('INVALID_COMMAND');
        },
        result
      );
    });

    it('should reject invalid args', () => {
      const result = factory.createCommandMessage(
        'test-command',
        'not-an-array' as any,
        { executionId: 'exec-123' }
      );

      match(
        message => {
          throw new Error(`Expected error but got success: ${JSON.stringify(message)}`);
        },
        error => {
          expect(error.code).toBe('INVALID_ARGS');
        },
        result
      );
    });

    it('should reject missing execution context', () => {
      const result = factory.createCommandMessage(
        'test-command',
        ['arg1'],
        {} as any
      );

      match(
        message => {
          throw new Error(`Expected error but got success: ${JSON.stringify(message)}`);
        },
        error => {
          expect(error.code).toBe('INVALID_CONTEXT');
        },
        result
      );
    });
  });

  describe('createUserInputMessage', () => {
    it('should create valid user input message', () => {
      const result = factory.createUserInputMessage('test input', 'cli', false);

      match(
        message => {
          const userMessage = message as UserInputMessage;
          expect(userMessage.type).toBe(MessageType.USER_INPUT);
          expect(userMessage.input).toBe('test input');
          expect(userMessage.source).toBe('cli');
          expect(userMessage.raw).toBe(false);
          expect(userMessage.priority).toBe(MessagePriority.NORMAL);
        },
        error => {
          throw new Error(`Expected success but got error: ${error.message}`);
        },
        result
      );
    });

    it('should reject non-string input', () => {
      const result = factory.createUserInputMessage(123 as any, 'cli');

      match(
        message => {
          throw new Error(`Expected error but got success: ${JSON.stringify(message)}`);
        },
        error => {
          expect(error.code).toBe('INVALID_INPUT');
        },
        result
      );
    });

    it('should reject invalid source', () => {
      const result = factory.createUserInputMessage('test', 'invalid' as any);

      match(
        message => {
          throw new Error(`Expected error but got success: ${JSON.stringify(message)}`);
        },
        error => {
          expect(error.code).toBe('INVALID_SOURCE');
        },
        result
      );
    });
  });

  describe('createAgentOutputMessage', () => {
    it('should create valid agent output message', () => {
      const result = factory.createAgentOutputMessage('test output', 'text', false);

      match(
        message => {
          const agentMessage = message as AgentOutputMessage;
          expect(agentMessage.type).toBe(MessageType.AGENT_OUTPUT);
          expect(agentMessage.content).toBe('test output');
          expect(agentMessage.format).toBe('text');
          expect(agentMessage.streaming).toBe(false);
          expect(agentMessage.priority).toBe(MessagePriority.NORMAL);
        },
        error => {
          throw new Error(`Expected success but got error: ${error.message}`);
        },
        result
      );
    });

    it('should validate JSON format', () => {
      const result = factory.createAgentOutputMessage('{"key": "value"}', 'json');

      match(
        message => {
          const agentMessage = message as AgentOutputMessage;
          expect(agentMessage.content).toBe('{"key": "value"}');
          expect(agentMessage.format).toBe('json');
        },
        error => {
          throw new Error(`Expected success but got error: ${error.message}`);
        },
        result
      );
    });

    it('should reject invalid JSON format', () => {
      const result = factory.createAgentOutputMessage('invalid json', 'json');

      match(
        message => {
          throw new Error(`Expected error but got success: ${JSON.stringify(message)}`);
        },
        error => {
          expect(error.code).toBe('INVALID_JSON');
        },
        result
      );
    });

    it('should reject invalid format', () => {
      const result = factory.createAgentOutputMessage('test', 'invalid' as any);

      match(
        message => {
          throw new Error(`Expected error but got success: ${JSON.stringify(message)}`);
        },
        error => {
          expect(error.code).toBe('INVALID_FORMAT');
        },
        result
      );
    });
  });

  describe('createSystemControlMessage', () => {
    it('should create valid system control message', () => {
      const result = factory.createSystemControlMessage('pause', true, 'Testing');

      match(
        message => {
          const systemMessage = message as SystemControlMessage;
          expect(systemMessage.type).toBe(MessageType.SYSTEM_CONTROL);
          expect(systemMessage.action).toBe('pause');
          expect(systemMessage.immediate).toBe(true);
          expect(systemMessage.reason).toBe('Testing');
          expect(systemMessage.priority).toBe(MessagePriority.HIGH);
        },
        error => {
          throw new Error(`Expected success but got error: ${error.message}`);
        },
        result
      );
    });

    it('should reject invalid action', () => {
      const result = factory.createSystemControlMessage('invalid' as any);

      match(
        message => {
          throw new Error(`Expected error but got success: ${JSON.stringify(message)}`);
        },
        error => {
          expect(error.code).toBe('INVALID_ACTION');
        },
        result
      );
    });
  });

  describe('static methods', () => {
    it('should create unique correlation IDs', () => {
      const id1 = QiMessageFactory.createCorrelationId();
      const id2 = QiMessageFactory.createCorrelationId();
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });
  });

  describe('message validation', () => {
    it('should validate message structure during creation', () => {
      const result = factory.createMessage(MessageType.USER_INPUT, {
        input: 'test input',
        source: 'cli' as const,
        raw: false,
        priority: MessagePriority.NORMAL
      });

      match(
        message => {
          // Message should have all required base properties
          expect(message.id).toBeDefined();
          expect(message.type).toBe(MessageType.USER_INPUT);
          expect(message.timestamp).toBeInstanceOf(Date);
          expect(message.priority).toBe(MessagePriority.NORMAL);
          
          // Type-specific properties should be present
          const userMessage = message as UserInputMessage;
          expect(userMessage.input).toBe('test input');
          expect(userMessage.source).toBe('cli');
          expect(userMessage.raw).toBe(false);
        },
        error => {
          throw new Error(`Expected success but got error: ${error.message}`);
        },
        result
      );
    });
  });
});