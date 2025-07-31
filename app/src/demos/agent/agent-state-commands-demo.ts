#!/usr/bin/env node

/**
 * Agent State Commands Demo
 * 
 * Tests the Agent handling state commands (/model, /status, /config, /mode, /session)
 * through its StateManager integration.
 */

import { createAgent, type AgentRequest, type AgentContext } from '../../agent/index.js';
import { createStateManager } from '../../state/index.js';

async function demonstrateAgentStateCommands(): Promise<void> {
  console.log('🤖 Agent State Commands Demo');
  console.log('============================\n');

  // Create state manager and agent
  const stateManager = createStateManager();
  const agent = createAgent(stateManager, {
    domain: 'demo',
    enableCommands: true,
    enablePrompts: true,
    enableWorkflows: true
  });

  await agent.initialize();

  // Test helper function
  async function testCommand(input: string): Promise<void> {
    console.log(`📤 Input: "${input}"`);
    
    const request: AgentRequest = {
      input,
      context: {
        sessionId: 'demo-session',
        timestamp: new Date(),
        source: 'demo'
      }
    };

    try {
      const response = await agent.process(request);
      console.log(`📥 Response (${response.success ? 'SUCCESS' : 'FAILED'}):`);
      console.log(`   ${response.content}`);
      if (response.error) {
        console.log(`   Error: ${response.error}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    console.log('');
  }

  // Test /model command (no args - show current and available)
  console.log('🧠 Testing /model command:');
  await testCommand('/model');

  // Test /model command (with args - change model)
  await testCommand('/model groq');
  await testCommand('/model');

  // Test invalid model
  await testCommand('/model invalid-model');

  // Test /status command
  console.log('📊 Testing /status command:');
  await testCommand('/status');

  // Test /config command
  console.log('⚙️ Testing /config command:');
  await testCommand('/config');

  // Test /mode command (no args - show current)
  console.log('⚡ Testing /mode command:');
  await testCommand('/mode');

  // Test /mode command (with args - change mode)
  await testCommand('/mode planning');
  await testCommand('/mode executing');
  await testCommand('/mode invalid-mode');

  // Test /session command
  console.log('💾 Testing /session command:');
  await testCommand('/session');

  // Add some conversation history and test session again
  stateManager.addConversationEntry({
    type: 'user_input',
    content: 'Hello, this is a test message',
    metadata: new Map([['demo', true]])
  });
  
  stateManager.addConversationEntry({
    type: 'agent_response',
    content: 'This is a response from the agent',
    metadata: new Map([['model', 'groq']])
  });

  console.log('📝 After adding conversation history:');
  await testCommand('/session');

  // Test unknown state command
  console.log('❓ Testing unknown state command:');
  await testCommand('/unknown-state-command');

  // Test non-state command (should go to classification)
  console.log('🔍 Testing non-state command (should trigger classification error):');
  await testCommand('hello world');

  // Test agent status
  console.log('📈 Agent Status:');
  const status = agent.getStatus();
  console.log(`   Initialized: ${status.isInitialized}`);
  console.log(`   Domain: ${status.domain}`);
  console.log(`   Requests Processed: ${status.requestsProcessed}`);
  console.log(`   Average Response Time: ${Math.round(status.averageResponseTime)}ms`);
  console.log(`   Uptime: ${Math.round(status.uptime / 1000)}s`);
  console.log('');

  console.log('✅ Agent state commands demo completed successfully!');
  
  await agent.shutdown();
}

if (import.meta.main) {
  demonstrateAgentStateCommands().catch(console.error);
}