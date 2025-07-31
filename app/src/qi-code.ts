#!/usr/bin/env node

/**
 * qi-code - AI Coding Assistant
 * 
 * Main entry point that demonstrates our superior architecture:
 * Agent holds StateManager object and uses it via contracts
 * Agent uses classifiers to determine job type and dispatch to handlers
 * 
 * This is better than Claude Code's approach because:
 * 1. Clear separation of concerns
 * 2. Practical two-layer classification (command/prompt/workflow)
 * 3. Centralized state management
 * 4. More modular and testable
 */

import { PureCLI, type CLIInput, type CLIFeedback } from './cli/impl/pure-cli.js';
import { createStateManager } from './state/index.js';
import { InputClassifier } from './classifier/impl/input-classifier.js';
import { createAgent } from './agent/index.js';
import type { IStateManager } from './state/index.js';
import type { IAgent } from './agent/index.js';
import type { IClassifier } from './classifier/index.js';

/**
 * qi-code Application
 * 
 * Demonstrates our superior architecture with clean separation of concerns
 */
class QiCodeApp {
  private stateManager: IStateManager;
  private classifier: IClassifier;
  private agent: IAgent;
  private cli: PureCLI;
  private isRunning = false;

  constructor() {
    console.log('🚀 Initializing qi-code with superior architecture...\n');

    // 1. Create StateManager (centralized configuration and state)
    console.log('📋 Creating StateManager...');
    this.stateManager = createStateManager();

    // 2. Create InputClassifier (practical three-type classification)
    console.log('🔍 Creating InputClassifier with three-type classification...');
    this.classifier = new InputClassifier({
      defaultMethod: 'rule-based',
      confidenceThreshold: 0.8,
      commandPrefix: '/',
      // Commands: /help, /config, /model, etc.
      // Prompts: "hi", "write a quicksort in haskell"
      // Workflows: "fix bug in src/file.ts and run tests"
    });

    // 3. Create Agent with StateManager integration
    console.log('🤖 Creating QiCodeAgent with StateManager integration...');
    this.agent = createAgent(this.stateManager, {
      name: 'qi-code',
      version: '0.2.7',
      model: 'local',
      enableStreaming: true,
      maxTokens: 4000,
      timeout: 30000
    }, {
      classifier: this.classifier
      // commandHandler, promptHandler, workflowEngine would be added here
    });

    // 4. Create PureCLI (clean interface separation)
    console.log('💻 Creating PureCLI interface...');
    this.cli = new PureCLI({
      prompt: 'qi-code> ',
      welcomeMessage: this.getWelcomeMessage(),
      commands: [
        { name: 'help', description: 'Show help information' },
        { name: 'exit', description: 'Exit qi-code' },
        { name: 'clear', description: 'Clear screen' },
        { name: 'version', description: 'Show version' }
      ]
    });

    console.log('✅ qi-code initialized successfully!\n');
  }

  /**
   * Start the qi-code application
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️  qi-code is already running');
      return;
    }

    this.isRunning = true;
    console.log('🎯 Starting qi-code application...\n');

    try {
      // Initialize components
      await this.agent.initialize();

      // Start CLI with callback integration
      await this.cli.start(
        // Handle user input from CLI
        async (input: CLIInput): Promise<void> => {
          await this.handleCLIInput(input);
        },
        // Send feedback to CLI
        (feedback: CLIFeedback): void => {
          // CLI handles feedback internally - this is for logging/monitoring
          if (feedback.type === 'display_error') {
            console.error('CLI Error:', feedback.error);
          }
        }
      );

    } catch (error) {
      console.error('❌ Failed to start qi-code:', error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Handle input from CLI
   * 
   * This demonstrates the corrected architecture:
   * Agent holds StateManager object and uses it via contracts
   * Agent uses classifiers to find out job type and dispatch to handlers
   */
  private async handleCLIInput(input: CLIInput): Promise<void> {
    try {
      switch (input.type) {
        case 'cli_handled':
          // CLI handled it internally (help, exit, clear, version)
          // No action needed - CLI already processed it
          break;

        case 'user_input':
          // This demonstrates the corrected architecture:
          // Agent holds StateManager object and uses it via contracts
          // Agent uses classifiers to find out job type and dispatch to handlers
          await this.processUserInput(input.input);
          break;

        case 'exit':
          console.log('\n👋 Goodbye! Thanks for using qi-code');
          this.isRunning = false;
          process.exit(0);
          break;

        default:
          console.log('❓ Unknown input type:', (input as any).type);
      }
    } catch (error) {
      console.error('❌ Error processing input:', error);
      this.cli.sendFeedback({
        type: 'display_error',
        error: `Processing error: ${error.message}`
      });
    }
  }

  /**
   * Process user input through our superior architecture
   */
  private async processUserInput(userInput: string): Promise<void> {
    console.log(`\n🔄 Processing: "${userInput}"`);

    try {
      // 1. Classify input (our practical three-type classification)
      console.log('🔍 Classifying input...');
      const classification = await this.classifier.classify(userInput, {
        userId: 'local-user',
        sessionId: this.stateManager.getCurrentSession().sessionId,
        timestamp: new Date(),
        metadata: {}
      });

      console.log(`📊 Classification: ${classification.type} (confidence: ${classification.confidence})`);

      // 2. Process through agent (which uses StateManager)
      console.log('🤖 Processing with agent...');
      const response = await this.agent.process({
        input: userInput,
        context: {
          sessionId: this.stateManager.getCurrentSession().id,
          timestamp: new Date(),
          source: 'qi-code-cli',
          environmentContext: new Map([
            ['workingDirectory', process.cwd()],
            ['userId', 'local-user'],
            ['classification', classification]
          ])
        }
      });

      // 3. Display result
      console.log('✅ Agent response:');
      console.log(response.content);

      // 4. Update state (our centralized state management)
      this.stateManager.addConversationEntry({
        type: 'user_input',
        content: userInput,
        metadata: new Map([
          ['classification', classification.type],
          ['processingTime', response.executionTime]
        ])
      });
      
      this.stateManager.addConversationEntry({
        type: 'agent_response',
        content: response.content,
        metadata: new Map([
          ['success', response.success],
          ['confidence', response.confidence],
          ['executionTime', response.executionTime]
        ])
      });

      this.cli.sendFeedback({
        type: 'display_result',
        content: response.content
      });

    } catch (error) {
      console.error('❌ Processing failed:', error);
      this.cli.sendFeedback({
        type: 'display_error',
        error: `Failed to process input: ${error.message}`
      });
    }
  }

  /**
   * Get welcome message
   */
  private getWelcomeMessage(): string {
    const session = this.stateManager.getCurrentSession();
    const currentModel = this.stateManager.getCurrentModel();

    return `
╭─────────────────────────────────────────────────────────────╮
│                      🚀 qi-code v0.2.7                     │
│                   AI Coding Assistant                       │
│                                                             │
│  Superior Architecture Demonstration:                       │
│  CLI → StateManager → Classifier → Agent → Tools           │
│                                                             │
│  Three-Type Classification:                                 │
│  • Commands: /help, /config, /model                        │
│  • Prompts: "hi", "write quicksort in haskell"             │
│  • Workflows: "fix bug in src/file.ts and run tests"       │
│                                                             │
│  Current Session: ${session?.id?.substring(0, 8) || 'no-session'}...                              │
│  Current Model: ${currentModel || 'no-model'}                                    │
│  Working Directory: ${process.cwd()}                        │
╰─────────────────────────────────────────────────────────────╯

Type your request or use commands like /help, /config, /model
`;
  }

  /**
   * Get system prompt for agent
   */
  private getSystemPrompt(): string {
    return `You are qi-code, an AI coding assistant with a superior architecture.

Your architecture: Agent holds StateManager and uses classifiers to dispatch to handlers

You can handle three types of input:
1. Commands: System commands like /help, /config, /model
2. Prompts: Simple conversational requests like "write a quicksort in haskell"
3. Workflows: Complex multi-step tasks like "fix bug in src/file.ts and run tests"

You have access to:
- Centralized state management (configurations, context, history)
- Practical input classification (command/prompt/workflow)
- Modular and testable architecture

Be helpful, accurate, and demonstrate the benefits of your superior architecture.`;
  }
}

/**
 * Main entry point
 */
async function main() {
  try {
    const app = new QiCodeApp();
    await app.start();
  } catch (error) {
    console.error('❌ Failed to start qi-code:', error);
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  console.log('\n\n👋 Goodbye! qi-code shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n👋 qi-code terminated gracefully');
  process.exit(0);
});

// Start the application
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { QiCodeApp };