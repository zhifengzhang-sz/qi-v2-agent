# SmolLM2-1.7B Fine-tuning Plan

## 🎯 Objective

Fine-tune **SmolLM2-1.7B** to achieve **>95% accuracy** on three-type classification (command/prompt/workflow), improving from the current rule-based system's **83.3% accuracy**.

## 🚀 Why SmolLM2-1.7B?

### Model Selection Rationale

| Criterion | SmolLM2-1.7B | Alternatives | Decision |
|-----------|---------------|--------------|----------|
| **Parameter Count** | 1.7B | TinyLlama (1.1B), Gemma2 (2B) | Optimal for hardware |
| **Performance** | SOTA for size | Good | Best benchmark results |
| **Fine-tuning Support** | Excellent | Good | Built for customization |
| **Memory Requirements** | ~12GB VRAM | 8GB / 16GB | Perfect fit for RTX 5070 Ti |
| **Training Speed** | Fast with Unsloth | Moderate | 2x speed optimization |
| **Local Deployment** | Excellent | Good | Ollama compatibility |

### Benchmark Performance

```
SmolLM2-1.7B Benchmarks:
├── HellaSwag: 68.7 (best in class)
├── ARC: 60.5 (strong reasoning)
├── PIQA: 77.6 (practical intelligence)
├── MMLU-Pro: 19.4 (knowledge retention)
└── GSM8K: 31.0 (mathematical reasoning)

Classification Relevance:
├── Text understanding: Excellent (HellaSwag, PIQA)
├── Pattern recognition: Strong (ARC scores)
├── Context awareness: Good (instruction following)
└── Fine-tuning potential: Proven (multiple success stories)
```

## 🏗️ Hardware Optimization

### Target Hardware: RTX 5070 Ti + i9 + 128GB RAM

```
Hardware Analysis:
├── GPU Memory: 16GB VRAM
│   ├── Model (4-bit): ~3.5GB
│   ├── Gradients: ~3.5GB  
│   ├── Optimizer: ~2GB
│   ├── Batch data: ~1GB
│   └── Available: ~6GB buffer ✅
│
├── System Memory: 128GB RAM  
│   ├── Dataset loading: ~2GB
│   ├── Preprocessing: ~1GB
│   ├── OS + other: ~4GB
│   └── Available: ~121GB buffer ✅
│
└── CPU: i9 (multi-core)
    ├── Data preprocessing: Parallel
    ├── Batch preparation: Multi-threaded
    └── Validation: Concurrent
```

### Optimized Training Configuration

```python
# Memory-optimized configuration for RTX 5070 Ti
training_config = {
    "model_config": {
        "load_in_4bit": True,           # QLoRA quantization
        "bnb_4bit_compute_dtype": torch.bfloat16,
        "bnb_4bit_use_double_quant": True,
    },
    
    "lora_config": {
        "r": 16,                        # LoRA rank - balanced performance/memory
        "alpha": 32,                    # LoRA alpha - stable training
        "target_modules": "all-linear", # All linear layers for max adaptability
        "dropout": 0.1,                 # Prevent overfitting
    },
    
    "training_args": {
        "per_device_train_batch_size": 4,     # Max for 16GB VRAM
        "gradient_accumulation_steps": 8,     # Effective batch size: 32
        "learning_rate": 2e-4,                # Stable learning rate
        "num_train_epochs": 3,                # Prevent overfitting
        "warmup_steps": 100,                  # Smooth training start
        "max_grad_norm": 1.0,                 # Gradient clipping
        "dataloader_num_workers": 8,          # i9 multi-core utilization
    }
}
```

## 📊 Training Data Strategy

### Dataset Composition (Target: 1000+ Examples)

```
Training Dataset Structure:
├── Current Test Cases: 18 examples (labeled)
├── Generated Variations: 500 examples
│   ├── Command variations: 100 examples
│   ├── Prompt variations: 200 examples  
│   └── Workflow variations: 200 examples
├── Edge Cases: 300 examples
│   ├── Ambiguous inputs: 100 examples
│   ├── Domain-specific: 100 examples
│   └── Error corrections: 100 examples
└── Validation Set: 200 examples (held out)

Total: 1000 training + 200 validation = 1200 examples
```

### Data Generation Approach

#### 1. Systematic Variations of Known Cases
```python
base_cases = [
    {"input": "write a quicksort in haskell", "label": "prompt"},
    {"input": "write a quicksort in haskell into file foo.hs", "label": "workflow"},
    {"input": "fix bug in src/auth.ts and run tests", "label": "workflow"}
]

variations = generate_variations(base_cases, patterns=[
    # Language variations
    {"quicksort": ["mergesort", "bubblesort", "heapsort"]},
    {"haskell": ["python", "javascript", "rust", "go"]},
    
    # File operation variations  
    {"into file": ["to file", "save as", "write to", "create file"]},
    {"foo.hs": ["app.py", "main.js", "lib.rs", "server.go"]},
    
    # Action variations
    {"fix bug": ["debug issue", "resolve error", "patch problem"]},
    {"run tests": ["execute tests", "test suite", "validate code"]}
])
```

#### 2. LLM-Generated Synthetic Data
```python
generation_prompts = [
    """Generate 50 examples of simple coding requests that should be classified as 'prompt':
    - Single-step code generation
    - No file operations
    - Conversational format
    Format: {"input": "...", "label": "prompt"}""",
    
    """Generate 50 examples of complex multi-step tasks that should be classified as 'workflow':
    - File operations or multi-step processes
    - System-level implementations
    - Tool orchestration required
    Format: {"input": "...", "label": "workflow"}"""
]
```

### Data Format (JSONL)

```jsonl
{"messages": [{"role": "user", "content": "Classify this input: write a quicksort in haskell"}, {"role": "assistant", "content": "prompt"}]}
{"messages": [{"role": "user", "content": "Classify this input: write a quicksort into file.hs"}, {"role": "assistant", "content": "workflow"}]}
{"messages": [{"role": "user", "content": "Classify this input: /help"}, {"role": "assistant", "content": "command"}]}
{"messages": [{"role": "user", "content": "Classify this input: fix authentication bug and add tests"}, {"role": "assistant", "content": "workflow"}]}
{"messages": [{"role": "user", "content": "Classify this input: what is recursion?"}, {"role": "assistant", "content": "prompt"}]}
```

## 🔬 Training Process

### Phase 1: Environment Setup
```bash
# Install optimized dependencies
pip install unsloth[cu118]
pip install torch==2.0.1 torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
pip install transformers==4.36.0 datasets==2.16.0 trl==0.7.4 peft==0.7.1

# Verify GPU setup
python -c "import torch; print(f'CUDA available: {torch.cuda.is_available()}')"
python -c "import torch; print(f'GPU memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f}GB')"
```

### Phase 2: Model Loading with Unsloth
```python
from unsloth import FastLanguageModel

# Load SmolLM2-1.7B with 4-bit quantization
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="HuggingFaceTB/SmolLM2-1.7B-Instruct",
    max_seq_length=512,           # Classification inputs are short
    dtype=None,                   # Auto-detect optimal dtype
    load_in_4bit=True,           # QLoRA quantization for memory efficiency
)

# Configure LoRA adapters
model = FastLanguageModel.get_peft_model(
    model,
    r=16,                        # LoRA rank
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj", 
                   "gate_proj", "up_proj", "down_proj"],
    lora_alpha=32,
    lora_dropout=0.1,
    bias="none",
    use_gradient_checkpointing="unsloth",  # Memory optimization
    random_state=42,
)
```

### Phase 3: Training Execution
```python
from trl import SFTTrainer
from transformers import TrainingArguments

# Training arguments optimized for RTX 5070 Ti
training_args = TrainingArguments(
    per_device_train_batch_size=4,
    gradient_accumulation_steps=8,      # Effective batch size: 32
    learning_rate=2e-4,
    num_train_epochs=3,
    warmup_steps=100,
    logging_steps=10,
    save_steps=500,
    evaluation_strategy="steps",
    eval_steps=250,
    output_dir="./smollm2-classification",
    optim="adamw_8bit",                 # Memory-efficient optimizer
    weight_decay=0.01,
    lr_scheduler_type="cosine",
    max_grad_norm=1.0,
    dataloader_num_workers=8,           # i9 multi-threading
    fp16=False,                         # bfloat16 preferred for stability  
    bf16=True,
    report_to="tensorboard",            # Training monitoring
    remove_unused_columns=False,
)

# Initialize trainer
trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=train_dataset,
    eval_dataset=val_dataset,
    dataset_text_field="text",
    max_seq_length=512,
    args=training_args,
)

# Start training
trainer.train()
```

### Phase 4: Training Monitoring

```python
# Expected training metrics
training_expectations = {
    "training_loss": {
        "initial": 1.2,         # Starting loss
        "target": 0.3,          # Target final loss  
        "warning_threshold": 0.8 # If loss doesn't drop below this
    },
    
    "evaluation_accuracy": {
        "baseline": 0.833,      # Current rule-based accuracy
        "target": 0.95,         # Fine-tuning target
        "milestone": 0.90       # Acceptable intermediate result
    },
    
    "training_time": {
        "expected": "2-4 hours",
        "per_epoch": "45-90 minutes",
        "warning": "6+ hours"   # Indicates configuration issues
    }
}
```

## 🎯 Performance Targets

### Accuracy Improvements

```
Classification Accuracy Targets:
├── Overall: 83.3% → 95%+ (11.7% improvement)
├── Commands: 100% → 100% (maintain perfection)
├── Prompts: 89% → 97%+ (8% improvement)
└── Workflows: 67% → 93%+ (26% improvement)

Specific Error Fixes:
├── "how to fix memory leaks?" → correct prompt classification
├── "create React component for auth" → correct workflow classification  
├── "implement OAuth2 system" → correct workflow classification
└── Confidence calibration → reduce overconfident errors
```

### Inference Performance

```
Performance Requirements:
├── Latency: <100ms per classification (vs current ~10ms)
├── Memory: <12GB VRAM during inference
├── Throughput: >10 classifications/second
└── Accuracy: >95% on held-out test set
```

## 🔄 Integration Strategy

### Model Export and Deployment

```python
# Export trained model for Ollama integration
model.save_pretrained_merged(
    "smollm2-classification-finetuned",
    tokenizer,
    save_method="merged_16bit",     # Efficient deployment format
)

# Convert to Ollama format
ollama_model_config = {
    "architecture": "SmolLM2",
    "parameters": "1.7B",
    "quantization": "Q4_K_M",       # Balanced quality/speed
    "context_length": 512,
    "use_case": "classification"
}
```

### CLI Integration

```typescript
// Replace rule-based classifier with fine-tuned model
class MLEnhancedParser implements IParser {
  private ollamaModel = 'smollm2-classification:latest'
  private fallbackParser = new AdvancedCLIParser() // Keep rule-based backup
  
  async classifyInput(input: string): Promise<AdvancedParseResult> {
    try {
      // Primary ML classification
      const mlResult = await this.classifyWithML(input)
      
      if (mlResult.confidence > 0.8) {
        return mlResult
      }
      
      // Fallback to rule-based for low confidence
      return this.fallbackParser.classifyInput(input)
      
    } catch (error) {
      // Robust fallback on ML failure
      return this.fallbackParser.classifyInput(input)
    }
  }
}
```

## 📅 Implementation Timeline

### Week 1: Setup and Data Preparation
- **Day 1-2**: Environment setup, dependency installation
- **Day 3-4**: Training data generation and validation
- **Day 5-7**: Data quality review and augmentation

### Week 2: Model Training and Evaluation  
- **Day 1-3**: Fine-tuning execution and monitoring
- **Day 4-5**: Model evaluation and performance testing
- **Day 6-7**: Hyperparameter tuning if needed

### Week 3: Integration and Deployment
- **Day 1-3**: Model export and Ollama integration
- **Day 4-5**: CLI integration and testing
- **Day 6-7**: Performance validation and documentation

## 🔍 Risk Mitigation

### Potential Issues and Solutions

#### 1. Training Stability
```
Risk: Training loss doesn't converge
Mitigation: 
├── Reduce learning rate to 1e-4
├── Increase warmup steps to 200
├── Add gradient clipping (max_norm=0.5)
└── Monitor training curves closely
```

#### 2. Overfitting
```
Risk: High training accuracy, poor validation
Mitigation:
├── Early stopping based on validation loss
├── Increase dropout to 0.2
├── Reduce training epochs to 2
└── Add more diverse training data
```

#### 3. Memory Issues
```
Risk: CUDA out of memory errors
Mitigation:
├── Reduce batch size to 2
├── Increase gradient accumulation to 16
├── Enable gradient checkpointing
└── Use DeepSpeed ZeRO-2 if needed
```

#### 4. Integration Problems
```
Risk: Model doesn't integrate smoothly with CLI
Mitigation:
├── Maintain rule-based fallback system
├── Implement confidence-based switching
├── Add comprehensive error handling
└── Test with diverse input patterns
```

## 📊 Success Metrics

### Primary Metrics
- **Classification Accuracy**: >95% on held-out test set
- **Inference Speed**: <100ms per classification
- **Error Reduction**: Fix all current systematic errors

### Secondary Metrics  
- **Training Efficiency**: Complete training in <4 hours
- **Memory Usage**: <12GB VRAM during inference
- **Integration Success**: Seamless CLI integration without regressions

### User Experience Metrics
- **Response Quality**: Improved handling of edge cases
- **Confidence Accuracy**: Better uncertainty quantification
- **System Reliability**: Robust fallback mechanisms

---

This comprehensive plan leverages **SmolLM2-1.7B's proven capabilities** with **hardware-optimized training** to achieve **>95% classification accuracy** while maintaining the **production-ready architecture** of the existing CLI system.