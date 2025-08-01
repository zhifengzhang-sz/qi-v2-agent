/**
 * LLM Module - Hybrid LangChain + multi-llm-ts integration
 *
 * Provides working Ollama structured output while maintaining
 * LangChain ecosystem compatibility
 */

export {
  createOllamaStructuredWrapper,
  type OllamaStructuredConfig,
  OllamaStructuredWrapper,
  StructuredOllamaModel,
  withStructuredOutput,
} from './OllamaStructuredWrapper.js';
