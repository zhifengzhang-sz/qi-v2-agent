# Data Operations

This directory contains tools for downloading, adapting, and generating datasets for classification research.

## Files

### `download-datasets.ts` (moved from parent)
- **Purpose**: Download external classification datasets
- **Sources**: CLINC-150, Banking77, PersonaChat, SGD
- **Output**: Raw datasets in `../datasets/`

### `download-prompt-workflow-datasets.ts` (moved from parent)  
- **Purpose**: Download specific prompt/workflow datasets
- **Sources**: Conversational AI datasets
- **Output**: Specialized datasets for prompt/workflow classification

### `adapt-datasets.ts` (moved from parent)
- **Purpose**: Convert external datasets to our three-type format
- **Input**: Raw datasets from downloads
- **Output**: Adapted datasets in `../datasets/`

### `adapt-prompt-workflow-datasets.ts` (moved from parent)
- **Purpose**: Specialized adaptation for prompt/workflow data
- **Input**: Conversational datasets
- **Output**: Command/prompt/workflow formatted data

### `generate-balanced-dataset.ts` (moved from parent)
- **Purpose**: Create balanced test datasets
- **Input**: Adapted datasets
- **Output**: Balanced datasets (10x3, 50x3, 100x3, 700x3)

## Usage

```bash
# Download all external datasets
bun run src/study/data-ops/download-datasets.ts

# Download specialized datasets
bun run src/study/data-ops/download-prompt-workflow-datasets.ts

# Adapt datasets to our format
bun run src/study/data-ops/adapt-datasets.ts
bun run src/study/data-ops/adapt-prompt-workflow-datasets.ts

# Generate balanced test sets
bun run src/study/data-ops/generate-balanced-dataset.ts
```

## Data Pipeline

```
External Sources → Download → Adapt → Generate Balanced → Research Tests
     ↓               ↓         ↓           ↓              ↓
  CLINC-150      Raw CSVs   Three-type   balanced-*    Test Results
  Banking77      Raw JSON   Format       datasets      
  PersonaChat                            
  SGD                                    
```

## Output Datasets

Generated in `../datasets/`:
- **Raw downloads**: Original format from sources
- **Adapted datasets**: Converted to command/prompt/workflow format
- **Balanced datasets**: Equal samples per category for testing