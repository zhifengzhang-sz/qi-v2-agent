# Classification Study Framework

Research-based testing and analysis for three-type input classification: **command/prompt/workflow**.

## 🏗️ Structure

```
study/
├── data-ops/              # Dataset operations and preparation
├── research/              # Classifier research by type
│   ├── classification-benchmarks/  # Comparative analysis
│   ├── ollama-structured-wrapper/  # OllamaWrapper method
│   └── langchain-evaluation/       # LangChain method analysis
├── datasets/              # Test datasets
├── comprehensive-test-runner.ts    # Main orchestrator
└── results.md            # Research findings
```

## 🚀 Quick Start

### **Test Specific Classifiers**

```bash
# Rule-based classifier (fast, no LLM needed)
DATASET=balanced-10x3.json bun run study:rule-based-classifier

# LangChain classifier (requires function calling models)
DATASET=balanced-10x3.json MODEL_ID=qwen3:8b bun run study:langchain-classifier

# OllamaWrapper classifier (works with any model)  
DATASET=balanced-10x3.json MODEL_ID=qwen2.5-coder:7b bun run study:ollama-wrapper-classifier

# Quiet mode (suppresses Ollama logs)
DATASET=balanced-10x3.json MODEL_ID=qwen3:8b bun run study:langchain-classifier-quiet
```

### **Research Analysis**

```bash
# Schema compliance testing
bun run study:ollama-wrapper-schema

# LangChain debugging
bun run study:langchain-debugging

# Comprehensive comparison
DATASET=balanced-100x3.json bun run study:test
```

## 🧪 **Classifier Types**

### **1. Rule-Based Classifier**
- **File**: `research/classification-benchmarks/rule-based-classifier.ts`
- **Method**: Pattern matching with keyword detection
- **Speed**: ~1ms per classification
- **Accuracy**: ~68% overall, 100% for commands
- **Dependencies**: None (no LLM required)

### **2. LangChain Classifier** 
- **File**: `research/classification-benchmarks/langchain-classifier.ts`
- **Method**: LangChain `withStructuredOutput` + function calling
- **Speed**: ~400ms per classification
- **Accuracy**: ~94% with function calling models
- **Dependencies**: Models with function calling support
- **⚠️ Requirement**: Only works with `qwen3`, `llama3.2+`, newer models

### **3. OllamaWrapper Classifier**
- **File**: `research/ollama-structured-wrapper/ollama-wrapper-classifier.ts`
- **Method**: Custom JSON prompting with OllamaStructuredWrapper
- **Speed**: ~350ms per classification  
- **Accuracy**: ~83% with any model
- **Dependencies**: Any Ollama model
- **✅ Universal**: Works with ALL models

## 📊 **Available Datasets**

Located in `datasets/`:

```bash
# Quick testing (30 samples)
DATASET=balanced-10x3.json

# Standard evaluation (300 samples) 
DATASET=balanced-100x3.json

# Comprehensive analysis (2100 samples)
DATASET=balanced-700x3.json

# External benchmarks
DATASET=clinc150_full.json      # Intent classification benchmark
DATASET=banking_intent.csv      # Banking domain classification
```

## 🎯 **Model Compatibility**

### **Function Calling Models** (LangChain works):
- ✅ `qwen3:8b`, `qwen3:14b`, `qwen3:30b-a3b`
- ✅ `llama3.2:3b`, `llama3.3:70b`
- ✅ `kirito1/qwen3-coder:4b`

### **Non-Function Calling Models** (LangChain fails):
- ❌ `qwen2.5-coder:7b`, `qwen2.5-coder:14b`, `qwen2.5-coder:32b`
- ❌ `SmolLM2:1.7B`, `deepseek-r1:7b`

### **Universal Models** (OllamaWrapper works):
- ✅ **ALL models** - no function calling requirement

## 🔬 **Research Findings**

### **Root Cause Discovery**
**LangChain's `withStructuredOutput` requires function calling support**:
- Models WITH function calling: Returns real structured JSON
- Models WITHOUT function calling: Returns `undefined` → fallback to fake results

### **Performance Comparison**
| Classifier | Speed | Accuracy | Model Support | Use Case |
|------------|-------|----------|---------------|----------|
| Rule-Based | ~1ms | 68% | All | Development/Commands |
| LangChain | ~400ms | 94% | Function calling only | Production (new models) |
| OllamaWrapper | ~350ms | 83% | All | Production (any model) |

### **Recommendations**
- **Development**: Use Rule-Based (instant feedback)
- **Production (new models)**: Use LangChain (highest accuracy)
- **Production (any model)**: Use OllamaWrapper (universal compatibility)

## 📋 **Commands Reference**

```bash
# Data Operations
bun run study:download              # Download external datasets
bun run study:adapt                 # Convert to three-type format
bun run study:generate-balanced     # Create balanced test sets

# Classifier Testing
bun run study:rule-based-classifier           # Rule-based method
bun run study:langchain-classifier            # LangChain method  
bun run study:langchain-classifier-quiet      # LangChain (quiet)
bun run study:ollama-wrapper-classifier       # OllamaWrapper method

# Research Analysis
bun run study:ollama-wrapper-schema           # Schema compliance test
bun run study:langchain-debugging             # LangChain debugging
bun run study:test                            # Comprehensive comparison
```

## ⚙️ **Configuration**

### **Environment Variables**
```bash
DATASET=balanced-10x3.json         # Dataset selection
MODEL_ID=qwen3:8b                  # Model selection
SAMPLE_LIMIT=100                   # Limit samples for testing
```

### **Model Selection Guidelines**
- **For LangChain**: Use `qwen3:8b`, `llama3.2:3b`, or newer models
- **For OllamaWrapper**: Any model works (`qwen2.5-coder:7b`, etc.)
- **For Rule-Based**: No model needed

## 🧠 **Technical Insights**

### **LangChain Connection Method**
- Uses `ChatOpenAI` class (NOT `ChatOllama`)
- Connects via Ollama's OpenAI-compatible endpoint: `/v1`
- Requires Zod schema for structured output validation
- Function calling translated to OpenAI function calling protocol

### **OllamaWrapper Advantages**
- Direct Ollama API calls (no OpenAI compatibility layer)
- JSON schema prompting (no function calling needed)
- Works with ANY model (even old/small ones)
- Robust error handling and fallback mechanisms

---

**Research Status**: ✅ **Complete** - Root cause identified, all methods working, comprehensive comparison available.

**Key Discovery**: LangChain's function calling requirement explains compatibility issues. OllamaWrapper provides universal solution.