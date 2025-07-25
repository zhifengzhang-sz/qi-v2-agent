#!/usr/bin/env bun

// Simulate the exact UI flow to verify message display
console.log('🧪 Simulating UI flow to test message display...');

// Simulate the React state behavior
let messages = [
  {
    id: '0',
    role: 'system', 
    content: '🤖 Qi Agent V2 - Ready!',
    timestamp: new Date(),
  }
];

let pendingTokens = '';
let isLoading = false;

// Simulate user sending message
console.log('👤 User sends: "hi"');
const userMessage = {
  id: Date.now().toString(),
  role: 'user',
  content: 'hi',
  timestamp: new Date(),
};
messages = [...messages, userMessage];
isLoading = true;

console.log(`📋 Messages after user input: ${messages.length} messages`);
console.log(`   Last message: ${messages[messages.length - 1].content}`);

// Simulate token received
console.log('\n📦 Token received: "hi"');
pendingTokens = 'hi';

// Simulate batching effect (only triggers if pendingTokens.length > 0)
console.log('\n🔄 Batching effect triggered...');
if (pendingTokens && pendingTokens.length > 0) {
  console.log(`✅ Batching ${pendingTokens.length} characters: "${pendingTokens}"`);
  
  const lastMsg = messages[messages.length - 1];
  if (lastMsg && lastMsg.role === 'assistant') {
    // Update existing assistant message
    messages = messages.slice(0, -1).concat({
      ...lastMsg,
      content: pendingTokens,
    });
    console.log('   Updated existing assistant message');
  } else {
    // Create new assistant message
    messages = messages.concat({
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: pendingTokens,
      timestamp: new Date(),
    });
    console.log('   Created new assistant message');
  }
  
  pendingTokens = ''; // Clear after display
} else {
  console.log('❌ Batching effect skipped (no content)');
}

console.log(`📋 Messages after batching: ${messages.length} messages`);
console.log(`   Last message: ${messages[messages.length - 1].content}`);

// Simulate onComplete
console.log('\n✅ onComplete called with: "hi"');
pendingTokens = 'hi'; // This triggers batching again

// Simulate batching effect again
console.log('\n🔄 Batching effect triggered again...');
if (pendingTokens && pendingTokens.length > 0) {
  console.log(`✅ Batching ${pendingTokens.length} characters: "${pendingTokens}"`);
  
  const lastMsg = messages[messages.length - 1];
  if (lastMsg && lastMsg.role === 'assistant') {
    // Update existing assistant message
    messages = messages.slice(0, -1).concat({
      ...lastMsg,
      content: pendingTokens,
    });
    console.log('   Updated existing assistant message');
  } else {
    // Create new assistant message
    messages = messages.concat({
      id: (Date.now() + 2).toString(),
      role: 'assistant',
      content: pendingTokens,
      timestamp: new Date(),
    });
    console.log('   Created new assistant message');
  }
  
  pendingTokens = ''; // Clear after display
} else {
  console.log('❌ Batching effect skipped (no content)');
}

console.log(`📋 Messages after onComplete batching: ${messages.length} messages`);
console.log(`   Last message: ${messages[messages.length - 1].content}`);

// Simulate setTimeout clearing pendingTokens
console.log('\n⏱️  setTimeout clears pendingTokens to ""');
pendingTokens = '';

// Simulate final batching effect (should be skipped now)
console.log('\n🔄 Final batching effect check...');
if (pendingTokens && pendingTokens.length > 0) {
  console.log('❌ This should NOT happen anymore!');
} else {
  console.log('✅ Batching effect correctly skipped (empty pendingTokens)');
}

console.log(`📋 Final messages: ${messages.length} messages`);
messages.forEach((msg, i) => {
  console.log(`   ${i + 1}. [${msg.role}]: "${msg.content}"`);
});

console.log('\n🎯 RESULT: Message should be visible in UI');