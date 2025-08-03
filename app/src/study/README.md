# Classification Research Suite

Research toolkit for three-type input classification: **command/prompt/workflow**.

## Quick Start

```bash
# Compare all methods with statistical analysis
DATASET=balanced-10x3.json bun run study:comprehensive

# Individual method testing  
DATASET=balanced-10x3.json bun run study:rule-based
DATASET=balanced-10x3.json MODEL_ID=qwen3:8b bun run study:langchain-variants
DATASET=balanced-10x3.json bun run study:langchain-prompts
```

## Classification Methods (7 Total)

### Core Methods
- **rule-based** - Pattern matching (0ms, ~68% accuracy)
- **llm-direct** - Universal LLM wrapper (~3ms, ~85% accuracy)  
- **langchain-structured** - Main LangChain implementation (~3ms, ~94% accuracy)

### LangChain Variants
- **fewshot-langchain** - Few-shot learning with examples
- **chatprompt-langchain** - Chat templates with session context
- **outputparser-langchain** - Legacy model support with structured parsing
- **outputfixing-langchain** - Auto-correction with progressive retry

## Research Features

### Statistical Analysis
- **Confidence intervals** (95% Wilson score)
- **Pairwise comparisons** (McNemar's test)
- **Effect size calculations** (Cohen's g)
- **Power analysis** and sample size recommendations

### Performance Measurement
- **Real-time accuracy tracking** via schema registry
- **Latency measurement** across all methods
- **Error handling analysis** with shared error types
- **Method identification** for analytics

## Key Studies

- **`comprehensive.ts`** - Cross-method comparison with statistical testing
- **`langchain-variants.ts`** - Deep dive into 5 LangChain approaches  
- **`langchain-prompts.ts`** - Prompt engineering optimization
- **`langchain-schemas.ts`** - Schema design research
- **`statistical-analysis.ts`** - Research-grade statistical utilities

## Configuration

- **`DATASET`** - Test dataset (default: `balanced-10x3.json`)
- **`MODEL_ID`** - Ollama model for LLM methods

## Implementation Files

| Method | File | Description |
|--------|------|-------------|
| Rule-based | `rule-based.ts` | Pattern matching, no LLM |
| LLM Direct | `llm-direct.ts` | OllamaWrapper JSON prompting |
| Structured | `structured-output.ts` | Main LangChain method |
| Few-shot | `fewshot.ts` | Example-driven learning |
| Chat Prompt | `chat-prompt.ts` | Conversational templates |
| Output Parser | `output-parser.ts` | Legacy model support |
| Output Fixing | `output-fixing.ts` | Auto-correction retry |

## Research Tools

```bash
# Test function calling support
./scripts/test-function-calling.sh MODEL_NAME

# Validate statistical power
grep "Statistical Power" study-results.txt

# Performance comparison
bun run study:comprehensive | grep "Accuracy"
```