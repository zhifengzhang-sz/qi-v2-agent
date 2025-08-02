import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  external: [
    // Mark qicore dependencies as external - don't bundle them
    '@qi',
    '@qi/base',
    '@qi/core',
    // Other external dependencies that should not be bundled
    '@langchain/core',
    '@langchain/anthropic',
    '@langchain/cohere',
    '@langchain/google-genai',
    '@langchain/groq',
    '@langchain/langgraph',
    '@langchain/openai',
    '@modelcontextprotocol/sdk',
    'ollama',
    'react'
  ],
  target: 'es2022',
  splitting: false,
  sourcemap: true,
  minify: false,
});