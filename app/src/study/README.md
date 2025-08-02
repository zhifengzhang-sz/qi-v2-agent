# Classification Study

Research-based testing and analysis for three-type input classification: **command/prompt/workflow**.

## 🚀 Quick Start

```bash
# Test individual methods
DATASET=balanced-10x3.json bun run study:rule-based
DATASET=balanced-10x3.json MODEL_ID=qwen3:8b bun run study:langchain  
DATASET=balanced-10x3.json MODEL_ID=qwen3-coder:30b bun run study:llm

# Compare all methods
DATASET=balanced-10x3.json MODEL_ID=qwen3:8b bun run study:comprehensive

# LangChain optimization
bun run study:langchain-prompts
bun run study:langchain-schemas
```

## 📊 Available Studies

- **`study:rule-based`** - Pattern matching (fast, no LLM)
- **`study:llm`** - Direct LLM with JSON prompting (universal)  
- **`study:langchain`** - LangChain structured output (function calling required)
- **`study:langchain-prompts`** - Prompt engineering optimization
- **`study:langchain-schemas`** - Schema design optimization
- **`study:comprehensive`** - Cross-method comparison

## 🔧 Configuration

- **`DATASET`** - Dataset file (default: `balanced-10x3.json`)
- **`MODEL_ID`** - Ollama model (default: from config)

## 🎯 Research Focus

**Primary investigation**: Why is LangChain performing worse than simple LLM calls?

**Expected hierarchy**: LangChain (structured) > LLM (JSON) > Rule-based  
**Current results**: Rule-based ≈ LLM > LangChain (investigating why)

## 📋 Key Findings

- **Rule-based**: ~68% accuracy, <1ms latency, perfect for commands
- **LLM (OllamaWrapper)**: ~85% accuracy, works with ANY model
- **LangChain**: Variable performance, requires function calling models

Test model function calling: `./scripts/test-function-calling.sh MODEL_NAME`