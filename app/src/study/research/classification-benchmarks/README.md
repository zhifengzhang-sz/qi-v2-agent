# Classification Benchmarks Research

This directory contains comparative analysis of our classification methods against established benchmarks and published results.

## Research Questions

1. **Benchmark Comparison**: How do our methods perform vs published results?
2. **Dataset Validity**: Are our custom datasets representative of real-world data?
3. **Statistical Significance**: Do our results hold up to rigorous statistical validation?
4. **Generalization**: Do methods trained on our data work on external benchmarks?

## Test Files

### `test-rule-based.ts` (moved from parent)
- **Purpose**: Rule-based classification performance analysis
- **Focus**: Pattern matching accuracy and speed

### `test-llm-based.ts` (moved from parent)
- **Purpose**: LLM-based classification evaluation  
- **Focus**: LangChain method accuracy and latency

### `test-llm-based-quiet.ts` (moved from parent)
- **Purpose**: Quiet mode LLM testing for batch processing
- **Focus**: Suppressed logging for cleaner output

## Available Benchmarks

### External Datasets (in ../../datasets/)
- **CLINC-150**: 150 intent classification categories
- **Banking77**: Banking domain intent classification
- **PersonaChat**: Conversational data for prompt classification
- **SGD**: Schema-guided dialogue for workflow detection

### Comparison Standards
Based on published research:
- **CLINC-150 Accuracy**: Published baselines 85-95%
- **Banking77 F1-Score**: Published baselines 90-96%
- **Intent Classification**: Typical accuracy 80-95%

## Usage

```bash
# Test against small balanced dataset
DATASET=balanced-10x3.json bun run src/study/research/classification-benchmarks/test-rule-based.ts

# Test against external benchmark
DATASET=clinc150_small.json bun run src/study/research/classification-benchmarks/test-llm-based.ts

# Quiet mode for batch processing
DATASET=balanced-100x3.json bun run src/study/research/classification-benchmarks/test-llm-based-quiet.ts
```

## Research Methodology

1. **Cross-Dataset Validation**: Test methods trained on our data against external benchmarks
2. **Statistical Testing**: Use cross-validation and confidence intervals
3. **Comparative Analysis**: Compare against published baselines
4. **Error Analysis**: Categorize failures by input type and complexity

## Expected Results

Based on research literature:
- **Rule-based Methods**: 60-80% accuracy on intent classification
- **LLM Methods**: 85-95% accuracy with proper prompt engineering
- **Hybrid Approaches**: 90-98% accuracy combining both methods