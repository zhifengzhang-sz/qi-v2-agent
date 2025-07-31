#!/usr/bin/env python3
"""
SmolLM2-1.7B Fine-tuning Environment Setup with UV

Optimized for RTX 5070 Ti (16GB VRAM) + i9 + 128GB RAM
Uses UV for ultra-fast Python package management
"""

import subprocess
import sys
import os
import shutil
from pathlib import Path

def check_uv_installation():
    """Check if UV is installed and install if needed"""
    print("🔍 Checking UV installation...")
    
    # Check if uv is available
    if shutil.which("uv") is None:
        print("📦 UV not found. Installing UV...")
        try:
            # Install UV using the official installer
            subprocess.check_call([
                "curl", "-LsSf", "https://astral.sh/uv/install.sh", "|", "sh"
            ], shell=True)
            print("✅ UV installed successfully")
        except subprocess.CalledProcessError:
            try:
                # Fallback: pip install
                subprocess.check_call([sys.executable, "-m", "pip", "install", "uv"])
                print("✅ UV installed via pip")
            except subprocess.CalledProcessError as e:
                print(f"❌ Failed to install UV: {e}")
                return False
    else:
        # Check UV version
        result = subprocess.run(["uv", "--version"], capture_output=True, text=True)
        print(f"✅ UV found: {result.stdout.strip()}")
    
    return True

def check_system_requirements():
    """Verify system meets requirements for fine-tuning"""
    print("\n🔍 Checking system requirements...")
    
    # Check Python version
    python_version = sys.version_info
    print(f"🐍 Python: {python_version.major}.{python_version.minor}.{python_version.micro}")
    
    if python_version < (3, 9):
        print("❌ Python 3.9+ required for fine-tuning")
        return False
    
    # Check CUDA availability (will be available after torch installation)
    print("🔧 CUDA check will be performed after PyTorch installation")
    
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
        print("⚠️  Could not check system memory (non-Linux system)")
    
    return True

def setup_python_environment():
    """Setup Python virtual environment with UV"""
    print("\n🐍 Setting up Python environment with UV...")
    
    project_dir = Path(__file__).parent
    
    # Initialize UV project if pyproject.toml exists
    pyproject_file = project_dir / "pyproject.toml"
    if pyproject_file.exists():
        print("📋 Found pyproject.toml, syncing environment...")
        try:
            subprocess.check_call(["uv", "sync"], cwd=project_dir)
            print("✅ Environment synced successfully")
        except subprocess.CalledProcessError as e:
            print(f"❌ Failed to sync environment: {e}")
            return False
    else:
        # Create new UV project
        print("🆕 Creating new UV project...")
        try:
            subprocess.check_call(["uv", "init", "--name", "qi-smollm2-finetuning"], cwd=project_dir)
            print("✅ UV project initialized")
        except subprocess.CalledProcessError as e:
            print(f"❌ Failed to initialize UV project: {e}")
            return False
    
    return True

def install_dependencies_with_uv():
    """Install dependencies using UV"""
    print("\n📦 Installing dependencies with UV...")
    
    project_dir = Path(__file__).parent
    
    # Core ML dependencies - install with UV
    core_deps = [
        # PyTorch with CUDA support
        "torch>=2.0.1",
        "torchvision>=0.15.0",
        "torchaudio>=2.0.0",
        
        # Fine-tuning frameworks
        "transformers>=4.36.0",
        "datasets>=2.16.0",
        "trl>=0.7.4", 
        "peft>=0.7.1",
        "accelerate>=0.24.1",
        "bitsandbytes>=0.41.0",
        
        # Data processing
        "pandas>=2.0.0",
        "numpy>=1.24.0",
        "jsonlines>=3.1.0",
        "pyyaml>=6.0",
        "scipy>=1.10.0",
        "scikit-learn>=1.3.0",
        
        # Monitoring
        "tensorboard>=2.14.0",
        "wandb>=0.16.0",
        "tqdm>=4.65.0",
        "rich>=13.0.0",
    ]
    
    try:
        # Add dependencies to project
        for dep in core_deps:
            print(f"📦 Adding {dep}...")
            subprocess.check_call(["uv", "add", dep], cwd=project_dir)
        
        print("✅ Core dependencies added successfully")
        
        # Install Unsloth separately (may require special handling)
        print("🚀 Installing Unsloth (may take a few minutes)...")
        subprocess.check_call([
            "uv", "pip", "install", "unsloth[cu118]",
            "--index-url", "https://download.pytorch.org/whl/cu118"
        ], cwd=project_dir)
        
        print("✅ Unsloth installed successfully")
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install dependencies: {e}")
        return False
    
    return True

def verify_gpu_setup():
    """Verify GPU setup after PyTorch installation"""
    print("\n🔍 Verifying GPU setup...")
    
    try:
        # Run Python in UV environment to check CUDA
        project_dir = Path(__file__).parent
        result = subprocess.run([
            "uv", "run", "python", "-c", 
            "import torch; print(f'CUDA available: {torch.cuda.is_available()}'); "
            "print(f'GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"N/A\"}'); "
            "print(f'GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f}GB' if torch.cuda.is_available() else 'N/A')"
        ], cwd=project_dir, capture_output=True, text=True)
        
        if result.returncode == 0:
            print("🔧 GPU Information:")
            for line in result.stdout.strip().split('\n'):
                print(f"   {line}")
            
            if "CUDA available: True" in result.stdout:
                print("✅ CUDA setup successful")
                return True
            else:
                print("⚠️  CUDA not available - CPU-only training (very slow)")
                return True  # Continue anyway
        else:
            print(f"❌ Failed to check GPU: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"❌ GPU verification failed: {e}")
        return False

def verify_unsloth():
    """Verify Unsloth installation"""
    print("\n🚀 Verifying Unsloth installation...")
    
    try:
        project_dir = Path(__file__).parent
        result = subprocess.run([
            "uv", "run", "python", "-c",
            "from unsloth import FastLanguageModel; print('✅ Unsloth imported successfully')"
        ], cwd=project_dir, capture_output=True, text=True)
        
        if result.returncode == 0:
            print(result.stdout.strip())
            return True
        else:
            print(f"❌ Unsloth verification failed: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"❌ Unsloth verification error: {e}")
        return False

def setup_directories():
    """Create necessary directories for fine-tuning"""
    print("\n📁 Setting up directories...")
    
    directories = [
        "data",
        "models", 
        "logs",
        "checkpoints",
        "outputs"
    ]
    
    base_path = Path(__file__).parent
    
    for dir_name in directories:
        dir_path = base_path / dir_name
        dir_path.mkdir(parents=True, exist_ok=True)
        print(f"✅ Created {dir_path}")
    
    return True

def create_training_config():
    """Create optimized training configuration file"""
    print("\n⚙️  Creating training configuration...")
    
    config = """# SmolLM2-1.7B Fine-tuning Configuration
# Optimized for RTX 5070 Ti (16GB VRAM) with UV environment

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
  train_file: "data/classification_train.jsonl"
  val_file: "data/classification_val.jsonl"
  dataset_text_field: "text"
  
output_config:
  output_dir: "outputs/smollm2-classification"
  logging_dir: "logs"
  checkpoint_dir: "checkpoints"

# UV specific configuration
uv_config:
  python_version: ">=3.9"
  use_uv_run: true  # Use 'uv run' for all Python executions
"""
    
    config_path = Path(__file__).parent / "config.yaml"
    with open(config_path, 'w') as f:
        f.write(config)
    
    print(f"✅ Configuration saved to {config_path}")
    return True

def create_uv_scripts():
    """Create UV-specific convenience scripts"""
    print("\n📜 Creating UV convenience scripts...")
    
    # Update train.py to use UV
    train_script = Path(__file__).parent / "train_uv.py"
    train_content = '''#!/usr/bin/env python3
"""
SmolLM2-1.7B Fine-tuning Script with UV

Usage: uv run train_uv.py
"""

# This imports the main training logic but runs in UV environment
from train import SmolLM2Trainer

def main():
    """Main training function using UV environment"""
    print("🚀 SmolLM2-1.7B Fine-tuning with UV Environment")
    print("=" * 60)
    
    # Use the same trainer but in UV context
    trainer = SmolLM2Trainer()
    
    # The rest is identical to the original train.py
    if not trainer.verify_hardware():
        return False
    
    if not trainer.load_model():
        return False
    
    if not trainer.train():
        return False
    
    if not trainer.export_for_ollama():
        print("⚠️  Export failed, but training succeeded")
    
    print("\\n🎉 SmolLM2 fine-tuning completed successfully!")
    return True

if __name__ == "__main__":
    import sys
    success = main()
    sys.exit(0 if success else 1)
'''
    
    with open(train_script, 'w') as f:
        f.write(train_content)
    
    print(f"✅ Created {train_script}")
    return True

def main():
    """Main setup function"""
    print("🚀 SmolLM2-1.7B Fine-tuning Environment Setup with UV")
    print("=" * 55)
    
    # Check UV installation
    if not check_uv_installation():
        print("❌ UV installation failed")
        return False
    
    # Check system requirements
    if not check_system_requirements():
        print("❌ System requirements not met")
        return False
    
    # Setup Python environment
    if not setup_python_environment():
        print("❌ Python environment setup failed")
        return False
    
    # Install dependencies with UV
    if not install_dependencies_with_uv():
        print("❌ Dependency installation failed")
        return False
    
    # Verify GPU setup
    if not verify_gpu_setup():
        print("⚠️  GPU verification failed, but continuing...")
    
    # Verify Unsloth
    if not verify_unsloth():
        print("❌ Unsloth verification failed")
        return False
    
    # Setup directories
    if not setup_directories():
        print("❌ Directory setup failed")
        return False
    
    # Create training config
    if not create_training_config():
        print("❌ Configuration creation failed")
        return False
    
    # Create UV scripts
    if not create_uv_scripts():
        print("❌ UV script creation failed")
        return False
    
    print("\n🎉 UV-based setup completed successfully!")
    print("\nNext steps with UV:")
    print("1. Generate training data: uv run generate_data.py")
    print("2. Start fine-tuning: uv run train.py")
    print("3. Evaluate model: uv run evaluate.py")
    print("\nUV commands:")
    print("- uv sync          # Sync dependencies")
    print("- uv add <package> # Add new dependency")
    print("- uv run <script>  # Run Python script in environment")
    print("- uv pip list      # List installed packages")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)