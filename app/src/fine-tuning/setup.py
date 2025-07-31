#!/usr/bin/env python3
"""
SmolLM2-1.7B Fine-tuning Environment Setup

Optimized for RTX 5070 Ti (16GB VRAM) + i9 + 128GB RAM
"""

import subprocess
import sys
import torch
import os
from pathlib import Path

def check_system_requirements():
    """Verify system meets requirements for fine-tuning"""
    print("🔍 Checking system requirements...")
    
    # Check CUDA availability
    if not torch.cuda.is_available():
        print("❌ CUDA not available. GPU required for fine-tuning.")
        return False
    
    # Check GPU memory
    gpu_memory = torch.cuda.get_device_properties(0).total_memory / 1e9
    print(f"🔧 GPU: {torch.cuda.get_device_name(0)}")
    print(f"💾 GPU Memory: {gpu_memory:.1f}GB")
    
    if gpu_memory < 14:
        print("⚠️  Warning: Less than 14GB VRAM. Training may require reduced batch size.")
    else:
        print("✅ GPU memory sufficient for fine-tuning")
    
    # Check system memory
    try:
        with open('/proc/meminfo', 'r') as f:
            meminfo = f.read()
        mem_total = int([line for line in meminfo.split('\n') if 'MemTotal' in line][0].split()[1]) / 1024**2
        print(f"🖥️  System Memory: {mem_total:.1f}GB")
        
        if mem_total < 32:
            print("⚠️  Warning: Less than 32GB RAM. May limit dataset size.")
        else:
            print("✅ System memory sufficient")
    except:
        print("⚠️  Could not check system memory")
    
    return True

def install_dependencies():
    """Install optimized dependencies for SmolLM2 fine-tuning"""
    print("\n📦 Installing fine-tuning dependencies...")
    
    dependencies = [
        # Core fine-tuning libraries
        "unsloth[cu118]",
        "torch==2.0.1",
        "torchvision", 
        "torchaudio",
        "--index-url https://download.pytorch.org/whl/cu118",
        
        # Training and model libraries
        "transformers==4.36.0",
        "datasets==2.16.0", 
        "trl==0.7.4",
        "peft==0.7.1",
        "accelerate==0.24.1",
        
        # Monitoring and utilities
        "tensorboard",
        "wandb",
        "scipy",
        "scikit-learn",
        
        # Data processing
        "pandas",
        "numpy", 
        "jsonlines"
    ]
    
    for dep in dependencies:
        if dep.startswith("--"):
            continue
        try:
            print(f"Installing {dep}...")
            subprocess.check_call([sys.executable, "-m", "pip", "install", dep])
        except subprocess.CalledProcessError as e:
            print(f"❌ Failed to install {dep}: {e}")
            return False
    
    print("✅ Dependencies installed successfully")
    return True

def setup_directories():
    """Create necessary directories for fine-tuning"""
    print("\n📁 Setting up directories...")
    
    directories = [
        "fine-tuning/data",
        "fine-tuning/models", 
        "fine-tuning/logs",
        "fine-tuning/checkpoints",
        "fine-tuning/outputs"
    ]
    
    base_path = Path(__file__).parent.parent
    
    for dir_path in directories:
        full_path = base_path / dir_path
        full_path.mkdir(parents=True, exist_ok=True)
        print(f"✅ Created {full_path}")
    
    return True

def verify_unsloth():
    """Verify Unsloth installation and GPU compatibility"""
    print("\n🚀 Verifying Unsloth installation...")
    
    try:
        from unsloth import FastLanguageModel
        print("✅ Unsloth imported successfully")
        
        # Test model loading (lightweight test)
        print("🧪 Testing model loading...")
        model, tokenizer = FastLanguageModel.from_pretrained(
            model_name="unsloth/tinyllama-bnb-4bit",  # Small test model
            max_seq_length=128,
            dtype=None,
            load_in_4bit=True,
        )
        print("✅ Model loading test successful")
        
        # Clean up test model
        del model, tokenizer
        torch.cuda.empty_cache()
        
        return True
        
    except Exception as e:
        print(f"❌ Unsloth verification failed: {e}")
        return False

def create_training_config():
    """Create optimized training configuration file"""
    print("\n⚙️  Creating training configuration...")
    
    config = """# SmolLM2-1.7B Fine-tuning Configuration
# Optimized for RTX 5070 Ti (16GB VRAM)

model_config:
  model_name: "HuggingFaceTB/SmolLM2-1.7B-Instruct"
  max_seq_length: 512
  load_in_4bit: true
  bnb_4bit_compute_dtype: "bfloat16"
  bnb_4bit_use_double_quant: true

lora_config:
  r: 16                    # LoRA rank - balanced performance/memory
  alpha: 32                # LoRA alpha - stable training  
  target_modules: "all-linear"
  dropout: 0.1
  bias: "none"

training_args:
  per_device_train_batch_size: 4      # Max for 16GB VRAM
  gradient_accumulation_steps: 8      # Effective batch size: 32
  learning_rate: 2.0e-4               # Stable learning rate
  num_train_epochs: 3                 # Prevent overfitting
  warmup_steps: 100                   # Smooth training start
  max_grad_norm: 1.0                  # Gradient clipping
  dataloader_num_workers: 8           # i9 multi-core utilization
  fp16: false                         # Use bfloat16 instead
  bf16: true                          # Better stability
  optim: "adamw_8bit"                 # Memory-efficient optimizer
  weight_decay: 0.01
  lr_scheduler_type: "cosine"
  logging_steps: 10
  save_steps: 500
  evaluation_strategy: "steps"
  eval_steps: 250
  save_total_limit: 3
  load_best_model_at_end: true
  metric_for_best_model: "eval_accuracy"
  greater_is_better: true
  report_to: "tensorboard"

data_config:
  train_file: "fine-tuning/data/classification_train.jsonl"
  val_file: "fine-tuning/data/classification_val.jsonl"
  dataset_text_field: "text"
  
output_config:
  output_dir: "fine-tuning/outputs/smollm2-classification"
  logging_dir: "fine-tuning/logs"
  checkpoint_dir: "fine-tuning/checkpoints"
"""
    
    config_path = Path(__file__).parent / "config.yaml"
    with open(config_path, 'w') as f:
        f.write(config)
    
    print(f"✅ Configuration saved to {config_path}")
    return True

def main():
    """Main setup function"""
    print("🚀 SmolLM2-1.7B Fine-tuning Environment Setup")
    print("=" * 50)
    
    # Check system requirements
    if not check_system_requirements():
        print("❌ System requirements not met")
        return False
    
    # Install dependencies  
    if not install_dependencies():
        print("❌ Dependency installation failed")
        return False
    
    # Setup directories
    if not setup_directories():
        print("❌ Directory setup failed")
        return False
    
    # Verify Unsloth
    if not verify_unsloth():
        print("❌ Unsloth verification failed")
        return False
    
    # Create training config
    if not create_training_config():
        print("❌ Configuration creation failed")
        return False
    
    print("\n🎉 Setup completed successfully!")
    print("\nNext steps:")
    print("1. Generate training data: python fine-tuning/generate_data.py")
    print("2. Start fine-tuning: python fine-tuning/train.py")
    print("3. Evaluate model: python fine-tuning/evaluate.py")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)