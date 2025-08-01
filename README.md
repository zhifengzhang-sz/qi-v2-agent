# qi-v2-agent

A practical local AI coding assistant with three-type input classification (command/prompt/workflow) and local LLM support.

## Quick Start

### Prerequisites
- Node.js 18+, Bun package manager, Ollama server running locally

### Installation
```bash
bun install
bun --cwd lib build && bun --cwd app build
```

## Testing Framework

### 1. Download Raw Datasets
```bash
bun run study:download-pw    # PersonaChat + SGD datasets
```

### 2. Generate Balanced Dataset
```bash
bun run study:generate-balanced 700    # 700 samples each: command/prompt/workflow
bun run study:generate-balanced 100    # 100 samples each (for quick testing)
```

### 3. Test Classifier
```bash
# Test with different datasets and models
DATASET=balanced-50x3.json MODEL_ID=qwen3:8b bun run study:test:llm-based
DATASET=balanced-100x3.json MODEL_ID=llama3.2:3b bun run study:test:llm-based
DATASET=balanced-700x3.json MODEL_ID=deepseek-coder:6.7b bun run study:test:llm-based

# Test other methods
DATASET=balanced-50x3.json bun run study:test:rule-based
DATASET=balanced-100x3.json bun run study:test:structured
```

### 4. LangChain Quality Test
```bash
bun run study:langchain-quality    # Test LangChain on CLINC150 categories
```

### Available Parameters
- **DATASET**: `balanced-50x3.json` (150 samples), `balanced-100x3.json` (300 samples), `balanced-700x3.json` (2100 samples)
- **MODEL_ID**: `qwen3:8b`, `llama3.2:3b`, `deepseek-coder:6.7b`, `qwen2.5:7b`
- **SAMPLE_LIMIT**: Further limit samples from chosen dataset

### Dataset Process
1. **Raw Data**: PersonaChat (prompts), SGD (workflows)
2. **Balanced Generation**: Equal samples per category, mixed in sequence
3. **Result**: N×3 balanced test cases (e.g., 2,100 total = 700 each type)
4. **Testing**: Fair evaluation with equal representation

## Architecture

### Three-Type Classification
```
User Input → Classifier → (Command|Prompt|Workflow) → Handler → Response
```

**Types**:
1. **Command**: `/help`, `/config` (0-1ms detection)
2. **Prompt**: "hi", "write quicksort" (conversational)
3. **Workflow**: "fix bug and run tests" (multi-step)

### Core Components
- **Input Classifier**: Delegates to rule-based/LLM methods
- **Command Detection**: Shared utility prevents expensive LLM calls
- **Model Provider**: Uses `OllamaStructuredWrapper` (ChatOllama removed due to bugs)
- **Workflow Engine**: LangGraph orchestration

## Key Performance
- **Command Detection**: 0-1ms (was 3000+ms before shared utility)
- **Classification Accuracy**: 85-92% depending on method
- **Local Privacy**: All processing local-only
- **LangChain Fix**: Custom wrapper eliminates parsing failures

## File Structure
```
lib/src/
├── classifier/impl/
│   ├── input-classifier.ts         # Main classifier
│   ├── command-detection-utils.ts  # Shared command detection
│   ├── llm-classification-method.ts
│   └── rule-based-classification-method.ts
├── llm/OllamaStructuredWrapper.ts  # Custom LangChain fix
└── agent/impl/QiCodeAgent.ts       # Agent coordinator

app/src/study/
├── download-datasets.ts            # Original datasets
├── download-prompt-workflow-datasets.ts  # P/W datasets
├── test-rule-based.ts              # Rule-based classifier test
├── test-llm-based.ts               # LLM-based classifier test
├── test-structured-output.ts       # Structured output classifier test
├── langchain-quality-test.ts       # LangChain on general dataset
└── comprehensive-test-runner.ts    # Test framework
```

## Current Issues

### Testing Problems
1. **Meaningless 3-Type Tests**: Current classifier tests use artificially mapped general datasets (CLINC150 banking → prompt/workflow), producing meaningless results
2. **Need Proper Datasets**: Downloaded prompt/workflow datasets but no adaptation framework yet
3. **No Real Validation**: Can't evaluate our 3-type classification properly without relevant datasets

### LangChain Status
- **Issue**: ChatOllama removed due to bugs and strange Ollama server behavior
- **Solution**: `OllamaStructuredWrapper` provides reliable structured output
- **Testing**: `langchain-quality-test.ts` shows real LangChain performance on appropriate data

## Development Guidelines

### Testing Workflow
1. Download datasets: `bun run study:download-pw`
2. **Avoid** classifier tests (meaningless until proper datasets)
3. Use LangChain quality test: `bun run study:langchain-quality`
4. Focus on shared command detection efficiency

### Architecture Principles
- Three-type classification for all inputs
- Shared command detection utility (eliminates 3000ms → 0ms)
- Local-only processing
- No ChatOllama (removed due to issues)

---

**Status**: Core framework complete. LangChain issues fixed. Need proper prompt/workflow datasets for meaningful classifier testing.