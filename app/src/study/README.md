# Classification Study

Research-based testing and analysis for three-type input classification: **command/prompt/workflow**.

## 🚀 Quick Start

```bash
# Test individual methods
DATASET=balanced-10x3.json bun run study:rule-based
DATASET=balanced-10x3.json MODEL_ID=qwen3:8b bun run study:langchain  
DATASET=balanced-10x3.json MODEL_ID=qwen3-coder:30b bun run study:llm

# Compare all methods (now includes ALL 8 classification methods!)
DATASET=balanced-10x3.json MODEL_ID=qwen3:8b bun run study:comprehensive

# LangChain deep dive (compare all 6 LangChain variants)
DATASET=balanced-10x3.json MODEL_ID=qwen3:8b bun run study:langchain-variants

# LangChain optimization
bun run study:langchain-prompts
bun run study:langchain-schemas
```

## 📊 Available Studies

### Core Classification Methods
- **`study:rule-based`** - Pattern matching (fast, no LLM)
- **`study:llm`** - Direct LLM with JSON prompting (universal)  
- **`study:langchain`** - LangChain structured output (function calling required)
- **`study:comprehensive`** - Cross-method comparison (ALL 8 methods)

### LangChain Deep Dive
- **`study:langchain-variants`** - Compare all 6 LangChain implementations
- **`study:langchain-prompts`** - Prompt engineering optimization
- **`study:langchain-schemas`** - Schema design optimization

### Methods Tested
1. **rule-based** - Pattern matching
2. **llm-direct** - OllamaWrapper  
3. **langchain-structured** - withStructuredOutput
4. **langchain-generic** - GenericLangChainClassifier
5. **langchain-few-shot** - FewShotLangChainClassifier  
6. **langchain-output-parser** - OutputParserLangChainClassifier
7. **langchain-chat-prompt** - ChatPromptTemplateLangChainClassifier
8. **langchain-fixing-parser** - OutputFixingParserLangChainClassifier

## 🔧 Configuration

- **`DATASET`** - Dataset file (default: `balanced-10x3.json`)
- **`MODEL_ID`** - Ollama model (default: from config)

## 🎯 Research Focus

**Primary investigation**: Compare all LangChain variants to find optimal approach

**Expected hierarchy**: Best LangChain variant > LLM (JSON) > Rule-based  
**Research questions**:
- Which LangChain method performs best?
- How does function calling support affect results?
- What's the accuracy vs latency trade-off?

## 📋 Key Findings

- **Rule-based**: ~68% accuracy, <1ms latency, perfect for commands
- **LLM (OllamaWrapper)**: ~85% accuracy, works with ANY model
- **LangChain variants**: Performance varies by implementation and model support
- **Function calling**: Critical for LangChain structured output methods

## 🔬 Research Tools

Test model function calling: `./scripts/test-function-calling.sh MODEL_NAME`

Compare all methods: `bun run study:comprehensive`

Deep dive LangChain: `bun run study:langchain-variants`