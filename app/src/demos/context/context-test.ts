/**
 * Context Continuation Test - Real Usage Test
 *
 * Tests if context continuation actually works in practice
 */

import { createAgent } from '@qi/agent';
import { createClassifier } from '@qi/agent/classifier';
import {
  createContextAwarePromptHandler,
  createContextManager,
  createDefaultAppContext,
} from '@qi/agent/context';
import { createStateManager } from '@qi/agent/state';

// Simple mock prompt handler that shows context awareness
class TestPromptHandler {
  async complete(prompt: string): Promise<{ success: boolean; data?: string; error?: string }> {
    // Check if prompt contains previous conversation context
    const hasContext = prompt.includes('Previous conversation:');
    const contextInfo = hasContext ? ' [WITH CONTEXT]' : ' [NO CONTEXT]';

    return {
      success: true,
      data: `Mock response to: "${prompt.substring(0, 50)}..."${contextInfo}`,
    };
  }

  async getAvailableProviders() {
    return [];
  }
  async validateProvider() {
    return true;
  }
}

async function testContextContinuation() {
  console.log('🧪 Testing Context Continuation in Practice\n');

  // Setup real components
  const appContext = createDefaultAppContext();
  const contextManager = createContextManager(appContext);
  const stateManager = createStateManager();
  const promptHandler = new TestPromptHandler();
  const classifier = createClassifier();

  // Create agent with context manager
  const agent = createAgent(stateManager, contextManager, {
    domain: 'test',
    enableCommands: true,
    enablePrompts: true,
    enableWorkflows: false,
    classifier: classifier,
    promptHandler: promptHandler as any,
  });

  try {
    await agent.initialize();
    console.log('✅ Agent initialized with context manager');

    // Test 1: First interaction
    console.log('\n📝 Test 1: First Interaction');
    const response1 = await agent.process({
      input: "Hello, I'm learning TypeScript",
      context: {
        sessionId: 'test-session-123',
        timestamp: new Date(),
        source: 'test',
      },
    });

    console.log(`User: Hello, I'm learning TypeScript`);
    console.log(`Agent: ${response1.content}`);
    console.log(`Success: ${response1.success}`);
    console.log(`Context Aware: ${response1.metadata.get('contextAware')}`);

    // Test 2: Second interaction - should have context
    console.log('\n📝 Test 2: Second Interaction (Should Include Context)');
    const response2 = await agent.process({
      input: 'Can you explain interfaces?',
      context: {
        sessionId: 'test-session-123', // Same session
        timestamp: new Date(),
        source: 'test',
      },
    });

    console.log(`User: Can you explain interfaces?`);
    console.log(`Agent: ${response2.content}`);
    console.log(`Success: ${response2.success}`);
    console.log(`Context Aware: ${response2.metadata.get('contextAware')}`);

    // Test 3: Third interaction - context should build
    console.log('\n📝 Test 3: Third Interaction (Building Context)');
    const response3 = await agent.process({
      input: 'What about generic interfaces?',
      context: {
        sessionId: 'test-session-123', // Same session
        timestamp: new Date(),
        source: 'test',
      },
    });

    console.log(`User: What about generic interfaces?`);
    console.log(`Agent: ${response3.content}`);
    console.log(`Success: ${response3.success}`);
    console.log(`Context Aware: ${response3.metadata.get('contextAware')}`);

    // Test 4: New session - should not have previous context
    console.log('\n📝 Test 4: New Session (Should Not Have Previous Context)');
    const response4 = await agent.process({
      input: 'Hello, what are TypeScript types?',
      context: {
        sessionId: 'test-session-456', // Different session
        timestamp: new Date(),
        source: 'test',
      },
    });

    console.log(`User: Hello, what are TypeScript types?`);
    console.log(`Agent: ${response4.content}`);
    console.log(`Success: ${response4.success}`);
    console.log(`Context Aware: ${response4.metadata.get('contextAware')}`);

    // Test 5: Check context manager state
    console.log('\n📊 Test 5: Context Manager State');
    const stats = contextManager.getContextStatistics();
    console.log(`Active conversation contexts: ${stats.activeConversationContexts}`);
    console.log(`Total contexts created: ${stats.totalContextsCreated}`);

    const activeContexts = contextManager.getActiveContexts();
    console.log('\nActive contexts:');
    activeContexts.forEach((ctx) => {
      console.log(`  - ${ctx.id}: ${ctx.messages.length} messages (type: ${ctx.type})`);
      ctx.messages.forEach((msg, idx) => {
        console.log(`    [${idx + 1}] ${msg.role}: ${msg.content.substring(0, 40)}...`);
      });
    });

    // Test 6: Manual context test
    console.log('\n🔍 Test 6: Direct Context Manager Test');
    const testHandler = createContextAwarePromptHandler(promptHandler as any, contextManager);

    const manualContext = contextManager.createConversationContext('main');
    console.log(`Created manual context: ${manualContext.id}`);

    const manualResponse1 = await testHandler.completeWithContext(
      'First message in manual context',
      {},
      manualContext.id
    );
    console.log(
      `Manual 1: ${manualResponse1.success ? manualResponse1.data : manualResponse1.error}`
    );

    const manualResponse2 = await testHandler.completeWithContext(
      'Second message should have context',
      {},
      manualContext.id
    );
    console.log(
      `Manual 2: ${manualResponse2.success ? manualResponse2.data : manualResponse2.error}`
    );

    const manualContextData = contextManager.getConversationContext(manualContext.id);
    console.log(`Manual context has ${manualContextData?.messages.length} messages`);

    console.log('\n✅ Context continuation test completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  } finally {
    await agent.shutdown();
  }

  return true;
}

// Run test
if (import.meta.url === `file://${process.argv[1]}`) {
  testContextContinuation().then((success) => {
    console.log(`\n${success ? '✅ ALL TESTS PASSED' : '❌ TESTS FAILED'}`);
    process.exit(success ? 0 : 1);
  });
}

export { testContextContinuation };
