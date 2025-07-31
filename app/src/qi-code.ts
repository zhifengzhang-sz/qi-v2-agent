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

// No qicore imports needed - clean agent layer
import { PureCLI, type CLIInput, type CLIFeedback } from './cli/impl/pure-cli.js';
import { createStateManager } from './state/index.js';
import { MultiMethodInputClassifier } from './classifier/impl/multi-method-input-classifier.js';
import { createAgent } from './agent/index.js';
import { createContextManager, createDefaultAppContext } from './context/index.js';
import { createPromptHandler } from './prompt/index.js';
import type { IStateManager } from './state/index.js';
import type { IAgent } from './agent/index.js';
import type { IClassifier } from './classifier/index.js';
import type { IContextManager } from './context/index.js';
import type { IPromptHandler } from './prompt/index.js';

/**
 * qi-code Application
 * 
 * Demonstrates our superior architecture with clean separation of concerns
 */
class QiCodeApp {
  private stateManager: IStateManager;
  private contextManager: IContextManager;
  private classifier?: IClassifier;
  private promptHandler?: IPromptHandler;
  private agent?: IAgent;
  private cli: PureCLI;
  private isRunning = false;

  constructor() {
    console.log('🚀 Initializing qi-code with superior architecture...\n');

    // 1. Create StateManager (centralized configuration and state)
    console.log('📋 Creating StateManager...');
    this.stateManager = createStateManager();

    // 2. Create ContextManager (context continuation support)
    console.log('🧠 Creating ContextManager...');
    const appContext = createDefaultAppContext();
    this.contextManager = createContextManager(appContext);

    // 3. Create PureCLI (clean interface separation)
    console.log('💻 Creating PureCLI interface...');
    this.cli = new PureCLI();

    console.log('✅ qi-code base components initialized!\n');
    console.log('ℹ️  Components will be configured after loading LLM config...\n');
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
      // Step 1: Load LLM configuration in StateManager (Simple agent interface)
      console.log('🔧 Loading LLM configuration in StateManager...');
      const configPath = '../config';
      await this.stateManager.loadLLMConfig(configPath);
      console.log('✅ LLM configuration loaded successfully');

      // Step 2: Create components with role-specific configurations
      console.log('🔍 Creating Classifier with role-specific LLM config...');
      const classifierConfig = this.stateManager.getClassifierConfig();
      if (!classifierConfig) {
        throw new Error('Classifier configuration not found');
      }
      
      this.classifier = new MultiMethodInputClassifier({
        defaultMethod: 'hybrid',        // Now uses proper config from StateManager
        fallbackMethod: 'rule-based',   // Fallback when LLM unavailable
        confidenceThreshold: 0.8,
        commandPrefix: '/',
        promptIndicators: [
          'hi', 'hello', 'thanks', 'what', 'how', 'why', 'when', 
          'can you', 'could you', 'please', 'explain', 'write', 'create'
        ],
        workflowIndicators: [
          'fix', 'refactor', 'implement', 'debug', 'analyze', 
          'build', 'design', 'test', 'deploy'
        ],
        complexityThresholds: new Map([
          ['command', 1.0],
          ['prompt', 0.8],
          ['workflow', 0.7]
        ]),
        // LLM configuration from StateManager 
        llmConfig: {
          provider: classifierConfig.provider,
          model: classifierConfig.model,
          baseURL: 'http://172.18.144.1:11434', // Get from provider config eventually
          temperature: classifierConfig.temperature || 0.1,
          maxTokens: classifierConfig.maxTokens || 200
        }
      });

      console.log('💬 Creating PromptHandler with role-specific LLM config...');
      const promptConfig = this.stateManager.getPromptConfig();
      if (!promptConfig) {
        throw new Error('Prompt configuration not found');
      }
      
      // Create prompt handler that will get its config from StateManager
      this.promptHandler = createPromptHandler();
      
      // For now, still initialize with file paths (this should be improved to use StateManager's config)
      const configFilePath = '../config/llm-providers.yaml';
      const schemaPath = '../config/llm-providers.schema.json';
      const initResult = await this.promptHandler.initialize(configFilePath, schemaPath);
      
      if (!initResult.success) {
        console.warn('⚠️  PromptHandler initialization failed, continuing with basic functionality');
        console.warn('   Error:', initResult.error);
      } else {
        console.log('✅ PromptHandler initialized with Ollama support');
        console.log(`   Using role-specific config: ${promptConfig.provider}/${promptConfig.model}`);
      }

      // Step 3: Create Agent with configured components
      console.log('🤖 Creating QiCodeAgent with configured components...');
      this.agent = createAgent(this.stateManager, this.contextManager, {
        domain: 'coding-assistant',
        enableCommands: true,
        enablePrompts: true,
        enableWorkflows: false, // Not fully implemented yet
        sessionPersistence: false,
        classifier: this.classifier,
        promptHandler: this.promptHandler
        // commandHandler, workflowEngine would be added here when available
      });

      // Step 4: Initialize agent components
      await this.agent.initialize();

      // Set up CLI input callback
      this.cli.onInput(async (input: CLIInput): Promise<void> => {
        await this.handleCLIInput(input);
      });

      // Start CLI interface
      await this.cli.start();

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
          // Agent holds StateManager and ContextManager objects and uses them via contracts
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
      this.cli.displayFeedback({
        type: 'display_error',
        error: `Processing error: ${error instanceof Error ? error.message : String(error)}`
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
      if (!this.classifier) {
        throw new Error('Classifier not initialized');
      }
      const classification = await this.classifier.classify(userInput, {
        context: {
          sessionId: this.stateManager.getCurrentSession().id,
          timestamp: new Date(),
          source: 'qi-code-cli',
          environmentContext: new Map([
            ['workingDirectory', process.cwd()],
            ['userId', 'local-user']
          ])
        }
      });

      console.log(`📊 Classification: ${classification.type} (confidence: ${classification.confidence})`);

      // 2. Process through agent (which uses StateManager)
      console.log('🤖 Processing with agent...');
      if (!this.agent) {
        throw new Error('Agent not initialized');
      }
      const response = await this.agent.process({
        input: userInput,
        context: {
          sessionId: this.stateManager.getCurrentSession().id,
          timestamp: new Date(),
          source: 'qi-code-cli',
          environmentContext: new Map([
            ['workingDirectory', process.cwd()],
            ['userId', 'local-user'],
            ['classification', JSON.stringify(classification)]
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
          ['processingTime', response.executionTime.toString()]
        ])
      });
      
      this.stateManager.addConversationEntry({
        type: 'agent_response',
        content: response.content,
        metadata: new Map([
          ['success', response.success?.toString() || 'false'],
          ['confidence', response.confidence.toString()],
          ['executionTime', response.executionTime.toString()]
        ])
      });

      this.cli.displayFeedback({
        type: 'display_result',
        content: response.content
      });

    } catch (error) {
      console.error('❌ Processing failed:', error);
      this.cli.displayFeedback({
        type: 'display_error',
        error: `Failed to process input: ${error instanceof Error ? error.message : String(error)}`
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
│                      🚀 qi-code v0.3.0                     │
│                   AI Coding Assistant                       │
│                                                             │
│  Superior Architecture with Full Component Integration:     │
│  CLI → Agent(StateManager + ContextManager + Classifier)   │
│                                                             │
│  Three-Type Classification:                                 │
│  • Commands: /help, /status, /model                        │
│  • Prompts: "hi", "write quicksort in haskell"             │
│  • Workflows: "fix bug in src/file.ts and run tests"       │
│                                                             │
│  Features: Context Continuation, Ollama Integration        │
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

Your architecture: Agent holds StateManager + ContextManager and uses classifiers to dispatch to handlers

You can handle three types of input:
1. Commands: System commands like /help, /status, /model
2. Prompts: Simple conversational requests like "write a quicksort in haskell"
3. Workflows: Complex multi-step tasks like "fix bug in src/file.ts and run tests"

You have access to:
- Centralized state management (configurations, context, history)
- Context continuation across conversations
- Ollama local LLM integration
- Practical input classification (command/prompt/workflow)
- Modular and testable architecture

Be helpful, accurate, and demonstrate the benefits of your superior architecture with context awareness.`;
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