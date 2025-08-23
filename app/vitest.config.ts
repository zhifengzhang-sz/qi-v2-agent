import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist', '.git', '**/*.d.ts', 'src/demos/**', 'src/fine-tuning/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/index.ts', // Re-export files
        'src/demos/**',
        'src/fine-tuning/**',
        'src/study/**', // Study/research files
        'src/test-*.ts'
      ],
      thresholds: {
        global: {
          branches: 50,
          functions: 60,
          lines: 60,
          statements: 60,
        },
        // Higher standards for core components
        'src/prompt/**/*': { functions: 70 },
        'src/main.ts': { functions: 80 },
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: [
      { find: '@qi/agent/config', replacement: resolve(__dirname, '../lib/src/config') },
      { find: '@qi/agent/mcp', replacement: resolve(__dirname, '../lib/src/mcp') },
      { find: '@qi/agent/llm', replacement: resolve(__dirname, '../lib/src/llm') },
      { find: '@qi/agent/agent', replacement: resolve(__dirname, '../lib/src/agent') },
      { find: '@qi/agent/utils', replacement: resolve(__dirname, '../lib/src/utils') },
      { find: '@qi/agent', replacement: resolve(__dirname, '../lib/src/index.ts') },
      { find: '@', replacement: resolve(__dirname, './src') },
      { find: '@/cli', replacement: resolve(__dirname, './src/cli') },
      { find: '@/ui', replacement: resolve(__dirname, './src/ui') },
      { find: '@/workflows', replacement: resolve(__dirname, './src/workflows') },
    ],
  },
});