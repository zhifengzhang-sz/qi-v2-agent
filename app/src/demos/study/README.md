# Research Studies

This directory contains comprehensive research studies for key components of the qi-v2-agent system.

## Studies Available

### 1. Classifier Study (`classifier-study.ts`)

**Purpose**: Comprehensive analysis of input classification performance across different models and configurations.

**Test Coverage**:
- **17 test cases** covering commands, prompts, and workflows
- **5 models**: qwen2.5-coder:7b, qwen2.5-coder:14b, qwen3:14b, qwen3:30b-a3b, llama3.2:3b
- **Categories**: system commands, greetings, questions, code generation, bug fixes, feature development, etc.

**Metrics Analyzed**:
- Classification accuracy (%)
- Average latency (ms)
- Average confidence scores
- Success rates by input type
- Error patterns and failure modes

**Key Research Questions**:
- Which models provide the best speed vs accuracy tradeoff?
- How do different models handle ambiguous inputs?
- What are the optimal confidence thresholds?
- Which model is most reliable for production use?

### 2. Workflow Extractor Study (`workflow-extractor-study.ts`)

**Purpose**: Detailed analysis of workflow extraction quality, validation success, and complexity handling across models.

**Test Coverage**:
- **15 test cases** ranging from simple to complex workflows
- **5 models**: qwen2.5-coder:7b, qwen2.5-coder:14b, qwen3:14b, qwen3:30b-a3b, llama3.2:3b
- **Complexity levels**: simple (2-5 nodes), moderate (3-8 nodes), complex (5-18 nodes)
- **Categories**: bug fixes, testing, deployment, feature development, devops, architecture

**Metrics Analyzed**:
- Workflow generation success rate (%)
- Validation success rate (%)
- Average latency (ms)
- Average workflow size (nodes/edges)
- Mode detection accuracy
- Complexity handling capability

**Key Research Questions**:
- Which models generate the most valid and useful workflows?
- How do models handle increasing workflow complexity?
- What are the optimal workflow size ranges?
- Which model provides the best structured output quality?

## Running the Studies

### Prerequisites
```bash
# Ensure all models are available in Ollama
ollama list

# Pull missing models if needed
ollama pull qwen3:30b-a3b
ollama pull qwen2.5-coder:14b
# etc.
```

### Execute Studies

**Classifier Study**:
```bash
# Default benchmark model (qwen2.5-coder:7b)
bun src/demos/study/classifier-study.ts

# Test specific model
bun src/demos/study/classifier-study.ts qwen3:30b-a3b

# Compare multiple models
bun src/demos/study/classifier-study.ts qwen2.5-coder:7b qwen3:14b llama3.2:3b
```

**Workflow Extractor Study**:
```bash
# Default benchmark model (qwen2.5-coder:7b)
bun src/demos/study/workflow-extractor-study.ts

# Test specific model
bun src/demos/study/workflow-extractor-study.ts qwen3:30b-a3b

# Compare multiple models
bun src/demos/study/workflow-extractor-study.ts qwen2.5-coder:14b qwen3:14b
```

## Expected Output

### Classifier Study Results
Clean table format showing:
```
📊 CLASSIFIER RESULTS
──────────────────────────────────────────────────────────────────────────────────────────
Model                    Accuracy    Latency     Confidence  Success     Errors         
──────────────────────────────────────────────────────────────────────────────────────────
qwen3:30b-a3b           95.2%       1200ms      0.92        17/18       0              
qwen2.5-coder:7b        88.9%       850ms       0.85        16/18       0              
──────────────────────────────────────────────────────────────────────────────────────────
🏆 Best: qwen3:30b-a3b (95.2% accuracy, 1200ms latency)
```

### Workflow Extractor Study Results  
Clean table format showing:
```
📊 WORKFLOW EXTRACTOR RESULTS
──────────────────────────────────────────────────────────────────────────────────────────
Model                    Success%   Valid%     Latency     Confidence  Nodes      Errors         
──────────────────────────────────────────────────────────────────────────────────────────
qwen3:30b-a3b           93.3%      86.7%      2100ms      0.91        6.2        0              
qwen2.5-coder:7b        80.0%      73.3%      1800ms      0.88        5.4        1              
──────────────────────────────────────────────────────────────────────────────────────────
🏆 Best: qwen3:30b-a3b (93.3% success, 2100ms latency, 6.2 avg nodes)
```

## Research Applications

**Model Selection**: Choose optimal models for different deployment scenarios
**Configuration Tuning**: Optimize confidence thresholds and parameters
**Performance Optimization**: Identify bottlenecks and improvement opportunities
**Quality Assurance**: Establish baseline performance metrics for regression testing

## Study Design Principles

1. **Comprehensive Coverage**: Test cases span the full range of expected inputs
2. **Practical Relevance**: All test cases represent real-world usage scenarios  
3. **Measurable Metrics**: Quantitative analysis enables objective comparisons
4. **Error Analysis**: Detailed failure mode analysis for improvement insights
5. **Production Focus**: Results directly applicable to deployment decisions

## Contributing

To add new test cases or models:

1. **Extend Test Cases**: Add relevant examples to the test case arrays
2. **Add Models**: Include new model names in the models arrays
3. **Update Metrics**: Add new analysis dimensions as needed
4. **Document Findings**: Update this README with key insights

## Notes

- Studies require significant computational resources (especially 30b+ models)
- Run studies during off-peak hours for system resources
- Results may vary based on hardware and Ollama configuration
- Consider timeouts for very large models that may hang

---

**Research Goal**: Establish data-driven foundations for optimal qi-v2-agent configuration and deployment.