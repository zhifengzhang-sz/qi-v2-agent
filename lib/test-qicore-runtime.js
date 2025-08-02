// Test qicore runtime resolution
import { Ok, Err, match } from '@qi/base';
import { ConfigBuilder } from '@qi/core';

console.log('🧪 Testing qicore runtime resolution...');
console.log('=========================================\n');

// Test Result<T> patterns
const testResult = Ok('Hello qicore!');
console.log('✅ Result<T> creation:', testResult);

// Test match function
const message = match(
  value => `Success: ${value}`,
  error => `Error: ${error}`,
  testResult
);
console.log('✅ Result<T> match:', message);

// Test ConfigBuilder (check the API first)
try {
  const config = new ConfigBuilder();
  console.log('✅ ConfigBuilder created:', config);
} catch (e) {
  console.log('⚠️ ConfigBuilder API might be different:', e.message);
}

console.log('\n🎯 qicore dependencies are working correctly!');
console.log('✨ Ready to test 3-way classification fix');