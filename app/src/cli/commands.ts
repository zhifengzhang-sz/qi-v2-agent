import { Command } from 'commander';
import { QiAgentFactory, ConfigLoader } from '@qi/agent';
import { ChatWorkflow } from '../workflows/chat.js';
import { createEditWorkflowMessages, createAnalyzeWorkflowMessages, createExplainWorkflowMessages } from '../workflows/messages.js';
import { render } from 'ink';
import React from 'react';

export function createCLI(): Command {
  const program = new Command();

  program
    .name('qi-agent')
    .description('AI Coding Assistant with Local LLM Support')
    .version('0.2.5');

  program
    .command('chat')
    .description('Start interactive chat session')
    .option('-c, --config <path>', 'Configuration file path', '../config/qi-config.yaml')
    .option('-m, --model <name>', 'Model to use')
    .option('-t, --thread <id>', 'Thread ID for conversation persistence')
    .option('--debug', 'Enable debug logging')
    .option('--no-thinking', 'Disable thinking mode for DeepSeek-R1')
    .action(async (options) => {
      try {
        if (options.debug) {
          console.log('🐛 Debug mode enabled');
        }

        console.log('🚀 Starting Qi Agent...');

        // Load configuration
        const configLoader = new ConfigLoader(options.config);
        let config = configLoader.loadConfig();

        // Override model if specified
        if (options.model) {
          config = {
            ...config,
            model: {
              ...config.model,
              name: options.model,
            },
          };
        }

        // Override thinking mode if specified
        if (options.noThinking) {
          config = {
            ...config,
            model: {
              ...config.model,
              thinkingEnabled: false,
            },
          };
        }

        // Initialize agent
        const agentFactory = new QiAgentFactory(config);
        await agentFactory.initialize();

        // Skip health check for now - it's too slow and not critical for startup
        // TODO: Implement a lightweight health check that doesn't make LLM calls
        console.log('⚡ Skipping health check for faster startup');

        // Start chat workflow
        console.log('🎯 Creating chat workflow...');
        const chatWorkflow = new ChatWorkflow(agentFactory, {
          threadId: options.thread,
          debug: options.debug,
        });

        console.log('▶️  Starting chat workflow...');
        await chatWorkflow.start();

      } catch (error) {
        console.error('❌ Failed to start Qi Agent:', error);
        process.exit(1);
      }
    });

  program
    .command('config')
    .description('Manage configuration')
    .option('-v, --validate [path]', 'Validate configuration file')
    .option('-s, --show [path]', 'Show current configuration')
    .action(async (options) => {
      try {
        const configPath = (typeof options.validate === 'string' ? options.validate : null) || 
                          (typeof options.show === 'string' ? options.show : null) || 
                          '../config/qi-config.yaml';
        const configLoader = new ConfigLoader(configPath);

        if (options.validate) {
          const config = configLoader.loadConfig();
          console.log('✅ Configuration is valid');
          console.log(`📊 Servers configured: ${Object.keys(config.mcp.servers).length}`);
          console.log(`🤖 Model: ${config.model.name}`);
        }

        if (options.show) {
          const config = configLoader.loadConfig();
          console.log('📋 Current Configuration:');
          console.log(JSON.stringify(config, null, 2));
        }

      } catch (error) {
        console.error('❌ Configuration error:', error);
        process.exit(1);
      }
    });

  program
    .command('servers')
    .description('Manage MCP servers')
    .option('-l, --list', 'List configured servers')
    .option('-t, --test', 'Test server connections')
    .option('-c, --config <path>', 'Configuration file path', '../config/qi-config.yaml')
    .action(async (options) => {
      try {
        const configLoader = new ConfigLoader(options.config);
        const config = configLoader.loadConfig();

        if (options.list) {
          console.log('📋 Configured MCP Servers:');
          for (const [name, serverConfig] of Object.entries(config.mcp.servers)) {
            console.log(`  • ${name} (${serverConfig.transport})`);
            if (serverConfig.command) {
              console.log(`    Command: ${serverConfig.command} ${serverConfig.args?.join(' ') || ''}`);
            }
            if (serverConfig.url) {
              console.log(`    URL: ${serverConfig.url}`);
            }
          }
        }

        if (options.test) {
          console.log('🔌 Testing server connections...');
          const agentFactory = new QiAgentFactory(config);
          await agentFactory.initialize();
          
          const connectedServers = await agentFactory.getConnectedServers();
          const availableTools = await agentFactory.getAvailableTools();
          
          console.log(`✅ Connected to ${connectedServers.length} server(s)`);
          console.log(`🔧 ${availableTools.length} tools available`);
          
          if (availableTools.length > 0) {
            console.log('Available tools:');
            availableTools.forEach((tool) => console.log(`  • ${tool}`));
          }

          await agentFactory.cleanup();
        }

      } catch (error) {
        console.error('❌ Server management error:', error);
        process.exit(1);
      }
    });

  // File Workflows (v-0.2.5+)
  program
    .command('edit')
    .description('AI-assisted file editing')
    .argument('[files...]', 'Files to edit')
    .option('-m, --message <msg>', 'Edit instruction')
    .option('-i, --interactive', 'Interactive multi-file editing mode')
    .option('-c, --config <path>', 'Configuration file path', '../config/qi-config.yaml')
    .option('--debug', 'Enable debug logging')
    .action(async (files, options) => {
      try {
        if (!options.message) {
          console.error('❌ Edit instruction is required. Use -m or --message to specify what changes to make.');
          process.exit(1);
        }

        if (!files || files.length === 0) {
          console.error('❌ At least one file must be specified for editing.');
          process.exit(1);
        }

        if (options.debug) {
          console.log('🐛 Debug mode enabled for edit workflow');
        }

        console.log('🚀 Starting Qi Agent for file editing...');

        // Load configuration
        const configLoader = new ConfigLoader(options.config);
        const config = configLoader.loadConfig();

        // Initialize agent
        const agentFactory = new QiAgentFactory(config);
        await agentFactory.initialize();

        console.log(`✏️  Preparing to edit ${files.length} file(s): ${files.join(', ')}`);
        console.log(`📝 Instructions: ${options.message}`);

        // Create workflow messages that trigger smart routing
        const workflowMessages = createEditWorkflowMessages(files, {
          message: options.message,
          interactive: options.interactive
        });

        // Use existing validated SimpleChatApp infrastructure
        const { SimpleChatApp } = await import('../ui/SimpleChatApp.js');
        
        console.log('🎯 Starting edit workflow...');
        
        // Create cleanup function
        const cleanup = async () => {
          await agentFactory.cleanup();
          process.exit(0);
        };

        // Render workflow UI with initial messages
        render(React.createElement(SimpleChatApp, {
          agentFactory,
          threadId: options.thread,
          debug: options.debug,
          onExit: cleanup,
          // Pass initial messages to start the workflow immediately
          initialMessages: workflowMessages.map((msg, index) => ({
            id: `workflow-${index}`,
            role: msg.role,
            content: msg.content,
            timestamp: new Date()
          }))
        }));

      } catch (error) {
        console.error('❌ Failed to start edit workflow:', error);
        process.exit(1);
      }
    });

  program
    .command('analyze')
    .description('Code and file analysis with detailed insights')
    .argument('<target>', 'File, directory, or code pattern to analyze')
    .option('--codebase', 'Analyze entire codebase')
    .option('--complexity', 'Focus on complexity analysis')
    .option('--dependencies', 'Analyze dependencies and imports')
    .option('--format <type>', 'Output format (text, json, markdown)', 'text')
    .option('-c, --config <path>', 'Configuration file path', '../config/qi-config.yaml')
    .option('--debug', 'Enable debug logging')
    .action(async (target, options) => {
      try {
        if (options.debug) {
          console.log('🐛 Debug mode enabled for analyze workflow');
        }

        console.log('🚀 Starting Qi Agent for code analysis...');

        // Load configuration
        const configLoader = new ConfigLoader(options.config);
        const config = configLoader.loadConfig();

        // Initialize agent
        const agentFactory = new QiAgentFactory(config);
        await agentFactory.initialize();

        console.log(`🔍 Preparing to analyze: ${target}`);
        if (options.codebase) console.log('📊 Codebase-wide analysis enabled');
        if (options.complexity) console.log('🔄 Complexity analysis focus');
        if (options.dependencies) console.log('📦 Dependency analysis focus');

        // Create workflow messages that trigger smart routing
        const workflowMessages = createAnalyzeWorkflowMessages(target, {
          codebase: options.codebase,
          complexity: options.complexity,
          dependencies: options.dependencies,
          format: options.format
        });

        // Use existing validated SimpleChatApp infrastructure
        const { SimpleChatApp } = await import('../ui/SimpleChatApp.js');
        
        console.log('🎯 Starting analyze workflow...');
        
        // Create cleanup function
        const cleanup = async () => {
          await agentFactory.cleanup();
          process.exit(0);
        };

        // Render workflow UI with initial messages
        render(React.createElement(SimpleChatApp, {
          agentFactory,
          threadId: options.thread,
          debug: options.debug,
          onExit: cleanup,
          // Pass initial messages to start the workflow immediately
          initialMessages: workflowMessages.map((msg, index) => ({
            id: `analyze-${index}`,
            role: msg.role,
            content: msg.content,
            timestamp: new Date()
          }))
        }));

      } catch (error) {
        console.error('❌ Failed to start analyze workflow:', error);
        process.exit(1);
      }
    });

  program
    .command('explain')
    .description('Code explanation and educational assistance')
    .argument('<target>', 'File path, function, or concept to explain')
    .option('--concept <topic>', 'Explain a programming concept')
    .option('--line <number>', 'Focus on specific line number', parseInt)
    .option('--function <name>', 'Explain specific function')
    .option('--level <level>', 'Explanation level (beginner|intermediate|advanced)', 'intermediate')
    .option('-c, --config <path>', 'Configuration file path', '../config/qi-config.yaml')
    .option('--debug', 'Enable debug logging')
    .action(async (target, options) => {
      try {
        if (options.debug) {
          console.log('🐛 Debug mode enabled for explain workflow');
        }

        console.log('🚀 Starting Qi Agent for code explanation...');

        // Load configuration
        const configLoader = new ConfigLoader(options.config);
        const config = configLoader.loadConfig();

        // Initialize agent
        const agentFactory = new QiAgentFactory(config);
        await agentFactory.initialize();

        if (options.concept) {
          console.log(`📚 Explaining concept: ${options.concept}`);
        } else {
          console.log(`📖 Explaining code in: ${target}`);
        }
        
        if (options.line) console.log(`📍 Focusing on line: ${options.line}`);
        if (options.function) console.log(`🔧 Focusing on function: ${options.function}`);
        console.log(`🎯 Explanation level: ${options.level}`);

        // Create workflow messages that trigger smart routing
        const workflowMessages = createExplainWorkflowMessages(target, {
          concept: options.concept,
          line: options.line,
          function: options.function,
          level: options.level
        });

        // Use existing validated SimpleChatApp infrastructure
        const { SimpleChatApp } = await import('../ui/SimpleChatApp.js');
        
        console.log('🎯 Starting explain workflow...');
        
        // Create cleanup function
        const cleanup = async () => {
          await agentFactory.cleanup();
          process.exit(0);
        };

        // Render workflow UI with initial messages
        render(React.createElement(SimpleChatApp, {
          agentFactory,
          threadId: options.thread,
          debug: options.debug,
          onExit: cleanup,
          // Pass initial messages to start the workflow immediately
          initialMessages: workflowMessages.map((msg, index) => ({
            id: `explain-${index}`,
            role: msg.role,
            content: msg.content,
            timestamp: new Date()
          }))
        }));

      } catch (error) {
        console.error('❌ Failed to start explain workflow:', error);
        process.exit(1);
      }
    });

  return program;
}