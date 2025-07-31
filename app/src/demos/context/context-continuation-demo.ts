/**
 * Context Continuation Demo
 * 
 * Demonstrates context continuation in prompt processing without workflows
 */

import { createContextManager, createDefaultAppContext } from '../../context/index.js';
import { createContextAwarePromptHandler } from '../../context/utils/ContextAwarePrompting.js';

// Mock prompt handler for demo
class MockPromptHandler {
  async complete(prompt: string, options: any = {}): Promise<{ success: boolean; data?: string; error?: string }> {
    // Simulate LLM processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Simple response generation for demo
    if (prompt.toLowerCase().includes('error')) {
      return { success: false, error: 'Simulated error' };
    }
    
    return {
      success: true,
      data: `Response to: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`
    };
  }

  async getAvailableProviders(): Promise<any[]> {
    return [{ id: 'mock', name: 'Mock Provider', available: true, models: 1 }];
  }

  async validateProvider(): Promise<boolean> {
    return true;
  }
}

async function runContextContinuationDemo() {
  console.log('💬 Context Continuation Demo - Prompt Processing with Context Awareness\n');
  
  // Setup
  const appContext = createDefaultAppContext();
  const contextManager = createContextManager(appContext);
  const mockPromptHandler = new MockPromptHandler();
  const contextAwareHandler = createContextAwarePromptHandler(mockPromptHandler as any, contextManager);
  
  try {
    await contextManager.initialize();
    console.log('✅ Context Manager initialized');
    
    // Demo 1: Basic Context Creation and Continuation
    console.log('\n📝 Demo 1: Basic Context Continuation');
    
    const mainContext = contextManager.createConversationContext('main');
    console.log(`✅ Main conversation context created: ${mainContext.id}`);
    
    // First interaction
    console.log('\n--- First Interaction ---');
    const response1 = await contextAwareHandler.completeWithContext(
      "Hello, I'm working on a JavaScript project and need help with async functions",
      {},
      mainContext.id
    );
    console.log(`User: Hello, I'm working on a JavaScript project and need help with async functions`);
    console.log(`Assistant: ${response1.success ? response1.data : 'Error: ' + response1.error}`);
    
    // Second interaction - continues the context
    console.log('\n--- Second Interaction (with context) ---');
    const response2 = await contextAwareHandler.completeWithContext(
      "Can you show me an example of error handling in async functions?",
      {},
      mainContext.id
    );
    console.log(`User: Can you show me an example of error handling in async functions?`);
    console.log(`Assistant: ${response2.success ? response2.data : 'Error: ' + response2.error}`);
    
    // Third interaction - continues further
    console.log('\n--- Third Interaction (building on previous context) ---');
    const response3 = await contextAwareHandler.completeWithContext(
      "What about using try-catch with multiple await calls?",
      {},
      mainContext.id
    );
    console.log(`User: What about using try-catch with multiple await calls?`);
    console.log(`Assistant: ${response3.success ? response3.data : 'Error: ' + response3.error}`);
    
    // Check conversation history
    const updatedContext = contextManager.getConversationContext(mainContext.id);
    console.log(`\n✅ Conversation history: ${updatedContext?.messages.length} messages`);
    
    // Demo 2: Sub-Conversation Creation
    console.log('\n🌿 Demo 2: Sub-Conversation Context');
    
    const subContextId = await contextAwareHandler.createSubConversation(
      mainContext.id,
      "Detailed discussion about Promise patterns",
      180000 // 3 minutes
    );
    console.log(`✅ Sub-conversation created: ${subContextId}`);
    
    // Interaction in sub-context
    console.log('\n--- Sub-Conversation Interaction ---');
    const subResponse = await contextAwareHandler.completeWithContext(
      "Let's dive deeper into Promise.all vs Promise.allSettled",
      {},
      subContextId
    );
    console.log(`User: Let's dive deeper into Promise.all vs Promise.allSettled`);
    console.log(`Assistant: ${subResponse.success ? subResponse.data : 'Error: ' + subResponse.error}`);
    
    // Demo 3: Context History and Summary
    console.log('\n📚 Demo 3: Context History and Summary');
    
    const summary = await contextAwareHandler.getConversationSummary(mainContext.id);
    console.log('✅ Main Context Summary:');
    console.log(summary);
    
    const subSummary = await contextAwareHandler.getConversationSummary(subContextId);
    console.log('\n✅ Sub-Context Summary:');
    console.log(subSummary);
    
    // Demo 4: Context Transfer
    console.log('\n🔄 Demo 4: Context Transfer');
    
    const newContext = contextManager.createConversationContext('main');
    const transferSuccess = await contextAwareHandler.transferContext(
      subContextId,
      newContext.id,
      true // Include messages
    );
    console.log(`✅ Context transfer ${transferSuccess ? 'successful' : 'failed'}: ${subContextId} → ${newContext.id}`);
    
    if (transferSuccess) {
      const transferredContext = contextManager.getConversationContext(newContext.id);
      console.log(`✅ Transferred context now has ${transferredContext?.messages.length} messages`);
    }
    
    // Demo 5: Continue Conversation After Transfer
    console.log('\n➡️  Demo 5: Continue After Transfer');
    
    const continuedResponse = await contextAwareHandler.continueConversation(
      newContext.id,
      "Based on our previous discussion, what's the best practice for error handling?"
    );
    console.log(`User: Based on our previous discussion, what's the best practice for error handling?`);
    console.log(`Assistant: ${continuedResponse.success ? continuedResponse.data : 'Error: ' + continuedResponse.error}`);
    
    // Demo 6: Context Hierarchy
    console.log('\n🌳 Demo 6: Context Hierarchy Analysis');
    
    const childContexts = contextManager.getChildContexts(mainContext.id);
    console.log(`✅ Main context has ${childContexts.length} child contexts:`);
    childContexts.forEach(child => {
      console.log(`   - ${child.id} (${child.type}) - ${child.messages.length} messages`);
    });
    
    const hierarchy = contextManager.getContextHierarchy(subContextId);
    console.log(`\n✅ Sub-context hierarchy:`);
    hierarchy.forEach((contextId, level) => {
      const indent = '  '.repeat(level);
      const context = contextManager.getConversationContext(contextId);
      console.log(`${indent}- ${contextId} (${context?.messages.length || 0} messages)`);
    });
    
    // Demo 7: Context-Aware Prompting Without History
    console.log('\n🚫 Demo 7: Context-Aware Prompting Without History');
    
    const noHistoryResponse = await contextAwareHandler.completeWithContext(
      "Tell me about JavaScript modules",
      {},
      mainContext.id,
      false // Don't include history
    );
    console.log(`User: Tell me about JavaScript modules (without history)`);
    console.log(`Assistant: ${noHistoryResponse.success ? noHistoryResponse.data : 'Error: ' + noHistoryResponse.error}`);
    
    // Demo 8: Error Handling in Context
    console.log('\n❌ Demo 8: Error Handling in Context Continuation');
    
    const errorResponse = await contextAwareHandler.completeWithContext(
      "This prompt will trigger an error for demo purposes",
      {},
      mainContext.id
    );
    console.log(`User: This prompt will trigger an error for demo purposes`);
    console.log(`Assistant: ${errorResponse.success ? errorResponse.data : 'Error: ' + errorResponse.error}`);
    
    // Final Statistics
    console.log('\n📊 Demo 8: Final Context Statistics');
    
    const stats = contextManager.getContextStatistics();
    console.log('✅ Context Manager Statistics:');
    console.log(`   Total contexts created: ${stats.totalContextsCreated}`);
    console.log(`   Active conversation contexts: ${stats.activeConversationContexts}`);
    console.log(`   Active isolated contexts: ${stats.activeIsolatedContexts}`);
    console.log(`   Memory usage: ${Math.round(stats.memoryUsage / 1024 / 1024)}MB`);
    
    // Show all active contexts and their message counts
    const activeContexts = contextManager.getActiveContexts();
    console.log(`\n✅ Active contexts (${activeContexts.length}):`);
    activeContexts.forEach(context => {
      console.log(`   - ${context.id}: ${context.messages.length} messages (${context.type})`);
    });
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
  } finally {
    await contextManager.shutdown();
    console.log('\n✅ Context Manager shutdown complete');
  }
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  runContextContinuationDemo().catch(console.error);
}

export { runContextContinuationDemo };