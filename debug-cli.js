#!/usr/bin/env node

/**
 * Debug CLI creation and initialization with tsconfig-paths
 */

// Register tsconfig paths for runtime resolution
const tsConfig = require('./lib/tsconfig.json');
require('tsconfig-paths').register({
  baseUrl: './lib',
  paths: tsConfig.compilerOptions.paths
});

console.log('=== Debug CLI Creation ===');

async function testCLI() {
    try {
        console.log('1. Importing setupQuickCLI...');
        // Test with direct file import instead of broken package
        console.log('Testing direct file import...');
        const baseModule = await import('./lib/node_modules/@qi/dist/base.js');
        console.log('Base module loaded:', Object.keys(baseModule).slice(0, 5));
        
        const { setupQuickCLI } = await import('./lib/dist/index.js');
        
        console.log('2. Creating CLI with setupQuickCLI...');
        const cli = setupQuickCLI({
            debug: true,
            enableHotkeys: true,
            enableStreaming: true,
        });
        
        console.log('3. CLI created successfully:', !!cli);
        console.log('4. CLI type:', typeof cli);
        console.log('5. CLI methods:', Object.keys(cli).slice(0, 10));
        
        console.log('6. Starting CLI...');
        await cli.start();
        
    } catch (error) {
        console.error('❌ Error during CLI testing:', error);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

testCLI();