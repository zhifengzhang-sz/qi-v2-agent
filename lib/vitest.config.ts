import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist', '.git', '**/*.d.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/index.ts', // Re-export files
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: [
      { find: '@qi/agent/config', replacement: resolve(__dirname, './src/config') },
      { find: '@qi/agent/mcp', replacement: resolve(__dirname, './src/mcp') },
      { find: '@qi/agent/llm', replacement: resolve(__dirname, './src/llm') },
      { find: '@qi/agent/agent', replacement: resolve(__dirname, './src/agent') },
      { find: '@qi/agent/utils', replacement: resolve(__dirname, './src/utils') },
      { find: '@qi/agent', replacement: resolve(__dirname, './src/index.ts') },
      { find: '@', replacement: resolve(__dirname, './src') },
      { find: '@/agent', replacement: resolve(__dirname, './src/agent') },
      { find: '@/mcp', replacement: resolve(__dirname, './src/mcp') },
      { find: '@/llm', replacement: resolve(__dirname, './src/llm') },
      { find: '@/config', replacement: resolve(__dirname, './src/config') },
      { find: '@/utils', replacement: resolve(__dirname, './src/utils') },
    ],
  },
});