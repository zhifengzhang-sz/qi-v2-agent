# qi-v2-agent Version History

## v0.3.2 - Classifier Performance Study Framework

**Release Date**: August 3, 2025

### Features
- **Simple Study Framework**: Clean FP-style classification testing (`app/src/study/classification.ts`)
- **7 Classification Methods**: rule-based, llm-direct, langchain-structured, and 4 langchain variants
- **Performance Analysis**: Real-time accuracy, confidence, and latency measurement
- **Clean Architecture**: Interface layer (InputClassifier) with proper QiCore internal patterns

### Performance Findings
- **rule-based**: 100% command detection, 50% workflow detection, 0ms latency
- **llm-direct**: Universal model compatibility, ~50ms latency
- **langchain-structured**: Function calling models, ~50ms latency
- **4 langchain variants**: Implementation/configuration issues identified

### Study Framework
- Replaced overcomplicated comprehensive study with 100-line functional approach
- Two functions + one FP pipeline statement
- Clear tabular output with method summaries

---

## v0.3.1 - Study Directory Cleanup & QiCore Compliance

**Release Date**: August 2, 2025

- Fixed aliasing violations in study framework
- QiCore Result<T> patterns in rule-based classifier
- Proper interface/internal layer separation
- Exception boundaries with fromAsyncTryCatch()

---

## v0.3.0 - CLI + Agent with Command, Prompt & Context Continuation

**Release Date**: July 31, 2025

- Three-type input classification (command/prompt/workflow)
- Context continuation system with LangChain templates
- Multi-provider LLM support via multi-llm-ts
- Local-first privacy with Ollama integration

---

## Earlier Versions

See git history for versions 0.1.x through 0.2.x focusing on:
- Initial project setup and architecture design
- Component interface definitions  
- Technology evaluation and proof-of-concepts
- Foundation layer implementation