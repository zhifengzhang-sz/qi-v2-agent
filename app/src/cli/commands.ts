import { Command } from 'commander';
import { QiAgentFactory, ConfigLoader } from '@qi/agent';
import { ChatWorkflow } from '../workflows/chat.js';

export function createCLI(): Command {
  const program = new Command();

  program
    .name('qi-agent')
    .description('AI Coding Assistant with Local LLM Support')
    .version('0.2.4');

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

  return program;
}