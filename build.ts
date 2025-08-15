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

    // Create single binary from main entry point
    console.log('🔧 Creating single binary...');
    const compile = spawn({
      cmd: ['/home/zzhang/.bun/bin/bun', 'build', 'src/prompt/qi-prompt.ts', '--outfile', 'qi-prompt', '--target', 'node'],
      cwd: './app',
      stdout: 'inherit',
      stderr: 'inherit'
    });
    
    await compile.exited;
    if (compile.exitCode !== 0) {
      console.log('⚠️ Binary compilation failed, but build completed successfully');
      return;
    }

    console.log('✅ Single binary created: app/qi-prompt');

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