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

    // Build app package
    console.log('📱 Building application layer (app)...');
    const appBuild = spawn({
      cmd: ['/home/zzhang/.bun/bin/bun', 'run', 'build'],
      cwd: './app',
      stdout: 'inherit',
      stderr: 'inherit'
    });
    
    await appBuild.exited;
    if (appBuild.exitCode !== 0) {
      throw new Error('App build failed');
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

    // Compile to single binary
    const compile = spawn({
      cmd: ['/home/zzhang/.bun/bin/bun', 'run', 'compile'],
      cwd: './app',
      stdout: 'inherit',
      stderr: 'inherit'
    });
    
    await compile.exited;
    if (compile.exitCode !== 0) {
      throw new Error('Compilation failed');
    }

    console.log('✅ Single binary created: app/qi-agent');

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