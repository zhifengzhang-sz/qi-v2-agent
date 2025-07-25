import { render } from 'ink';
import React from 'react';
import type { QiAgentFactory } from '@qi/agent';
import { ChatApp } from '../ui/ChatApp.js';

export interface ChatWorkflowOptions {
  threadId?: string;
  debug?: boolean;
}

export class ChatWorkflow {
  private agentFactory: QiAgentFactory;
  private options: ChatWorkflowOptions;

  constructor(agentFactory: QiAgentFactory, options: ChatWorkflowOptions = {}) {
    this.agentFactory = agentFactory;
    this.options = options;
  }

  async start(): Promise<void> {
    console.log('💬 Starting interactive chat session...');
    
    if (this.options.threadId) {
      console.log(`🧵 Using thread: ${this.options.threadId}`);
    }

    // Clean up resources on exit
    const cleanup = async () => {
      console.log('\\n👋 Goodbye!');
      await this.agentFactory.cleanup();
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    // Render the Chat UI
    const { unmount } = render(
      React.createElement(ChatApp, {
        agentFactory: this.agentFactory,
        threadId: this.options.threadId,
        debug: this.options.debug,
        onExit: cleanup,
      })
    );

    // Handle unmount
    process.on('exit', () => {
      unmount();
    });
  }
}