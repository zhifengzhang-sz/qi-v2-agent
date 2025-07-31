/**
 * LLM Module - Hybrid LangChain + multi-llm-ts integration
 * 
 * Provides working Ollama structured output while maintaining
 * LangChain ecosystem compatibility
 */

export {
  OllamaStructuredWrapper,
  StructuredOllamaModel,
  createOllamaStructuredWrapper,
  withStructuredOutput,
  type OllamaStructuredConfig
} from './OllamaStructuredWrapper.js';