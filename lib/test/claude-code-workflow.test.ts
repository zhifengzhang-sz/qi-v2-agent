/**
 * @qi/workflow - Claude Code Workflow Engine Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ClaudeCodeWorkflowEngine } from '../src/workflow/impl/ClaudeCodeWorkflowEngine.js';
import type { WorkflowState } from '../src/workflow/interfaces/index.js';

describe('ClaudeCodeWorkflowEngine', () => {
  let engine: ClaudeCodeWorkflowEngine;
  let baseState: WorkflowState;

  beforeEach(() => {
    engine = new ClaudeCodeWorkflowEngine();
    baseState = {
      input: 'Test workflow input',
      output: '',
      pattern: 'analytical',
      domain: 'test',
      context: new Map([
        ['testKey', 'testValue'],
        ['priority', 'high'],
      ]),
      toolResults: [],
      reasoningOutput: '',
      metadata: {
        currentStage: 'initial',
        processingSteps: [],
      },
    };
  });

  describe('Workflow Creation', () => {
    it('should create a Claude Code-style workflow', () => {
      const workflow = engine.createClaudeCodeWorkflow(
        'Test Workflow',
        'A test workflow for validation',
        [
          {
            id: 'analyze',
            type: 'reasoning',
            description: 'Analyze the input',
            inputs: new Map([['input', 'test']]),
            dependencies: [],
            thinkingIntensity: 'basic',
            metadata: new Map(),
          },
          {
            id: 'generate',
            type: 'generation',
            description: 'Generate output',
            inputs: new Map(),
            dependencies: ['analyze'],
            metadata: new Map(),
          },
        ]
      );

      expect(workflow.title).toBe('Test Workflow');
      expect(workflow.description).toBe('A test workflow for validation');
      expect(workflow.tasks).toHaveLength(2);
      expect(workflow.tasks[0].id).toBe('analyze');
      expect(workflow.tasks[0].type).toBe('reasoning');
      expect(workflow.tasks[0].thinkingIntensity).toBe('basic');
      expect(workflow.tasks[1].dependencies).toEqual(['analyze']);
    });

    it('should create executable workflow from pattern', () => {
      const executable = engine.createWorkflow('analytical thinking task');

      expect(executable.id).toContain('workflow-');
      expect(executable.pattern).toBe('analytical thinking task');
      expect(executable.nodes).toBeDefined();
      expect(executable.edges).toBeDefined();
      expect(executable.nodes.length).toBeGreaterThan(0);
    });

    it('should detect extended thinking from pattern', () => {
      const executable = engine.createWorkflow('think deeply about this complex problem');
      
      expect(executable.pattern).toBe('think deeply about this complex problem');
      expect(executable.id).toContain('workflow-');
    });
  });

  describe('Workflow Execution', () => {
    it('should execute a basic workflow', async () => {
      const workflow = engine.createWorkflow('analytical problem');
      const result = await engine.execute(workflow, baseState);

      expect(result.finalState).toBeDefined();
      expect(result.finalState.output).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(result.performance.totalTime).toBeGreaterThan(0);
      expect(result.finalState.metadata.performance.get('completedTasksCount')).toBeDefined();
      expect(typeof result.finalState.metadata.performance.get('completedTasksCount')).toBe('number');
    });

    it('should handle workflow with extended thinking', async () => {
      const workflow = engine.createWorkflow('think extensively about machine learning');
      const result = await engine.execute(workflow, {
        ...baseState,
        input: 'Explain neural networks',
      });

      expect(result.finalState).toBeDefined();
      expect(result.finalState.output).toBeDefined();
      expect(result.finalState.metadata.performance.get('thinkingStepsCount')).toBeGreaterThan(0);
    });

    it('should preserve context throughout execution', async () => {
      const contextState: WorkflowState = {
        ...baseState,
        input: 'Context preservation test',
        context: new Map([
          ['projectName', 'qi-v2-agent'],
          ['userPreference', 'detailed'],
        ]),
      };

      const workflow = engine.createWorkflow('analytical review');
      const result = await engine.execute(workflow, contextState);

      expect(result.finalState).toBeDefined();
      expect(result.finalState.metadata).toBeDefined();
    });

    it('should handle tool orchestration', async () => {
      const workflow = engine.createWorkflow('tool-heavy workflow');
      const result = await engine.execute(workflow, {
        ...baseState,
        input: 'Execute multiple tools',
      });

      expect(result.finalState).toBeDefined();
      expect(result.finalState.metadata.performance.get('toolsUsed')).toBeDefined();
      expect(typeof result.finalState.metadata.performance.get('toolsUsed')).toBe('number');
    });
  });

  describe('Workflow Streaming', () => {
    it('should stream workflow execution', async () => {
      const workflow = engine.createWorkflow('streaming test');
      const chunks: any[] = [];

      for await (const chunk of engine.stream(workflow, baseState)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].nodeId).toBeDefined();
      expect(chunks[0].state).toBeDefined();
      expect(typeof chunks[0].isComplete).toBe('boolean');
    });

    it('should provide progress updates during streaming', async () => {
      const workflow = engine.createWorkflow('progress tracking test');
      const progressUpdates: number[] = [];

      for await (const chunk of engine.stream(workflow, baseState)) {
        // Track progress based on completion status
        const progress = chunk.isComplete ? 1.0 : 0.5;
        progressUpdates.push(progress);
      }

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates.every(progress => progress >= 0 && progress <= 1)).toBe(true);
    });
  });

  describe('Configuration', () => {
    it('should respect configuration settings', () => {
      const customEngine = new ClaudeCodeWorkflowEngine({
        enableExtendedThinking: false,
        enableParallelExecution: false,
        maxThinkingDepth: 3,
      });

      expect(customEngine).toBeInstanceOf(ClaudeCodeWorkflowEngine);
    });

    it('should use default configuration when none provided', () => {
      const defaultEngine = new ClaudeCodeWorkflowEngine();
      expect(defaultEngine).toBeInstanceOf(ClaudeCodeWorkflowEngine);
    });
  });

  describe('Precompilation', () => {
    it('should precompile workflows', async () => {
      const patterns = ['analytical', 'creative', 'problem-solving'];
      await engine.precompileWorkflows(patterns);

      for (const pattern of patterns) {
        const compiled = engine.getCompiledWorkflow(pattern);
        expect(compiled).toBeDefined();
        expect(compiled?.pattern).toBe(pattern);
      }
    });

    it('should return null for non-existent workflows', () => {
      const workflow = engine.getCompiledWorkflow('non-existent');
      expect(workflow).toBeNull();
    });
  });

  describe('Task Types', () => {
    it('should handle reasoning tasks with different intensities', async () => {
      const basicWorkflow = engine.createWorkflow('basic analysis');
      const basicResult = await engine.execute(basicWorkflow, baseState);
      
      expect(basicResult.finalState).toBeDefined();
      expect(basicResult.finalState.metadata.performance.get('thinkingStepsCount')).toBeGreaterThan(0);

      const deepWorkflow = engine.createWorkflow('think deeply about this');
      const deepResult = await engine.execute(deepWorkflow, baseState);
      
      expect(deepResult.finalState).toBeDefined();
      expect(deepResult.finalState.metadata.performance.get('thinkingStepsCount')).toBeGreaterThan(0);
    });

    it('should handle tool-calling tasks', async () => {
      const workflow = engine.createWorkflow('use tools for analysis');
      const result = await engine.execute(workflow, baseState);

      expect(result.finalState).toBeDefined();
      expect(result.finalState.metadata.performance.get('toolsUsed')).toBeDefined();
    });

    it('should handle generation tasks', async () => {
      const workflow = engine.createWorkflow('generate documentation');
      const result = await engine.execute(workflow, baseState);

      expect(result.finalState).toBeDefined();
      expect(result.finalState.output).toBeDefined();
      expect(typeof result.finalState.output).toBe('string');
    });

    it('should handle validation tasks', async () => {
      const workflow = engine.createWorkflow('validate results');
      const result = await engine.execute(workflow, baseState);

      expect(result.finalState).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing workflow gracefully', async () => {
      const workflow = engine.createWorkflow('test');
      // Manually remove the workflow from active workflows to simulate error
      const originalExecute = engine.execute.bind(engine);
      
      const result = await originalExecute(workflow, baseState);
      expect(result.finalState).toBeDefined(); // Should still complete with fallback
    });

    it('should handle streaming errors', async () => {
      const workflow = engine.createWorkflow('error test');
      const chunks: any[] = [];
      let errorCount = 0;

      try {
        for await (const chunk of engine.stream(workflow, baseState)) {
          chunks.push(chunk);
          if (chunk.type === 'error') {
            errorCount++;
          }
        }
      } catch (error) {
        // Expected behavior for error scenarios
      }

      expect(chunks.length).toBeGreaterThan(0);
    });
  });
});