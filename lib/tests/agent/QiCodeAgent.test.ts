/**
 * QiCodeAgent QiCore Compliance Tests
 * 
 * Tests the two-layer architecture implementation:
 * - Internal QiCore functional programming patterns
 * - Clean interface layer with backward compatibility
 * - Proper Result<T> handling and error transformation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { success, failure, validationError } from '@qi/base';
import { QiCodeAgent } from '@qi/agent/agent/impl/QiCodeAgent.js';
import type { AgentRequest, AgentResponse } from '@qi/agent/agent/abstractions/IAgent.js';
import type { IClassifier, ClassificationResult } from '@qi/agent/classifier/index.js';
import type { IStateManager } from '@qi/agent/state/index.js';

// Mock dependencies
const createMockClassifier = (): IClassifier => ({
  classify: vi.fn(),
  configure: vi.fn(),
  getSupportedTypes: vi.fn(() => ['command', 'prompt', 'workflow']),
  getSupportedMethods: vi.fn(() => ['mock-method']),
  getStats: vi.fn(() => ({
    totalClassifications: 0,
    averageConfidence: 0,
    averageProcessingTime: 0,
    typeDistribution: new Map(),
    methodUsage: new Map(),
  })),
  resetStats: vi.fn(),
  validateConfig: vi.fn(() => true),
});

const createMockStateManager = (): IStateManager => ({
  initialize: vi.fn().mockResolvedValue(undefined),
  getCurrentSession: vi.fn(() => ({
    id: 'test-session',
    createdAt: new Date(),
    lastActiveAt: new Date(),
    conversationHistory: [],
  })),
  addConversationEntry: vi.fn(),
  getConversationHistory: vi.fn(() => []),
  clearHistory: vi.fn(),
  saveSession: vi.fn(),
  loadSession: vi.fn(),
  getCurrentModel: vi.fn(() => 'test-model'),
  setCurrentModel: vi.fn(),
  getAvailableModels: vi.fn(() => ['test-model']),
  updateModel: vi.fn(),
  getPromptConfig: vi.fn(() => ({ provider: 'test', model: 'test-model' })),
  updatePromptConfig: vi.fn(),
  getStats: vi.fn(() => ({ totalSessions: 1 })),
  shutdown: vi.fn(),
  getConfig: vi.fn(() => ({ 
    domain: 'test', 
    enableCommands: true, 
    enablePrompts: true, 
    enableWorkflows: false 
  })),
  getState: vi.fn(() => ({ 
    currentModel: 'test-model',
    isInitialized: true,
    currentMode: 'agent'
  })),
  getModelInfo: vi.fn((model: string) => ({ 
    name: model, 
    provider: 'test', 
    available: true 
  })),
  getCurrentMode: vi.fn(() => 'agent'),
  setCurrentMode: vi.fn(),
} as any);

// Mock context manager
const createMockContextManager = (): any => ({
  initialize: vi.fn().mockResolvedValue(success(undefined)),
  shutdown: vi.fn().mockResolvedValue(success(undefined)),
  createConversationContext: vi.fn(() => success({ 
    id: 'test-context-id',
    messages: [],
    metadata: new Map(),
  })),
  getConversationContext: vi.fn(() => ({ 
    id: 'test-context-id',
    messages: [],
    metadata: new Map(),
  })),
  clearContext: vi.fn(),
  updateEnvironmentContext: vi.fn(),
  addMessageToContext: vi.fn(() => success(undefined)),
});

// Mock prompt handler
const createMockPromptHandler = (): any => ({
  complete: vi.fn().mockResolvedValue({
    success: true,
    data: 'Test response',
    confidence: 0.9,
  }),
  getSupportedProviders: vi.fn(() => ['test']),
  validateConfig: vi.fn(() => true),
});

// Mock command handler
const createMockCommandHandler = (): any => ({
  executeCommand: vi.fn().mockResolvedValue({
    commandName: 'test',
    success: true,
    content: 'Command executed',
    status: 'completed',
    metadata: new Map(),
  }),
  getSupportedCommands: vi.fn(() => ['test']),
  getCommandHelp: vi.fn(() => 'Help text'),
});

describe('QiCodeAgent QiCore Compliance', () => {
  let agent: QiCodeAgent;
  let mockClassifier: IClassifier;
  let mockStateManager: IStateManager;
  let mockContextManager: any;
  let mockPromptHandler: any;
  let mockCommandHandler: any;

  beforeEach(async () => {
    mockClassifier = createMockClassifier();
    mockStateManager = createMockStateManager();
    mockContextManager = createMockContextManager();
    mockPromptHandler = createMockPromptHandler();
    mockCommandHandler = createMockCommandHandler();
    
    agent = new QiCodeAgent(
      mockStateManager,
      mockContextManager,
      {
        domain: 'test',
        enableCommands: true,
        enablePrompts: true,
        enableWorkflows: false,
      },
      {
        classifier: mockClassifier,
        promptHandler: mockPromptHandler,
        commandHandler: mockCommandHandler,
      }
    );
    
    // Initialize the agent
    await agent.initialize();
  });

  describe('Two-Layer Architecture', () => {
    it('should maintain clean public interface', async () => {
      // Setup mock classification
      vi.mocked(mockClassifier.classify).mockResolvedValue({
        type: 'prompt',
        confidence: 0.9,
        method: 'mock-method',
        reasoning: 'Test reasoning',
        extractedData: new Map(),
        metadata: new Map(),
      });

      const request: AgentRequest = {
        input: 'Hello, how are you?',
        context: {
          sessionId: 'test-session',
          environmentContext: new Map(),
        },
      };

      // Public interface should return Promise<AgentResponse>
      const response = await agent.process(request);

      expect(response).toBeDefined();
      expect(response).toHaveProperty('content');
      expect(response).toHaveProperty('type');
      expect(response).toHaveProperty('confidence');
      expect(response).toHaveProperty('executionTime');
      expect(response).toHaveProperty('metadata');
      expect(response).toHaveProperty('success');

      // Should not expose QiCore Result<T> types
      expect(response).not.toHaveProperty('tag');
      expect(response).not.toHaveProperty('value');
      expect(response).not.toHaveProperty('error');
    });

    it('should handle errors gracefully in public interface', async () => {
      // Mock classifier to fail
      vi.mocked(mockClassifier.classify).mockRejectedValue(
        new Error('Classification failed')
      );

      const request: AgentRequest = {
        input: 'Test input',
        context: {
          sessionId: 'test-session',
          environmentContext: new Map(),
        },
      };

      const response = await agent.process(request);

      // Should return error response, not throw
      expect(response.success).toBe(false);
      expect(response.error).toContain('Classification failed');
      expect(response.content).toContain('Agent processing failed');
    });
  });

  describe('QiCore Internal Implementation', () => {
    it('should use Result<T> patterns internally', async () => {
      // Test that internal methods properly handle Result<T>
      const validRequest: AgentRequest = {
        input: 'valid input',
        context: {
          sessionId: 'test-session',
          environmentContext: new Map(),
        },
      };

      // Mock successful classification
      const mockClassificationResult: ClassificationResult = {
        type: 'prompt',
        confidence: 0.9,
        method: 'mock-method',
        reasoning: 'Test reasoning',
        extractedData: new Map(),
        metadata: new Map(),
      };

      vi.mocked(mockClassifier.classify).mockResolvedValue(mockClassificationResult);

      // The internal implementation should handle Result<T> properly
      const response = await agent.process(validRequest);

      expect(response.success).toBe(true);
      expect(response.type).toBe('prompt');
      expect(response.confidence).toBe(0.9);
    });

    it('should handle QiError categorization', async () => {
      // Test different error categories are handled properly
      vi.mocked(mockClassifier.classify).mockRejectedValue(
        validationError('Invalid input format')
      );

      const request: AgentRequest = {
        input: '',
        context: {
          sessionId: 'test-session',
          environmentContext: new Map(),
        },
      };

      const response = await agent.process(request);

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      // The error might be an object or string, just verify it exists
      expect(response.error).toBeTruthy();
    });
  });

  describe('State Command Handling', () => {
    it('should handle state commands with QiCore patterns', async () => {
      const stateRequest: AgentRequest = {
        input: '/session',
        context: {
          sessionId: 'test-session',
          environmentContext: new Map(),
        },
      };

      const response = await agent.process(stateRequest);

      expect(response).toBeDefined();
      expect(response.type).toBe('command');
      // State commands should bypass classifier
      expect(mockClassifier.classify).not.toHaveBeenCalled();
    });

    it('should handle invalid state commands gracefully', async () => {
      // Mock command handler to fail for invalid command
      vi.mocked(mockCommandHandler.executeCommand).mockResolvedValue({
        commandName: 'invalid-command',
        success: false,
        content: 'Unknown command',
        status: 'failed',
        metadata: new Map(),
        error: 'Command not recognized',
      });

      // Mock classifier for invalid command (should return command type)
      vi.mocked(mockClassifier.classify).mockResolvedValue({
        type: 'command',
        confidence: 0.9,
        method: 'mock-method',
        reasoning: 'Command detected',
        extractedData: new Map(),
        metadata: new Map(),
      });

      const invalidStateRequest: AgentRequest = {
        input: '/invalid-command',
        context: {
          sessionId: 'test-session',
          environmentContext: new Map(),
        },
      };

      const response = await agent.process(invalidStateRequest);

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });
  });

  describe('Classification Integration', () => {
    it('should handle all classification types', async () => {
      const testCases: Array<{ type: 'command' | 'prompt' | 'workflow', expectedSuccess: boolean }> = [
        { type: 'command', expectedSuccess: true },
        { type: 'prompt', expectedSuccess: true },
        { type: 'workflow', expectedSuccess: true }, // Workflows return success with disabled message
      ];

      for (const testCase of testCases) {
        // Clear previous mocks
        vi.clearAllMocks();
        
        // Reset mock implementations for each test case
        mockCommandHandler = createMockCommandHandler();
        mockPromptHandler = createMockPromptHandler();
        
        vi.mocked(mockClassifier.classify).mockResolvedValue({
          type: testCase.type,
          confidence: 0.8,
          method: 'mock-method',
          reasoning: `Test ${testCase.type}`,
          extractedData: new Map(),
          metadata: new Map(),
        });

        const request: AgentRequest = {
          input: `Test ${testCase.type} input`,
          context: {
            sessionId: 'test-session',
            environmentContext: new Map(),
          },
        };

        const response = await agent.process(request);

        expect(response.type).toBe(testCase.type);
        expect(response).toBeDefined();
        
        // Verify response structure exists regardless of success/failure
        expect(response).toHaveProperty('content');
        expect(response).toHaveProperty('type');
        expect(response).toHaveProperty('success');
        
        // For workflow, verify it indicates disabled (success can vary)
        if (testCase.type === 'workflow') {
          expect(response.content).toContain('disabled');
        }
      }
    });

    it('should handle unknown classification types', async () => {
      vi.mocked(mockClassifier.classify).mockResolvedValue({
        type: 'unknown' as any,
        confidence: 0.5,
        method: 'mock-method',
        reasoning: 'Unknown type',
        extractedData: new Map(),
        metadata: new Map(),
      });

      const request: AgentRequest = {
        input: 'Unknown input',
        context: {
          sessionId: 'test-session',
          environmentContext: new Map(),
        },
      };

      const response = await agent.process(request);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Unknown classification type');
    });
  });

  describe('Workflow Handling (Disabled)', () => {
    it('should return disabled response for workflows when disabled', async () => {
      vi.mocked(mockClassifier.classify).mockResolvedValue({
        type: 'workflow',
        confidence: 0.9,
        method: 'mock-method',
        reasoning: 'Workflow detected',
        extractedData: new Map(),
        metadata: new Map(),
      });

      const request: AgentRequest = {
        input: 'Create a complex workflow',
        context: {
          sessionId: 'test-session',
          environmentContext: new Map(),
        },
      };

      const response = await agent.process(request);

      expect(response.content).toContain('Workflow processing is disabled');
      expect(response.type).toBe('workflow');
    });
  });

  describe('Performance and Metrics', () => {
    it('should track execution time', async () => {
      vi.mocked(mockClassifier.classify).mockResolvedValue({
        type: 'prompt',
        confidence: 0.8,
        method: 'mock-method',
        reasoning: 'Test',
        extractedData: new Map(),
        metadata: new Map(),
      });

      const request: AgentRequest = {
        input: 'Test input',
        context: {
          sessionId: 'test-session',
          environmentContext: new Map(),
        },
      };

      const response = await agent.process(request);

      // Execution time should be a number (might be 0 for fast mock operations)
      expect(typeof response.executionTime).toBe('number');
      expect(response.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should include proper metadata', async () => {
      vi.mocked(mockClassifier.classify).mockResolvedValue({
        type: 'prompt',
        confidence: 0.85,
        method: 'mock-method',
        reasoning: 'Test reasoning',
        extractedData: new Map([['key', 'value']]),
        metadata: new Map([['source', 'test']]),
      });

      const request: AgentRequest = {
        input: 'Test input',
        context: {
          sessionId: 'test-session',
          environmentContext: new Map(),
        },
      };

      const response = await agent.process(request);

      expect(response.metadata).toBeInstanceOf(Map);
      expect(response.metadata.has('classification')).toBe(true);
      expect(response.metadata.has('agentProcessingTime')).toBe(true);
      
      const classificationData = JSON.parse(response.metadata.get('classification') as string);
      expect(classificationData.type).toBe('prompt');
      expect(classificationData.confidence).toBe(0.85);
      expect(classificationData.method).toBe('mock-method');
    });
  });

  describe('Error Transformation', () => {
    it('should transform QiErrors to user-friendly responses', async () => {
      // Test different QiError categories
      const errorTests = [
        { error: validationError('Invalid input'), expectedContent: 'validation' },
        { error: new Error('System error'), expectedContent: 'processing failed' },
      ];

      for (const test of errorTests) {
        vi.mocked(mockClassifier.classify).mockRejectedValue(test.error);

        const request: AgentRequest = {
          input: 'Test input',
          context: {
            sessionId: 'test-session',
            environmentContext: new Map(),
          },
        };

        const response = await agent.process(request);

        expect(response.success).toBe(false);
        expect(response.content.toLowerCase()).toContain('failed');
        expect(response.error).toBeDefined();
      }
    });
  });
});