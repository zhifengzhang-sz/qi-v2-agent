# Fine-tuning Module Documentation

This directory contains documentation for the fine-tuning module (`app/src/fine-tuning/`).

## Contents

- **smollm2-plan.md** - SmolLM2-1.7B fine-tuning plan and setup

## Related Code

The corresponding implementation is in `app/src/fine-tuning/`:
- **setup_uv.py** - UV-based Python environment setup
- **generate_data.py** - Training data generation
- **train.py** - Model training script
- **pyproject.toml** - UV project configuration
- **README.md** - Fine-tuning documentation

## Key Concepts

- SmolLM2-1.7B model fine-tuning
- UV package manager for ultra-fast Python setup
- Unsloth acceleration for efficient training
- Local model training and deployment
- Classification task specialization