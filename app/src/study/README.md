# Study Framework

Clean, functional testing for various components.

## Classification Study

```bash
# Run classification study
bun run src/study/classification.ts

# Or import and use programmatically
import { runStudy } from './classification.js';
await runStudy(config);
```

## Design

- **Two functions**: `testClassification()`, `reportResults()`
- **One statement**: FP pipeline with flatMap
- **Clean output**: Table format with summary

Replaces the overcomplicated comprehensive study framework with 100 lines of readable code.

## Example Output

```
🔬 SIMPLE STUDY RESULTS
========================

┌───┬──────────┬─────────────┬────────────────┬──────────┬────────────┬─────────┐
│   │ Model    │ Method      │ Input          │ Type     │ Confidence │ Latency │
├───┼──────────┼─────────────┼────────────────┼──────────┼────────────┼─────────┤
│ 0 │ qwen3:8b │ rule-based  │ /exit          │ command  │ 100.0%     │ 1ms     │
│ 1 │ qwen3:8b │ llm-direct  │ write algo...  │ prompt   │ 95.0%      │ 2500ms  │
└───┴──────────┴─────────────┴────────────────┴──────────┴────────────┴─────────┘

📊 SUMMARY BY METHOD
=====================

rule-based          : 100.0% success, 1ms avg
llm-direct          : 100.0% success, 2500ms avg
```