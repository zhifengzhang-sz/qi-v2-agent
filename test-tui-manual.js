#!/usr/bin/env node

// Manual test to trigger TUI response display
process.env.QI_BLESSED_TUI = 'true';

setTimeout(async () => {
  try {
    // Import the TUI factory
    const { createBlessedTUICLI } = await import('./lib/src/cli/factories/createBlessedTUICLI.js');
    
    // Create minimal services
    const mockEventManager = {
      emit: (event, data) => console.log(`Event: ${event}`, data),
      on: (event, callback) => {}
    };
    
    const mockCommandRouter = {
      parseInput: () => ({ tag: 'error' })  
    };
    
    const mockAgentConnector = {
      connectAgent: () => ({ tag: 'success' }),
      isAgentConnected: () => true
    };
    
    // Create TUI CLI
    const cliResult = await createBlessedTUICLI(
      mockEventManager, 
      mockCommandRouter, 
      mockAgentConnector
    );
    
    if (cliResult.tag === 'failure') {
      console.error('Failed to create TUI:', cliResult.error);
      process.exit(1);
    }
    
    const cli = cliResult.value;
    await cli.initialize();
    
    console.log('✅ TUI initialized successfully');
    
    // Manually test streaming
    setTimeout(() => {
      console.log('🧪 Testing streaming...');
      cli.startStreaming();
      cli.addStreamingChunk('Hello from test!');
      cli.addStreamingChunk('\nThis is a test response.');
      
      setTimeout(() => {
        cli.addStreamingChunk('\nMore content...');
        cli.completeStreaming('Test complete!');
      }, 1000);
    }, 2000);
    
    await cli.start();
    
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}, 100);