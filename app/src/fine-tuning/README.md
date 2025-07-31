# SmolLM2 Fine-tuning with UV

## 🚀 Quick Start

This project uses **UV** for ultra-fast Python package management and dependency resolution.

### Prerequisites
- Python 3.9+
- NVIDIA GPU with CUDA support (RTX 5070 Ti recommended)
- 16GB+ VRAM for optimal training

### Setup and Training

```bash
# 1. Setup UV environment and dependencies
npm run finetune:setup

# 2. Generate training data (1000+ examples)  
npm run finetune:generate-data

# 3. Fine-tune SmolLM2-1.7B model
npm run finetune:train

# 4. Sync dependencies if needed
npm run finetune:sync
```

## 🔧 UV Commands

### Environment Management
```bash
cd src/fine-tuning

# Sync project dependencies
uv sync

# Add new dependency
uv add torch>=2.1.0

# Remove dependency  
uv remove old-package

# List installed packages
uv pip list

# Show dependency tree
uv pip show transformers
```

### Running Scripts
```bash
# Run any Python script in UV environment
uv run generate_data.py
uv run train.py
uv run evaluate.py

# Run with specific Python version
uv run --python 3.11 train.py

# Run with environment variables
UV_INDEX_URL=https://pypi.org/simple uv run train.py
```

## 📦 Project Structure

```
fine-tuning/
├── pyproject.toml          # UV project configuration
├── setup_uv.py            # UV-optimized environment setup
├── generate_data.py        # Training data generation  
├── train.py               # SmolLM2 fine-tuning script
├── config.yaml            # Training configuration
├── data/                  # Generated training datasets
├── outputs/               # Trained models and checkpoints
├── logs/                  # Training logs and tensorboard
└── README.md              # This file
```

## ⚙️ Configuration

### pyproject.toml
Modern Python project configuration with:
- **Core ML dependencies**: PyTorch, Transformers, Unsloth
- **Training frameworks**: TRL, PEFT, Accelerate  
- **Development tools**: Black, isort, mypy
- **Optional CUDA versions**: Support for different CUDA versions

### Key Dependencies
```toml
dependencies = [
    "torch>=2.0.1",           # PyTorch with CUDA
    "transformers>=4.36.0",   # HuggingFace models
    "unsloth[cu118]>=2024.1", # 2x faster fine-tuning
    "trl>=0.7.4",             # Reinforcement Learning from Human Feedback
    "peft>=0.7.1",            # Parameter Efficient Fine-Tuning
    "datasets>=2.16.0",       # Data loading and processing
]
```

## 🎯 Training Configuration

Optimized for **RTX 5070 Ti (16GB VRAM)**:

```yaml
training_args:
  per_device_train_batch_size: 4      # Max for 16GB VRAM
  gradient_accumulation_steps: 8      # Effective batch size: 32
  learning_rate: 2.0e-4               # Stable learning rate
  num_train_epochs: 3                 # Prevent overfitting
  bf16: true                          # Memory efficient precision
  optim: "adamw_8bit"                 # Memory-efficient optimizer
```

## 🔍 Troubleshooting

### UV Installation Issues
```bash
# Manual UV installation
curl -LsSf https://astral.sh/uv/install.sh | sh

# Or via pip
pip install uv

# Verify installation
uv --version
```

### CUDA Issues
```bash
# Check CUDA availability
uv run python -c "import torch; print(torch.cuda.is_available())"

# Check GPU memory
uv run python -c "import torch; print(f'Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f}GB')"
```

### Memory Issues
If you encounter CUDA out of memory:
1. Reduce `per_device_train_batch_size` to 2 or 1
2. Increase `gradient_accumulation_steps` accordingly
3. Enable gradient checkpointing in config

### Dependency Conflicts
```bash
# Update all dependencies
uv sync --upgrade

# Reinstall specific package
uv pip uninstall transformers
uv add transformers>=4.36.0

# Clear UV cache
uv cache clean
```

## 📊 Performance Expectations

### Training Performance (RTX 5070 Ti)
- **Training Time**: 2-4 hours for 3 epochs
- **Memory Usage**: ~12GB VRAM during training
- **Speed**: 2x faster with Unsloth optimization
- **Target Accuracy**: >95% (vs 83.3% rule-based baseline)

### UV Performance Benefits
- **Installation Speed**: 10-100x faster than pip
- **Dependency Resolution**: Faster conflict resolution
- **Reproducible Builds**: Lock files for exact dependencies
- **Cross-platform**: Consistent across Linux/macOS/Windows

## 🔗 Integration with CLI

After training, the model integrates with the TypeScript CLI:

```typescript
// CLI calls fine-tuned model via Ollama
class MLEnhancedParser implements IParser {
  private ollamaModel = 'smollm2-classification:latest'
  
  async classifyInput(input: string): Promise<AdvancedParseResult> {
    // HTTP call to local Ollama server running fine-tuned model
    const response = await ollama.generate({
      model: this.ollamaModel,
      prompt: `Classify this input: ${input}`,
    })
    
    return this.parseClassification(response)
  }
}
```

## 🎉 Why UV?

### Speed
- **10-100x faster** package installation vs pip
- **Parallel downloads** and dependency resolution
- **Zero-copy installs** when possible

### Reliability  
- **Deterministic builds** with lock files
- **Dependency conflict resolution** 
- **Cross-platform consistency**

### Modern Python
- **pyproject.toml** standard configuration
- **Virtual environment management**
- **Tool integration** (black, mypy, etc.)

Perfect for ML projects that need fast, reliable dependency management! 🚀