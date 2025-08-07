/**
 * Quick test of one classification via Python MCP
 */

const { createInputClassifier } = await import('./lib/dist/classifier/index.js');

async function quickTest() {
  console.log('🧪 Testing single Python MCP classification...\n');
  
  try {
    const classifier = createInputClassifier({
      method: 'python-langchain-mcp',
      schemaName: 'minimal',
      modelId: 'llama3.2:3b',
      baseUrl: 'http://localhost:11434'
    });
    
    console.log('🚀 Classifying: "hi there"');
    const result = await classifier.classify('hi there');
    console.log(`✅ Result: ${result.type} (${Math.round(result.confidence * 100)}%)`);
    console.log(`⏱️  Latency: ${result.metadata.get('latency_ms') || 'unknown'}ms`);
    console.log(`🔧 Method: ${result.method}`);
    
    // Test cleanup
    if (classifier.dispose) {
      await classifier.dispose();
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

quickTest();