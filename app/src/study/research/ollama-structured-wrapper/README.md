# OllamaStructuredWrapper Research

This directory contains research-based evaluation of the `OllamaStructuredWrapper` classification method, focusing on determining if it truly understands input classification vs pattern matching.

## Research Questions

1. **Schema Compliance**: Does the wrapper consistently produce valid JSON matching the expected schema?
2. **Classification Accuracy**: How accurate is the classification compared to established benchmarks?
3. **Understanding vs Pattern Matching**: Does it demonstrate semantic understanding or rely on keyword matching?
4. **Edge Case Handling**: How does it perform with ambiguous, malformed, or multilingual inputs?

## Test Files

### `schema-compliance-test.ts`
- **Purpose**: Measure % of valid JSON outputs that match expected schema
- **Based on Research**: Industry standard evaluation methodology from structured output papers
- **Tests**: Diverse inputs including edge cases, multilingual, malformed inputs
- **Metrics**: JSON validity rate, schema compliance rate, error categorization

### `fp-classifier-test.ts` (moved from parent)
- **Purpose**: Original functional programming classifier test
- **Focus**: Performance and accuracy metrics

### `test-command-efficiency.ts` (moved from parent)  
- **Purpose**: Command classification efficiency analysis
- **Focus**: Latency and throughput metrics

## Research Methodology

Based on 2025 LLM evaluation research:

1. **Multi-dimensional Evaluation**: Accuracy, precision, recall, F1-score
2. **Schema Compliance Testing**: % valid JSON + schema matching
3. **Edge Case Analysis**: Malformed inputs, ambiguous cases, multilingual
4. **Comparative Analysis**: Against established benchmarks
5. **Error Categorization**: Systematic analysis of failure modes

## Usage

```bash
# Run schema compliance test
bun run src/study/research/ollama-structured-wrapper/schema-compliance-test.ts

# Run all OllamaStructuredWrapper tests
bun run study:research:ollama-wrapper
```

## Expected Results

Based on research benchmarks:
- **Production Quality**: >90% valid JSON, >95% schema compliance
- **Good Classification**: >80% accuracy on diverse inputs  
- **Robust Handling**: <5% critical errors on edge cases

## Research Insights

- Industry research shows "Getting an LLM to output valid JSON can be a difficult task"
- Common issues: inconsistent formatting, extraneous text, hallucinations
- Best practice: Test against diverse inputs with systematic error analysis
- Modern evaluation requires multi-dimensional metrics beyond simple accuracy