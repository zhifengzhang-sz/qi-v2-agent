# CLI System Documentation

This directory contains comprehensive documentation for the qi-v2-agent CLI system, organized by module to match the source code structure in `app/src/`.

## 📁 Documentation Structure

### Module Documentation
- **[classifier/](classifier/)** - Input classification system (command/prompt/workflow)
- **[prompt/](prompt/)** - LLM integration and prompt processing
- **[cli/](cli/)** - Terminal interface implementations (Ink, neo-blessed)
- **[workflow/](workflow/)** - Workflow extraction and execution system
- **[fine-tuning/](fine-tuning/)** - SmolLM2 model fine-tuning
- **[demos/](demos/)** - Demo applications and examples

### Cross-Module Documentation
- **[architecture/](architecture/)** - System-wide architecture decisions and design principles

## 🎯 Key Achievements

### Current Implementation Status
- ✅ **Complete CLI Framework**: Dual implementation (Ink + Neo-blessed) with XState 5
- ✅ **Advanced Classification**: Sophisticated rule-based parser with 83.3% accuracy
- ✅ **Professional Architecture**: Technology-agnostic abstractions with concrete implementations
- ✅ **Production Features**: Command system, state management, LLM integration
- ✅ **Comprehensive Testing**: Multiple demo applications and test suites

### Next Phase: SmolLM2 Fine-tuning
- 🎯 **Target Accuracy**: >95% three-type classification (vs current 83.3%)
- 🚀 **Model Choice**: SmolLM2-1.7B optimized for local fine-tuning
- 💻 **Hardware Optimized**: RTX 5070 Ti (16GB) + 128GB RAM configuration
- ⚡ **Fast Training**: Unsloth framework for 2x speed improvement

## 🔍 Module Overview

### [Classifier Module](classifier/)
Three-type input classification system that categorizes user input as:
- **Commands**: System functions with `/` prefix (e.g., `/help`, `/config`)
- **Prompts**: Simple conversational inputs (e.g., "hi", "write a quicksort in haskell")
- **Workflows**: Complex multi-step tasks (e.g., "fix bug in src/file.ts and run tests")

### [Prompt Module](prompt/)
LLM integration layer providing:
- Multi-provider support via `multi-llm-ts`
- Template rendering and configuration management
- Local model support (Ollama integration)
- Streaming response handling

### [CLI Module](cli/)
Terminal interface implementations featuring:
- **Ink Framework**: React-based terminal UI with JSX components
- **neo-blessed**: Traditional terminal UI with widgets and forms
- **XState 5**: Hierarchical state machines for UI state management
- Pluggable architecture supporting multiple frameworks

### [Workflow Module](workflow/)
Multi-step workflow processing system:
- **Workflow Extraction**: Convert natural language to executable workflows
- **LangChain Integration**: Structured output with Zod schema validation
- **Pattern Recognition**: Analytical, creative, problem-solving, informational modes
- **Streaming Execution**: Real-time workflow progress updates
- **CLI Integration**: Enhanced parser with workflow detection

### [Fine-tuning Module](fine-tuning/)
Local model enhancement system:
- SmolLM2-1.7B model fine-tuning for classification improvement
- UV package manager for ultra-fast Python environment setup
- Unsloth acceleration for efficient training
- Hardware-optimized training configurations

## 🛠️ Development Guidelines

### Architecture Principles
1. **Technology Agnostic**: Abstract interfaces separate from concrete implementations
2. **State-Driven Design**: XState 5 manages complex UI state transitions
3. **Extensible Command System**: Easy registration of new commands and handlers
4. **Performance First**: Local processing, sub-100ms response times
5. **Production Ready**: Error handling, logging, monitoring capabilities

### Module Organization
- Each module has its own directory with `src/`, `docs/`, and related files
- Documentation is co-located with the relevant module
- Cross-cutting concerns are documented in shared directories

## 📊 Performance Metrics

### Current Baseline (Rule-based)
- **Overall Accuracy**: 83.3% on comprehensive test suite
- **Command Detection**: 100% accuracy (rule-based)
- **Prompt Classification**: 95% accuracy on simple cases
- **Workflow Detection**: 80% accuracy on complex cases

### Target Performance (SmolLM2 Fine-tuned)
- **Overall Accuracy**: >95% target
- **Inference Speed**: <100ms per classification
- **Memory Usage**: <12GB VRAM during inference
- **Training Time**: 2-4 hours on target hardware

## 🚀 Getting Started

1. **Understanding the System**: Start with module documentation in each directory
2. **Running Demos**: See `app/src/demos/` for working examples
3. **Testing Classification**: Use the various demo applications
4. **Fine-tuning Setup**: Follow the fine-tuning module documentation

## 📈 Roadmap

- **Phase 1**: ✅ Documentation and current system analysis
- **Phase 2**: 🏗️ SmolLM2 fine-tuning environment setup
- **Phase 3**: 📊 Training data generation and model training
- **Phase 4**: 🔗 Integration and performance validation
- **Phase 5**: 🚀 Production deployment and monitoring

---

**Last Updated**: 2025-01-30  
**Status**: Documentation Reorganized by Module, Implementation In Progress