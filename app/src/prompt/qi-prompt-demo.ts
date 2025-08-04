#!/usr/bin/env node

/**
 * Qi Prompt Module Demo
 *
 * Tests the prompt module using the same component orchestration as QiCodeAgent,
 * but without the broken classifier. This isolates prompt module functionality.
 *
 * Components used (same as agent):
 * - StateManager: Tracks conversation history 
 * - ContextManager: Manages conversation contexts
 * - PromptHandler: Handles LLM calls via prompt module
 * - ContextAwarePromptHandler: Adds conversation history to prompts
 */

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as readline from 'node:readline/promises';
import { createContextManager, createDefaultAppContext } from '@qi/agent/context';
import { createContextAwarePromptHandler } from '@qi/agent/context/utils/ContextAwarePrompting';
import { createStateManager } from '@qi/agent/state';
import { createPromptHandler } from '@qi/agent/prompt';
import { parseInput } from './parser.js';

/**
 * Qi Prompt Demo - Orchestrates components like QiCodeAgent
 */
class QiPromptDemo {
  private stateManager: any;
  private contextManager: any;
  private promptHandler: any;
  private contextAwarePromptHandler: any;
  private sessionContextMap = new Map<string, string>();
  private isInitialized = false;

  constructor() {
    // Create components using same pattern as QiCodeAgent
    this.stateManager = createStateManager();
    const appContext = createDefaultAppContext();
    this.contextManager = createContextManager(appContext);
    this.promptHandler = createPromptHandler();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('🚀 Initializing Qi Prompt Demo...');

    try {
      // Load LLM configuration (same as multi-llm-demo)
      console.log('📝 Loading LLM configuration...');
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const configPath = join(__dirname, '..', '..', '..', 'config', 'llm-providers.yaml');
      const schemaPath = join(__dirname, '..', '..', '..', 'config', 'llm-providers.schema.json');
      
      // Initialize prompt handler with config files (same as llm-direct method)
      const initResult = await this.promptHandler.initialize(configPath, schemaPath);
      if (!initResult.success) {
        throw new Error(`Failed to initialize prompt handler: ${initResult.error}`);
      }
      console.log('✅ Prompt handler initialized');

      // Initialize context manager (same as QiCodeAgent)
      await this.contextManager.initialize();
      console.log('✅ Context manager initialized');

      // Create context-aware prompt handler (same as QiCodeAgent)
      this.contextAwarePromptHandler = createContextAwarePromptHandler(
        this.promptHandler,
        this.contextManager
      );
      console.log('✅ Context-aware prompt handler created');

      this.isInitialized = true;
      console.log('🎉 Initialization complete!\n');
    } catch (error) {
      console.error('❌ Initialization failed:', error);
      throw error;
    }
  }

  async processInput(input: string, sessionId: string = 'demo-session'): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Demo not initialized. Call initialize() first.');
    }

    const parsed = parseInput(input);
    console.log(`📤 Processing ${parsed.type}: "${input}"`);

    if (parsed.type === 'command') {
      await this.handleCommand(parsed.content);
      return;
    }

    // Handle prompt
    try {
      // Session to context mapping (same as QiCodeAgent handlePrompt)
      let contextId = this.sessionContextMap.get(sessionId);

      if (!contextId) {
        // Create new conversation context for this session
        const newContext = this.contextManager.createConversationContext('main');
        contextId = newContext.id;
        this.sessionContextMap.set(sessionId, contextId);
        console.log(`📝 Created new context: ${contextId}`);
      }

      // Verify context still exists (same as QiCodeAgent)
      const existingContext = this.contextManager.getConversationContext(contextId);
      if (!existingContext) {
        // Context was cleaned up, create a new one
        const newContext = this.contextManager.createConversationContext('main');
        contextId = newContext.id;
        this.sessionContextMap.set(sessionId, contextId);
        console.log(`📝 Recreated context: ${contextId}`);
      }

      // Execute with context continuation (same as QiCodeAgent)
      const startTime = Date.now();
      const result = await this.contextAwarePromptHandler.completeWithContext(
        input,
        { provider: 'ollama', model: 'qwen3:8b', temperature: 0.1 }, // prompt options
        contextId,
        true // include conversation history
      );
      const latency = Date.now() - startTime;

      if (result.success) {
        console.log(`📥 Response (${latency}ms):`);
        console.log(`   ${result.data}`);
      } else {
        console.log(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      console.error(`💥 Processing failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log(''); // blank line
  }

  private async handleCommand(commandContent: string): Promise<void> {
    const command = commandContent.toLowerCase().trim();
    
    switch (command) {
      case 'help':
        console.log('📚 Available commands:');
        console.log('  /help - Show this help message');
        console.log('  /stats - Show demo statistics');
        console.log('  /exit - Exit the demo');
        console.log('  /clear - Clear conversation context');
        break;
        
      case 'stats':
        this.getStats();
        break;
        
      case 'exit':
        console.log('👋 Goodbye!');
        process.exit(0);
        break;
        
      case 'clear':
        this.sessionContextMap.clear();
        await this.contextManager.clearAllContexts?.();
        console.log('🧹 Conversation context cleared');
        break;
        
      default:
        console.log(`❓ Unknown command: /${command}`);
        console.log('💡 Type /help to see available commands');
        break;
    }
    console.log(''); // blank line
  }

  async shutdown(): Promise<void> {
    console.log('\n🛑 Shutting down...');
    await this.contextManager.shutdown();
    this.sessionContextMap.clear();
    this.isInitialized = false;
    console.log('✅ Shutdown complete');
  }

  getStats(): void {
    console.log('\n📊 Demo Statistics:');
    console.log(`   Active contexts: ${this.sessionContextMap.size}`);
    const stats = this.contextManager.getContextStatistics();
    console.log(`   Conversation contexts: ${stats.activeConversationContexts}`);
    console.log(`   Environment contexts: ${stats.activeEnvironmentContexts}`);
  }
}

/**
 * Interactive CLI for the demo
 */
async function runInteractiveCLI(): Promise<void> {
  const demo = new QiPromptDemo();
  
  try {
    await demo.initialize();

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log('💬 Interactive Qi Prompt Demo');
    console.log('Commands:');
    console.log('  - Type any message to send to the LLM');
    console.log('  - Type /help to see available commands');
    console.log('  - Type /exit or Ctrl+C to quit\n');

    let running = true;
    while (running) {
      try {
        const input = await rl.question('You: ');
        
        if (input.trim()) {
          await demo.processInput(input.trim());
        }
      } catch (error) {
        console.error('Input error:', error);
        break;
      }
    }

    rl.close();
    await demo.shutdown();
  } catch (error) {
    console.error('Demo failed:', error);
    process.exit(1);
  }
}

/**
 * Automated test sequence
 */
async function runAutomatedTest(): Promise<void> {
  const demo = new QiPromptDemo();
  
  try {
    await demo.initialize();

    console.log('🧪 Running automated test sequence...\n');

    // Test sequence - conversation with context
    const testInputs = [
      "Hello! I'm working on a TypeScript project.",
      "Can you help me understand async/await?",
      "What about error handling in async functions?",
      "Thanks for the help!"
    ];

    for (const input of testInputs) {
      await demo.processInput(input);
      // Small delay between messages
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    demo.getStats();
    await demo.shutdown();
  } catch (error) {
    console.error('Automated test failed:', error);
    process.exit(1);
  }
}

// Main entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const mode = process.argv[2] || 'interactive';
  
  if (mode === 'test') {
    runAutomatedTest().then(() => {
      console.log('\n✅ Automated test completed successfully!');
      process.exit(0);
    });
  } else {
    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
      console.log('\n👋 See you later!');
      process.exit(0);
    });

    runInteractiveCLI();
  }
}

export { QiPromptDemo };