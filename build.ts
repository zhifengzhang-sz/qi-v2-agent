#!/usr/bin/env bun

import { spawn } from 'bun';

async function build() {
  console.log('🚀 Building Qi V2 Agent...');

  try {
    // Build lib package
    console.log('📦 Building fundamental layer (lib)...');
    const libBuild = spawn({
      cmd: ['/home/zzhang/.bun/bin/bun', 'run', 'build'],
      cwd: './lib',
      stdout: 'inherit',
      stderr: 'inherit'
    });
    
    await libBuild.exited;
    if (libBuild.exitCode !== 0) {
      throw new Error('Lib build failed');
    }

    // Validate app package (no build step needed for TypeScript direct execution)
    console.log('📱 Validating application layer (app)...');
    const appCheck = spawn({
      cmd: ['/home/zzhang/.bun/bin/bun', 'run', 'check'],
      cwd: './app',
      stdout: 'inherit',
      stderr: 'inherit'
    });
    
    await appCheck.exited;
    if (appCheck.exitCode !== 0) {
      throw new Error('App validation failed');
    }

    console.log('✅ Build completed successfully!');

  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

async function compile() {
  console.log('📦 Compiling single binary...');

  try {
    await build();

    // Create binaries for both applications
    console.log('🔧 Creating qi-prompt binary...');
    const compilePrompt = spawn({
      cmd: ['/home/zzhang/.bun/bin/bun', 'build', 'src/prompt/qi-prompt.ts', '--outfile', 'qi-prompt', '--target', 'node'],
      cwd: './app',
      stdout: 'inherit',
      stderr: 'inherit'
    });
    
    await compilePrompt.exited;
    if (compilePrompt.exitCode !== 0) {
      console.log('⚠️ qi-prompt binary compilation failed');
    } else {
      console.log('✅ qi-prompt binary created: app/qi-prompt');
    }

    console.log('🔧 Creating qi-code binary...');
    const compileCode = spawn({
      cmd: ['/home/zzhang/.bun/bin/bun', 'build', 'src/qi-code/qi-code.ts', '--outfile', 'qi-code', '--target', 'node'],
      cwd: './app',
      stdout: 'inherit',
      stderr: 'inherit'
    });
    
    await compileCode.exited;
    if (compileCode.exitCode !== 0) {
      console.log('⚠️ qi-code binary compilation failed');
    } else {
      console.log('✅ qi-code binary created: app/qi-code');
    }

  } catch (error) {
    console.error('❌ Compilation failed:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const command = process.argv[2];

switch (command) {
  case 'compile':
    await compile();
    break;
  case 'build':
  default:
    await build();
    break;
}