/**
 * Quick test of Python MCP method integration
 */

const { createInputClassifier } = await import('./lib/dist/classifier/index.js');

async function testPythonMCP() {
  console.log('🧪 Testing Python MCP method integration...\n');
  
  try {
    // Test with different schema complexities
    const schemas = ['minimal', 'standard', 'context_aware'];
    const inputs = [
      'hi there',  // should be prompt
      'create a new project with tests and documentation'  // should be workflow
    ];
    
    for (const schema of schemas) {
      console.log(`📋 Testing schema: ${schema}`);
      
      const classifier = createInputClassifier({
        method: 'python-langchain-mcp',
        schemaName: schema,
        modelId: 'llama3.2:3b',
        baseUrl: 'http://localhost:11434'
      });
      
      for (const input of inputs) {
        console.log(`  Input: "${input}"`);
        
        try {
          const result = await classifier.classify(input);
          console.log(`    Result: ${result.type} (${Math.round(result.confidence * 100)}%)`);
          if (result.reasoning) {
            console.log(`    Reasoning: ${result.reasoning}`);
          }
          
          // Log schema-specific fields
          if (result.extractedData.has('conversation_context')) {
            console.log(`    Context: ${result.extractedData.get('conversation_context')}`);
          }
          if (result.extractedData.has('step_count')) {
            console.log(`    Steps: ${result.extractedData.get('step_count')}`);
          }
        } catch (error) {
          console.log(`    ❌ Error: ${error.message}`);
        }
        console.log('');
      }
      console.log('');
    }
    
    console.log('✅ Python MCP method integration test completed');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testPythonMCP();