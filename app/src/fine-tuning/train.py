#!/usr/bin/env python3
"""
SmolLM2-1.7B Fine-tuning Script

Optimized training script for three-type classification using Unsloth
Hardware: RTX 5070 Ti (16GB VRAM) + i9 + 128GB RAM
"""

import os
import json
import torch
import yaml
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List

from unsloth import FastLanguageModel
from trl import SFTTrainer
from transformers import TrainingArguments
from datasets import Dataset
import pandas as pd

class SmolLM2Trainer:
    def __init__(self, config_path: str = None):
        """Initialize trainer with configuration"""
        self.config_path = config_path or Path(__file__).parent / "config.yaml"
        self.config = self.load_config()
        self.model = None
        self.tokenizer = None
        
    def load_config(self) -> Dict[str, Any]:
        """Load training configuration"""
        with open(self.config_path, 'r') as f:
            config = yaml.safe_load(f)
        return config
    
    def verify_hardware(self) -> bool:
        """Verify hardware requirements"""
        print("🔍 Verifying hardware setup...")
        
        if not torch.cuda.is_available():
            print("❌ CUDA not available")
            return False
        
        device_name = torch.cuda.get_device_name(0)
        gpu_memory = torch.cuda.get_device_properties(0).total_memory / 1e9
        
        print(f"🔧 GPU: {device_name}")
        print(f"💾 GPU Memory: {gpu_memory:.1f}GB")
        
        if gpu_memory < 14:
            print("⚠️  Warning: Less than 14GB VRAM may require reduced batch size")
        
        return True
    
    def load_model(self) -> bool:
        """Load and configure SmolLM2-1.7B with LoRA"""
        print("📦 Loading SmolLM2-1.7B model...")
        
        try:
            # Load model with Unsloth optimizations
            self.model, self.tokenizer = FastLanguageModel.from_pretrained(
                model_name=self.config["model_config"]["model_name"],
                max_seq_length=self.config["model_config"]["max_seq_length"],
                dtype=None,  # Auto-detect optimal dtype
                load_in_4bit=self.config["model_config"]["load_in_4bit"],
                # Quantization config
                bnb_4bit_compute_dtype=getattr(torch, self.config["model_config"]["bnb_4bit_compute_dtype"]),
                bnb_4bit_use_double_quant=self.config["model_config"]["bnb_4bit_use_double_quant"],
            )
            
            print("✅ Base model loaded successfully")
            
            # Configure LoRA
            self.model = FastLanguageModel.get_peft_model(
                self.model,
                r=self.config["lora_config"]["r"],
                target_modules=[
                    "q_proj", "k_proj", "v_proj", "o_proj",
                    "gate_proj", "up_proj", "down_proj"
                ],
                lora_alpha=self.config["lora_config"]["alpha"],
                lora_dropout=self.config["lora_config"]["dropout"],
                bias=self.config["lora_config"]["bias"],
                use_gradient_checkpointing="unsloth",  # Memory optimization
                random_state=42,
            )
            
            print("✅ LoRA configuration applied")
            return True
            
        except Exception as e:
            print(f"❌ Model loading failed: {e}")
            return False
    
    def load_datasets(self) -> tuple:
        """Load training and validation datasets"""
        print("📚 Loading datasets...")
        
        train_file = Path(self.config["data_config"]["train_file"])
        val_file = Path(self.config["data_config"]["val_file"])
        
        if not train_file.exists() or not val_file.exists():
            print(f"❌ Dataset files not found. Run generate_data.py first.")
            return None, None
        
        # Load JSONL files
        train_data = []
        with open(train_file, 'r') as f:
            for line in f:
                train_data.append(json.loads(line))
        
        val_data = []
        with open(val_file, 'r') as f:
            for line in f:
                val_data.append(json.loads(line))
        
        # Convert to text format for SFTTrainer
        def format_messages(example):
            messages = example["messages"]
            # Format as instruction-response pair
            text = f"<s>[INST] {messages[0]['content']} [/INST] {messages[1]['content']}</s>"
            return {"text": text}
        
        train_formatted = [format_messages(ex) for ex in train_data]
        val_formatted = [format_messages(ex) for ex in val_data]
        
        train_dataset = Dataset.from_pandas(pd.DataFrame(train_formatted))
        val_dataset = Dataset.from_pandas(pd.DataFrame(val_formatted))
        
        print(f"✅ Loaded {len(train_dataset)} training examples")
        print(f"✅ Loaded {len(val_dataset)} validation examples")
        
        return train_dataset, val_dataset
    
    def setup_training_args(self) -> TrainingArguments:
        """Setup optimized training arguments"""
        print("⚙️  Configuring training arguments...")
        
        # Create output directories
        output_dir = Path(self.config["output_config"]["output_dir"])
        logging_dir = Path(self.config["output_config"]["logging_dir"])
        
        output_dir.mkdir(parents=True, exist_ok=True)
        logging_dir.mkdir(parents=True, exist_ok=True)
        
        args = TrainingArguments(
            # Output configuration
            output_dir=str(output_dir),
            logging_dir=str(logging_dir),
            
            # Training configuration
            per_device_train_batch_size=self.config["training_args"]["per_device_train_batch_size"],
            gradient_accumulation_steps=self.config["training_args"]["gradient_accumulation_steps"],
            learning_rate=self.config["training_args"]["learning_rate"],
            num_train_epochs=self.config["training_args"]["num_train_epochs"],
            
            # Optimization
            warmup_steps=self.config["training_args"]["warmup_steps"],
            max_grad_norm=self.config["training_args"]["max_grad_norm"],
            optim=self.config["training_args"]["optim"],
            weight_decay=self.config["training_args"]["weight_decay"],
            lr_scheduler_type=self.config["training_args"]["lr_scheduler_type"],
            
            # Memory and performance
            fp16=self.config["training_args"]["fp16"],
            bf16=self.config["training_args"]["bf16"],
            dataloader_num_workers=self.config["training_args"]["dataloader_num_workers"],
            
            # Logging and saving
            logging_steps=self.config["training_args"]["logging_steps"],
            save_steps=self.config["training_args"]["save_steps"],
            evaluation_strategy=self.config["training_args"]["evaluation_strategy"],
            eval_steps=self.config["training_args"]["eval_steps"],
            save_total_limit=self.config["training_args"]["save_total_limit"],
            
            # Best model selection
            load_best_model_at_end=self.config["training_args"]["load_best_model_at_end"],
            metric_for_best_model=self.config["training_args"]["metric_for_best_model"],
            greater_is_better=self.config["training_args"]["greater_is_better"],
            
            # Monitoring
            report_to=self.config["training_args"]["report_to"],
            
            # Reproducibility
            seed=42,
            data_seed=42,
        )
        
        print("✅ Training arguments configured")
        return args
    
    def compute_classification_accuracy(self, eval_pred):
        """Compute classification accuracy for evaluation"""
        predictions, labels = eval_pred
        
        # Decode predictions and labels
        predicted_texts = self.tokenizer.batch_decode(predictions, skip_special_tokens=True)
        label_texts = self.tokenizer.batch_decode(labels, skip_special_tokens=True)
        
        # Extract classification labels
        correct = 0
        total = 0
        
        for pred, label in zip(predicted_texts, label_texts):
            # Simple string matching for classification labels
            pred_clean = pred.strip().lower()
            label_clean = label.strip().lower()
            
            if any(cls in pred_clean for cls in ['command', 'prompt', 'workflow']):
                total += 1
                if any(cls in pred_clean and cls in label_clean for cls in ['command', 'prompt', 'workflow']):
                    correct += 1
        
        accuracy = correct / total if total > 0 else 0
        return {"eval_accuracy": accuracy}
    
    def train(self) -> bool:
        """Execute the training process"""
        print("🚀 Starting SmolLM2 fine-tuning...")
        
        # Load datasets
        train_dataset, val_dataset = self.load_datasets()
        if train_dataset is None:
            return False
        
        # Setup training arguments
        training_args = self.setup_training_args()
        
        # Initialize trainer
        trainer = SFTTrainer(
            model=self.model,
            tokenizer=self.tokenizer,
            train_dataset=train_dataset,
            eval_dataset=val_dataset,
            dataset_text_field="text",
            max_seq_length=self.config["model_config"]["max_seq_length"],
            args=training_args,
            compute_metrics=self.compute_classification_accuracy,
        )
        
        print(f"🎯 Training configuration:")
        print(f"   Effective batch size: {training_args.per_device_train_batch_size * training_args.gradient_accumulation_steps}")
        print(f"   Learning rate: {training_args.learning_rate}")
        print(f"   Epochs: {training_args.num_train_epochs}")
        print(f"   Training examples: {len(train_dataset)}")
        print(f"   Validation examples: {len(val_dataset)}")
        
        # Start training
        start_time = datetime.now()
        print(f"⏰ Training started at: {start_time}")
        
        try:
            # Train the model
            trainer.train()
            
            end_time = datetime.now()
            training_duration = end_time - start_time
            print(f"✅ Training completed successfully!")
            print(f"⏰ Training duration: {training_duration}")
            
            # Save the final model
            print("💾 Saving trained model...")
            trainer.save_model()
            
            # Save additional info
            training_info = {
                "start_time": start_time.isoformat(),
                "end_time": end_time.isoformat(),
                "duration_seconds": training_duration.total_seconds(),
                "config": self.config,
                "final_train_loss": trainer.state.log_history[-1].get("train_loss", "N/A"),
                "final_eval_loss": trainer.state.log_history[-1].get("eval_loss", "N/A"),
            }
            
            info_file = Path(self.config["output_config"]["output_dir"]) / "training_info.json"
            with open(info_file, 'w') as f:
                json.dump(training_info, f, indent=2)
            
            return True
            
        except Exception as e:
            print(f"❌ Training failed: {e}")
            return False
    
    def export_for_ollama(self) -> bool:
        """Export trained model for Ollama integration"""
        print("📤 Exporting model for Ollama...")
        
        try:
            # Save merged model (LoRA + base model)
            export_path = Path(self.config["output_config"]["output_dir"]) / "merged_model"
            
            self.model.save_pretrained_merged(
                str(export_path),
                self.tokenizer,
                save_method="merged_16bit",  # Balanced quality/size
            )
            
            print(f"✅ Model exported to: {export_path}")
            
            # Create Ollama modelfile
            modelfile_content = f"""FROM {export_path}
TEMPLATE \"\"\"<s>[INST] {{{{ .Prompt }}}} [/INST] {{{{ .Response }}}}</s>\"\"\"
PARAMETER temperature 0.1
PARAMETER top_p 0.9
PARAMETER top_k 40
PARAMETER num_ctx 512
"""
            
            modelfile_path = export_path / "Modelfile"
            with open(modelfile_path, 'w') as f:
                f.write(modelfile_content)
            
            print(f"✅ Ollama Modelfile created: {modelfile_path}")
            print(f"🔧 To use with Ollama:")
            print(f"   ollama create smollm2-classification -f {modelfile_path}")
            
            return True
            
        except Exception as e:
            print(f"❌ Export failed: {e}")
            return False

def main():
    """Main training function"""
    print("🚀 SmolLM2-1.7B Fine-tuning for Three-Type Classification")
    print("=" * 60)
    
    # Initialize trainer
    trainer = SmolLM2Trainer()
    
    # Verify hardware
    if not trainer.verify_hardware():
        print("❌ Hardware verification failed")
        return False
    
    # Load model
    if not trainer.load_model():
        print("❌ Model loading failed")
        return False
    
    # Execute training
    if not trainer.train():
        print("❌ Training failed")
        return False
    
    # Export for Ollama
    if not trainer.export_for_ollama():
        print("⚠️  Export failed, but training succeeded")
    
    print("\n🎉 SmolLM2 fine-tuning completed successfully!")
    print("\nNext steps:")
    print("1. Evaluate model: python fine-tuning/evaluate.py")
    print("2. Integrate with CLI: Update parser to use fine-tuned model")
    print("3. Test performance: Run classification benchmarks")
    
    return True

if __name__ == "__main__":
    import sys
    success = main()
    sys.exit(0 if success else 1)