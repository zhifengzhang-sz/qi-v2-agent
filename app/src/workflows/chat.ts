import { render } from 'ink';
import React from 'react';
import type { AgentFactory } from '@qi/agent';
import { SimpleChatApp } from '../ui/SimpleChatApp.js';

export interface ChatWorkflowOptions {
  threadId?: string;
  debug?: boolean;
}

export class ChatWorkflow {
  private agentFactory: AgentFactory;
  private options: ChatWorkflowOptions;

  constructor(agentFactory: AgentFactory, options: ChatWorkflowOptions = {}) {
    this.agentFactory = agentFactory;
    this.options = options;
  }

  async start(): Promise<void> {
    console.log('💬 Starting interactive chat session...');
    
    if (this.options.threadId) {
      console.log(`🧵 Using thread: ${this.options.threadId}`);
    }

    console.log('🎨 Initializing UI...');

    // Clean up resources on exit
    const cleanup = async () => {
      console.log('\\n👋 Goodbye!');
      await this.agentFactory.cleanup();
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    console.log('📦 Creating React component...');
    
    // Render the Chat UI
    const startRender = Date.now();
    const { unmount } = render(
      React.createElement(SimpleChatApp, {
        agentFactory: this.agentFactory,
        threadId: this.options.threadId,
        debug: this.options.debug,
        onExit: cleanup,
      })
    );
    
    console.log(`🚀 Ink render completed in ${Date.now() - startRender}ms`);

    // Handle unmount
    process.on('exit', () => {
      unmount();
    });
  }
}