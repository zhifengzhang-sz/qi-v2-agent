# Classifier Module Documentation

This directory contains documentation for the classifier module (`app/src/classifier/`).

## Contents

- **classifier-design.md** - High-level design and requirements
- **classifier-design-impl.md** - Implementation design details  
- **classifier-impl.md** - Implementation notes and patterns
- **classification/** - Classification system documentation
  - **three-type-system.md** - Three-type classification system (command/prompt/workflow)
  - **current-performance.md** - Performance metrics and benchmarks

## Related Code

The corresponding implementation is in `app/src/classifier/`:
- `interfaces/` - TypeScript interfaces and types
- `impl/` - Concrete implementations (BasicClassifier, ClassifierManager, etc.)
- `index.ts` - Module exports

## Key Concepts

- Three-type input classification system
- Rule-based and ML-based classification approaches
- Extensible classifier architecture
- Performance monitoring and metrics