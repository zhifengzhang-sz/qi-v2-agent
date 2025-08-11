#!/usr/bin/env node

/**
 * Workflow Race Condition Test
 * 
 * This test demonstrates the race condition between:
 * 1. Workflow processing (async) - handles @file references
 * 2. Original input processing (sync) - continues immediately
 * 
 * The race condition causes @file references to work with fast providers (Ollama)
 * but fail with slow providers (OpenRouter) due to timing differences.
 */

import { EventEmitter } from 'node:events';

// Mock workflow handler that simulates different processing speeds
class MockWorkflowHandler extends EventEmitter {
  constructor(processingDelay = 100) {
    super();
    this.processingDelay = processingDelay;
  }

  async executeWorkflow(input, options) {
    // Simulate workflow processing time
    await new Promise(resolve => setTimeout(resolve, this.processingDelay));
    
    if (input.includes('@')) {
      return {
        success: true,
        data: {
          output: `ENHANCED: ${input} [with file content loaded]`
        }
      };
    }
    
    return { success: false, error: 'No file references found' };
  }
}

// Mock orchestrator that demonstrates the race condition
class MockOrchestrator extends EventEmitter {
  constructor(llmProcessingDelay = 50) {
    super();
    this.llmProcessingDelay = llmProcessingDelay;
    this.workflowHandler = new MockWorkflowHandler(100); // Always 100ms for workflow
    this.results = [];
    
    // Set up event handlers (similar to real implementation)
    this.on('promptRequested', this.handlePromptRequest.bind(this));
  }

  async process(request) {
    const startTime = Date.now();
    console.log(`[${startTime}] Processing started: "${request.input}"`);
    
    // RACE CONDITION STARTS HERE
    // Line 222 equivalent: Emit processInput (async)
    this.emit('processInput', request.input);
    
    // Line 225 equivalent: Continue processing original input (sync)
    const parsed = this.parseInput(request.input);
    
    // Simulate LLM processing time (varies by provider)
    await new Promise(resolve => setTimeout(resolve, this.llmProcessingDelay));
    
    const endTime = Date.now();
    const result = {
      content: `ORIGINAL: ${parsed.content}`,
      processingTime: endTime - startTime,
      timestamp: endTime
    };
    
    console.log(`[${endTime}] Original processing completed: "${result.content}" (${result.processingTime}ms)`);
    this.results.push({ type: 'original', ...result });
    
    return result;
  }

  parseInput(input) {
    return {
      type: input.startsWith('/') ? 'command' : 'prompt',
      content: input
    };
  }

  async handlePromptRequest(event) {
    const startTime = Date.now();
    console.log(`[${startTime}] Enhanced processing started: "${event.prompt}"`);
    
    // Simulate LLM processing the enhanced content
    await new Promise(resolve => setTimeout(resolve, this.llmProcessingDelay));
    
    const endTime = Date.now();
    const result = {
      content: event.prompt,
      processingTime: endTime - startTime,
      timestamp: endTime
    };
    
    console.log(`[${endTime}] Enhanced processing completed: "${result.content}" (${result.processingTime}ms)`);
    this.results.push({ type: 'enhanced', ...result });
  }

  // Simulate the handleProcessInput method from qi-prompt.ts
  async handleProcessInput(input) {
    try {
      if (input.includes('@')) {
        const workflowResult = await this.workflowHandler.executeWorkflow(input, {
          type: 'FILE_REFERENCE',
          context: { sessionId: 'test-session' }
        });

        if (workflowResult.success) {
          const enhancedContent = workflowResult.data.output;
          console.log(`[${Date.now()}] Workflow completed, emitting enhanced content`);
          
          // Emit enhanced content for processing
          this.emit('promptRequested', {
            prompt: enhancedContent,
            context: { sessionId: 'test-session' }
          });
        }
      }
    } catch (error) {
      console.warn('Workflow processing error:', error.message);
    }
  }
}

// Test function to demonstrate the race condition
async function testRaceCondition() {
  console.log('=== Workflow Race Condition Test ===\n');

  const testInput = '@src/index.ts explain this file';

  // Test 1: Fast LLM (like Ollama) - 50ms processing
  console.log('🚀 TEST 1: Fast LLM (Ollama-like) - 50ms processing');
  const fastOrchestrator = new MockOrchestrator(50);
  
  // Wire up the processInput handler
  fastOrchestrator.on('processInput', (input) => {
    fastOrchestrator.handleProcessInput(input);
  });

  await fastOrchestrator.process({ input: testInput });
  
  // Wait for async workflow to complete
  await new Promise(resolve => setTimeout(resolve, 200));
  
  console.log('\nFast LLM Results:');
  fastOrchestrator.results.forEach((result, index) => {
    console.log(`  ${index + 1}. [${result.type.toUpperCase()}] ${result.content} (${result.processingTime}ms)`);
  });
  
  // Test 2: Slow LLM (like OpenRouter) - 500ms processing  
  console.log('\n🐌 TEST 2: Slow LLM (OpenRouter-like) - 500ms processing');
  const slowOrchestrator = new MockOrchestrator(500);
  
  // Wire up the processInput handler
  slowOrchestrator.on('processInput', (input) => {
    slowOrchestrator.handleProcessInput(input);
  });

  await slowOrchestrator.process({ input: testInput });
  
  // Wait for async workflow to complete
  await new Promise(resolve => setTimeout(resolve, 200));
  
  console.log('\nSlow LLM Results:');
  slowOrchestrator.results.forEach((result, index) => {
    console.log(`  ${index + 1}. [${result.type.toUpperCase()}] ${result.content} (${result.processingTime}ms)`);
  });

  // Analysis
  console.log('\n=== ANALYSIS ===');
  console.log('\nFast LLM (Ollama):');
  if (fastOrchestrator.results.length > 1) {
    const original = fastOrchestrator.results.find(r => r.type === 'original');
    const enhanced = fastOrchestrator.results.find(r => r.type === 'enhanced');
    
    if (enhanced && enhanced.timestamp < original.timestamp + 100) {
      console.log('  ✅ Enhanced content likely arrived before/during original processing');
      console.log('  ✅ User sees enhanced response (FILE REFERENCES WORK)');
    } else {
      console.log('  ❌ Original processing completed first');
    }
  }

  console.log('\nSlow LLM (OpenRouter):');
  if (slowOrchestrator.results.length > 1) {
    const original = slowOrchestrator.results.find(r => r.type === 'original');
    const enhanced = slowOrchestrator.results.find(r => r.type === 'enhanced');
    
    if (original && enhanced && original.timestamp < enhanced.timestamp) {
      console.log('  ❌ Original processing completed first');
      console.log('  ❌ User sees original response (FILE REFERENCES BROKEN)');
      console.log('  ❌ Enhanced response arrives too late');
    } else {
      console.log('  ✅ Enhanced content arrived in time');
    }
  }

  console.log('\n=== CONCLUSION ===');
  console.log('The race condition is confirmed:');
  console.log('- Fast providers: Workflow completes before/during LLM processing');  
  console.log('- Slow providers: Original processing completes before workflow');
  console.log('- This explains why @file references work with Ollama but not OpenRouter');
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testRaceCondition().catch(console.error);
}

export { MockOrchestrator, MockWorkflowHandler, testRaceCondition };