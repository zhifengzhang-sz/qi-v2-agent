/**
 * Context Manager Demo
 *
 * Demonstrates context isolation, security boundaries, and lifecycle management
 */

import type { AgentSpecialization, SecurityRestrictions } from '@qi/agent/context';
import { createContextManager, createDefaultAppContext } from '@qi/agent/context';

async function runContextManagerDemo() {
  console.log('🔐 Context Manager Demo - Security Isolation and Context Management\n');

  // Create context manager with default app context
  const appContext = createDefaultAppContext();
  const contextManager = createContextManager(appContext);

  try {
    // Initialize context manager
    await contextManager.initialize();
    console.log('✅ Context Manager initialized');

    // Demo 1: Basic Application Context
    console.log('\n📋 Demo 1: Application Context Management');
    console.log('Current app context:', {
      sessionId: appContext.sessionId,
      directory: appContext.currentDirectory,
      environment: Object.fromEntries(appContext.environment),
      metadata: Object.fromEntries(appContext.metadata),
    });

    // Demo 2: Conversation Context Creation
    console.log('\n💬 Demo 2: Conversation Context Creation');

    const mainContext = contextManager.createConversationContext('main');
    console.log(`✅ Main context created: ${mainContext.id}`);
    console.log(`   Type: ${mainContext.type}`);
    console.log(`   Expires: ${mainContext.expiresAt || 'Never'}`);
    console.log(`   Allowed operations: ${mainContext.allowedOperations.join(', ')}`);

    const subAgentContext = contextManager.createConversationContext('sub-agent', mainContext.id);
    console.log(`✅ Sub-agent context created: ${subAgentContext.id}`);
    console.log(`   Parent: ${subAgentContext.parentId}`);
    console.log(`   Expires: ${subAgentContext.expiresAt}`);
    console.log(`   Allowed operations: ${subAgentContext.allowedOperations.join(', ')}`);

    // Demo 3: Context Messages
    console.log('\n📝 Demo 3: Context Message Management');

    contextManager.addMessageToContext(mainContext.id, {
      id: 'msg_1',
      role: 'user',
      content: 'Hello, I need help with file operations',
      timestamp: new Date(),
      metadata: new Map([['type', 'initial-request']]),
    });

    contextManager.addMessageToContext(mainContext.id, {
      id: 'msg_2',
      role: 'assistant',
      content:
        'I can help you with file operations. What specific task do you need assistance with?',
      timestamp: new Date(),
      metadata: new Map([['type', 'response']]),
    });

    const updatedMainContext = contextManager.getConversationContext(mainContext.id);
    console.log(
      `✅ Messages added to main context: ${updatedMainContext?.messages.length} messages`
    );
    updatedMainContext?.messages.forEach((msg, idx) => {
      console.log(`   [${idx + 1}] ${msg.role}: ${msg.content.substring(0, 50)}...`);
    });

    // Demo 4: Isolated Context Creation
    console.log('\n🔒 Demo 4: Isolated Context for Sub-Agent');

    const restrictiveRestrictions: SecurityRestrictions = {
      readOnlyMode: true,
      allowedPaths: ['/tmp', '/workspace/current-task'],
      blockedCommands: ['rm', 'sudo', 'curl', 'wget'],
      blockedTools: ['SystemTool', 'NetworkTool'],
      requireApproval: true,
      maxExecutionTime: 120000, // 2 minutes
      maxMemoryUsage: 50 * 1024 * 1024, // 50MB
      networkAccess: false,
      systemAccess: false,
    };

    const isolatedContext = contextManager.createIsolatedContext({
      parentContextId: mainContext.id,
      task: 'Analyze files in workspace for documentation',
      specialization: 'file-operations' as AgentSpecialization,
      restrictions: restrictiveRestrictions,
      timeLimit: 180000, // 3 minutes
    });

    console.log(`✅ Isolated context created: ${isolatedContext.id}`);
    console.log(`   Task: ${isolatedContext.task}`);
    console.log(`   Parent: ${isolatedContext.parentContextId}`);
    console.log(`   Time limit: ${isolatedContext.timeLimit}ms`);
    console.log(`   Memory limit: ${Math.round(isolatedContext.memoryLimit / 1024 / 1024)}MB`);
    console.log(`   Allowed operations: ${isolatedContext.allowedOperations.join(', ')}`);
    console.log(`   Allowed paths: ${isolatedContext.allowedPaths.join(', ')}`);
    console.log(`   Security boundaries: ${isolatedContext.boundaries.join(', ')}`);

    // Demo 5: Access Validation
    console.log('\n🛡️  Demo 5: Access Validation and Security Boundaries');

    const testOperations = [
      'fs:read:/tmp/test.txt',
      'fs:write:/tmp/output.txt',
      'fs:read:/etc/passwd',
      'tool:SystemTool',
      'command:ls',
      'command:rm',
      'network:fetch',
    ];

    for (const operation of testOperations) {
      const allowed = await contextManager.validateContextAccess(isolatedContext.id, operation);
      const status = allowed ? '✅ ALLOWED' : '❌ BLOCKED';
      console.log(`   ${operation}: ${status}`);
    }

    // Demo 6: Context Hierarchy
    console.log('\n🌳 Demo 6: Context Hierarchy');

    const childContexts = contextManager.getChildContexts(mainContext.id);
    console.log(`✅ Child contexts of ${mainContext.id}: ${childContexts.length}`);
    childContexts.forEach((child) => {
      console.log(`   - ${child.id} (${child.type})`);
    });

    const hierarchy = contextManager.getContextHierarchy(subAgentContext.id);
    console.log(`✅ Context hierarchy for ${subAgentContext.id}:`);
    hierarchy.forEach((contextId, level) => {
      const indent = '  '.repeat(level);
      console.log(`${indent}- ${contextId}`);
    });

    // Demo 7: Statistics and Monitoring
    console.log('\n📊 Demo 7: Context Manager Statistics');

    const stats = contextManager.getContextStatistics();
    console.log('✅ Context Manager Statistics:');
    console.log(`   Total contexts created: ${stats.totalContextsCreated}`);
    console.log(`   Active conversation contexts: ${stats.activeConversationContexts}`);
    console.log(`   Active isolated contexts: ${stats.activeIsolatedContexts}`);
    console.log(`   Expired contexts cleaned: ${stats.expiredContextsCleanedUp}`);
    console.log(`   Security violations: ${stats.securityViolations}`);
    console.log(`   Memory usage: ${Math.round(stats.memoryUsage / 1024 / 1024)}MB`);
    console.log(`   Uptime: ${Math.round(stats.uptime / 1000)}s`);

    // Demo 8: Access Audit Log
    console.log('\n📋 Demo 8: Access Audit Log');

    const auditLog = contextManager.getAccessAuditLog(isolatedContext.id);
    console.log(`✅ Audit log entries for ${isolatedContext.id}: ${auditLog.length}`);
    auditLog.slice(-5).forEach((entry) => {
      const status = entry.allowed ? 'ALLOWED' : 'BLOCKED';
      const reason = entry.reason ? ` (${entry.reason})` : '';
      console.log(`   ${entry.timestamp.toISOString()} - ${entry.operation}: ${status}${reason}`);
    });

    // Demo 9: Context Cleanup
    console.log('\n🧹 Demo 9: Context Cleanup');

    // Manually expire a context for demo
    const expiredContexts = await contextManager.cleanupExpiredContexts();
    console.log(`✅ Expired contexts cleaned up: ${expiredContexts}`);

    // Check active contexts
    const activeContexts = contextManager.getActiveContexts();
    console.log(`✅ Active contexts remaining: ${activeContexts.length}`);

    // Demo 10: Context Termination
    console.log('\n🔚 Demo 10: Context Termination');

    console.log(`Terminating isolated context: ${isolatedContext.id}`);
    contextManager.terminateContext(isolatedContext.id);

    const finalStats = contextManager.getContextStatistics();
    console.log(
      `✅ Active isolated contexts after termination: ${finalStats.activeIsolatedContexts}`
    );

    // Final verification
    const isContextActive = contextManager.isContextActive(isolatedContext.id);
    console.log(`✅ Isolated context still active: ${isContextActive}`);
  } catch (error) {
    console.error('❌ Demo failed:', error);
  } finally {
    // Cleanup
    await contextManager.shutdown();
    console.log('\n✅ Context Manager shutdown complete');
  }
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  runContextManagerDemo().catch(console.error);
}

export { runContextManagerDemo };
