#!/usr/bin/env node

/**
 * Test script for file reference workflow
 */

import { QiPromptCLI } from './app/src/prompt/qi-prompt.ts';

async function testFileWorkflow() {
  console.log('🧪 Testing file reference workflow...\n');
  
  const cli = new QiPromptCLI({ debug: true, framework: 'readline' });
  
  try {
    await cli.initialize();
    console.log('✅ CLI initialized successfully\n');
    
    // Test the workflow processing by accessing the orchestrator directly
    const testInput = '@test_file.txt explain what this file contains';
    console.log(`🔍 Testing input: "${testInput}"\n`);
    
    // Listen for workflow events
    let workflowTriggered = false;
    let enhancedPromptCreated = false;
    
    cli.orchestrator.on('workflowOutput', (event) => {
      console.log('🎉 Workflow output detected!');
      console.log('Original:', event.original);
      console.log('Enhanced:', event.enhanced.substring(0, 200) + '...');
      console.log('Workflow:', event.workflow);
      workflowTriggered = true;
    });
    
    cli.orchestrator.on('enhancedPrompt', (event) => {
      console.log('📝 Enhanced prompt created!');
      console.log('Original:', event.original);
      console.log('Enhanced length:', event.enhanced.length);
      enhancedPromptCreated = true;
    });
    
    // Process the test input
    const request = {
      input: testInput,
      context: {
        sessionId: 'test-session',
        timestamp: new Date()
      }
    };
    
    // Wait a bit for events to process
    setTimeout(() => {
      console.log('\n📊 Test Results:');
      console.log(`Workflow triggered: ${workflowTriggered ? '✅' : '❌'}`);
      console.log(`Enhanced prompt: ${enhancedPromptCreated ? '✅' : '❌'}`);
      
      if (workflowTriggered) {
        console.log('\n🎉 File reference workflow is working!');
      } else {
        console.log('\n❌ File reference workflow is not working');
      }
      
      cli.shutdown();
    }, 2000);
    
    // Trigger the workflow by processing input
    await cli.orchestrator.process(request);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    cli.shutdown();
  }
}

testFileWorkflow();