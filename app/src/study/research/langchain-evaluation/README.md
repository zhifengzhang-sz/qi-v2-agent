# LangChain Evaluation Research

This directory contains research into why LangChain's `withStructuredOutput` fails with Ollama and exploration of alternative approaches.

## Research Questions

1. **Root Cause Analysis**: Why does `withStructuredOutput` fail with Ollama?
2. **Function Calling Support**: Which Ollama models support structured output?
3. **Alternative Providers**: Can we test LangChain with free providers?
4. **API Compatibility**: OpenAI endpoint vs ChatOllama differences?

## Test Files

### `debug-langchain.ts` (moved from parent)
- **Purpose**: Debug LangChain integration issues
- **Focus**: Error analysis and API compatibility testing

## Research Findings

Based on web research conducted:

### Known Issues
- **LangChain withStructuredOutput**: Does not support Ollama natively
- **Function Calling**: Most Ollama models lack function calling support
- **API Compatibility**: OpenAI-compatible endpoint has limitations
- **Error Pattern**: "promptValue.toChatMessages is not a function"

### Alternative Approaches

1. **Use ChatOllama directly**: Native Ollama integration (but limited structured output)
2. **Free API Providers**: Groq, Together AI, HuggingFace for proper LangChain testing
3. **JSON Schema Prompting**: Manual structured output with JSON schemas
4. **Working Wrapper**: OllamaStructuredWrapper approach (current solution)

## Research Plan

1. **Test with Free Providers**: Validate LangChain withStructuredOutput works properly
2. **Model Capability Analysis**: Identify which models support function calling
3. **API Endpoint Testing**: Compare ChatOllama vs OpenAI-compatible endpoints
4. **Alternative Implementation**: Research other structured output approaches

## Usage

```bash
# Debug LangChain issues
bun run src/study/research/langchain-evaluation/debug-langchain.ts

# Test with different configurations
MODEL_ID=llama3.3:3b bun run src/study/research/langchain-evaluation/debug-langchain.ts
```

## Expected Outcomes

- **Confirm**: LangChain withStructuredOutput works with proper providers
- **Identify**: Specific limitations with Ollama integration  
- **Validate**: Alternative approaches for local LLM structured output
- **Document**: Best practices for LangChain + local LLM integration