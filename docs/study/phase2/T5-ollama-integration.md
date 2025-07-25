# T5: Ollama Integration - Local LLM Setup Guide

## Overview

This guide covers the design and implementation of Ollama integration for local LLM support in the Qi V2 Agent. Based on 2025 model landscape analysis, this integration provides enterprise-grade local AI capabilities while maintaining performance and security standards through `@langchain/ollama` integration.

## Architecture Decisions

### Model Selection Criteria for 2025

**Primary Model Recommendations:**

**DeepSeek-R1 Series (Recommended for Development)**
- **Use Case**: Code generation, debugging, complex reasoning
- **Advantages**: Advanced thinking modes, structured output, excellent code understanding
- **Resource Requirements**: 8GB+ RAM for 7B, 16GB+ for 14B
- **Performance**: ~5-10 tokens/second on consumer hardware
- **Licensing**: Commercial-friendly

**Phi-4 14B (Recommended for Production)**
- **Use Case**: General reasoning, structured output, fast inference
- **Advantages**: Optimized for efficiency, strong reasoning capabilities
- **Resource Requirements**: 12GB+ RAM, optimized for CPU inference
- **Performance**: ~8-15 tokens/second on consumer hardware
- **Licensing**: MIT license, full commercial use

**Gemma 3 Series (Alternative)**
- **Use Case**: Balanced performance across tasks
- **Advantages**: Google-backed, consistent updates, good documentation
- **Resource Requirements**: 6GB+ RAM for 9B, varies by model size
- **Performance**: ~7-12 tokens/second on consumer hardware
- **Licensing**: Gemma Terms of Use

**Selection Decision Matrix:**

| Criteria | DeepSeek-R1 | Phi-4 14B | Gemma 3 | Weight |
|----------|-------------|-----------|---------|--------|
| **Code Quality** | Excellent | Very Good | Good | 25% |
| **Resource Efficiency** | Good | Excellent | Very Good | 20% |
| **Reasoning Capability** | Excellent | Excellent | Very Good | 20% |
| **Commercial License** | Yes | Yes | Restricted | 15% |
| **Community Support** | Growing | Strong | Strong | 10% |
| **Update Frequency** | Regular | Regular | Regular | 10% |

### Memory Management Strategy

**Memory Allocation Architecture:**

**Model Loading Strategy:**
- **Lazy Loading**: Load models only when needed
- **Model Caching**: Keep frequently used models in memory
- **Dynamic Unloading**: Free memory from unused models
- **Resource Monitoring**: Monitor memory usage and adjust

**Memory Tiers:**
1. **Active Model**: Currently processing requests (full VRAM/RAM)
2. **Warm Models**: Recently used, kept in system RAM
3. **Cold Models**: Available but not loaded
4. **Archived Models**: Stored on disk, downloaded on demand

**Resource Allocation Rules:**
```yaml
memory_management:
  max_models_loaded: 2
  model_timeout: 300  # seconds before unloading
  memory_threshold: 0.8  # unload models at 80% memory usage
  priority_models: ["deepseek-r1", "phi-4"]  # always keep loaded
```

### Concurrent Request Handling

**Request Queue Architecture:**

**Single Model Concurrency:**
- **Request Batching**: Group compatible requests
- **Queue Management**: FIFO with priority support
- **Timeout Handling**: Request timeout and cancellation
- **Resource Protection**: Prevent memory exhaustion

**Multi-Model Strategies:**
- **Model Routing**: Route requests to appropriate models
- **Load Balancing**: Distribute load across available models
- **Failover Support**: Fallback to alternative models
- **Performance Monitoring**: Track model performance metrics

**Concurrency Patterns:**
```typescript
interface RequestHandler {
  strategy: 'queue' | 'batch' | 'parallel';
  max_concurrent: number;
  timeout: number;
  priority_levels: string[];
  fallback_models?: string[];
}
```

## Integration Strategies

### LangChain + Ollama Connection Patterns

**Connection Architecture:**

**Primary Connection Pattern (Recommended):**
- **HTTP Client**: Use Ollama's REST API for reliability
- **Connection Pooling**: Reuse connections for multiple requests
- **Health Monitoring**: Regular health checks to Ollama service
- **Automatic Retry**: Exponential backoff for failed requests

**Alternative Patterns:**
- **Direct Library Integration**: Lower latency, higher complexity
- **gRPC Connection**: For high-performance scenarios
- **WebSocket Streaming**: Real-time bidirectional communication

**Connection Configuration Strategy:**
```yaml
ollama:
  base_url: "http://localhost:11434"
  connection_pool:
    max_connections: 10
    timeout: 30000
    retry_attempts: 3
    retry_delay: 1000
  health_check:
    interval: 30
    timeout: 5
    endpoint: "/api/version"
```

### Model Switching Strategies

**Dynamic Model Selection:**

**Context-Based Switching:**
- **Task Type Detection**: Analyze request to determine optimal model
- **Performance Requirements**: Switch based on speed vs quality needs
- **Resource Availability**: Use available models based on system resources
- **User Preferences**: Allow user to specify model preferences

**Switching Triggers:**
- **Model Performance**: Switch if model consistently underperforms
- **Resource Pressure**: Switch to lighter models under memory pressure
- **Task Complexity**: Use more capable models for complex tasks
- **Time Constraints**: Use faster models for time-critical requests

**Switching Implementation:**
```typescript
interface ModelSelectionCriteria {
  task_type: 'code' | 'reasoning' | 'general' | 'structured';
  priority: 'speed' | 'quality' | 'balanced';
  max_response_time: number;
  available_memory: number;
  user_preference?: string;
}
```

### Fallback Strategies

**Multi-Level Fallback System:**

**Level 1: Model Fallback**
- **Primary Model Failure**: Switch to alternative model
- **Performance Degradation**: Switch to more reliable model
- **Resource Exhaustion**: Switch to lighter model

**Level 2: Service Fallback**
- **Ollama Service Down**: Switch to remote API (OpenAI/Anthropic)
- **System Resource Exhaustion**: Queue requests for later processing
- **Critical Failure**: Use cached responses or simplified responses

**Level 3: Graceful Degradation**
- **No Models Available**: Provide limited functionality
- **Timeout Scenarios**: Return partial results
- **System Overload**: Reject new requests with clear error messages

**Fallback Configuration:**
```yaml
fallback_strategy:
  primary_model: "deepseek-r1"
  fallback_models: ["phi-4", "gemma-3"]
  remote_fallback:
    enabled: true
    providers: ["openai", "anthropic"]
    api_keys_required: true
  degraded_mode:
    cache_responses: true
    simple_responses: true
    queue_requests: true
    max_queue_size: 100
```

## Configuration Patterns

### Model Configuration Schema

**Comprehensive Model Configuration:**

```yaml
models:
  deepseek-r1:
    # Model identification
    name: "deepseek-r1"
    version: "latest"
    alias: ["deepseek", "dr1"]
    
    # Performance configuration
    parameters:
      temperature: 0.1
      max_tokens: 4000
      top_p: 0.9
      frequency_penalty: 0.0
      presence_penalty: 0.0
      
    # DeepSeek-R1 specific features
    features:
      thinking_enabled: true
      structured_output: true
      code_optimization: true
      
    # Resource allocation
    resources:
      memory_limit: "8GB"
      gpu_layers: 35
      cpu_threads: 8
      
    # Performance tuning
    optimization:
      batch_size: 1
      context_length: 8192
      rope_scaling: 1.0
      
  phi-4:
    name: "phi-4:14b"
    version: "latest"
    alias: ["phi4", "phi"]
    
    parameters:
      temperature: 0.0
      max_tokens: 4000
      top_p: 0.95
      
    features:
      structured_output: true
      fast_inference: true
      reasoning_optimized: true
      
    resources:
      memory_limit: "12GB"
      gpu_layers: 40
      cpu_threads: 12
      
    optimization:
      batch_size: 2
      context_length: 4096
      quantization: "q4_0"

# Global model settings
model_defaults:
  timeout: 120000
  retry_attempts: 2
  health_check_interval: 60
  auto_unload_timeout: 300
  performance_monitoring: true
```

### Performance Tuning Parameters

**System-Level Optimization:**

**Memory Management:**
- **Model Loading**: Control when models load/unload
- **Context Caching**: Cache conversation context for efficiency
- **Garbage Collection**: Aggressive cleanup of unused resources
- **Memory Mapping**: Use memory-mapped files for large models

**CPU Optimization:**
- **Thread Allocation**: Optimize thread usage per model
- **NUMA Awareness**: Allocate resources considering NUMA topology
- **Process Priority**: Set appropriate process priorities
- **Affinity Setting**: Pin processes to specific CPU cores

**GPU Optimization (if available):**
- **Layer Distribution**: Optimize GPU/CPU layer distribution
- **Memory Allocation**: Efficient GPU memory management
- **Batch Processing**: Optimize batch sizes for GPU utilization
- **Mixed Precision**: Use appropriate precision for speed/quality balance

**Performance Tuning Configuration:**
```yaml
performance:
  system:
    cpu_threads: "auto"  # or specific number
    numa_policy: "preferred"
    process_priority: "normal"
    memory_policy: "aggressive_cleanup"
    
  gpu:
    enabled: true
    gpu_layers: "auto"  # or specific number
    memory_fraction: 0.8
    mixed_precision: true
    
  optimization:
    parallel_processing: true
    context_caching: true
    model_quantization: "q4_0"
    rope_frequency_scaling: 1.0
```

### Resource Allocation Strategies

**Dynamic Resource Management:**

**Adaptive Allocation:**
- **Load-Based Scaling**: Adjust resources based on current load
- **Performance Monitoring**: Monitor and adjust based on performance metrics
- **Resource Contention**: Handle resource conflicts between models
- **Priority-Based Allocation**: Allocate resources based on request priority

**Resource Limits:**
```yaml
resource_limits:
  global:
    max_memory: "16GB"
    max_cpu_percent: 80
    max_gpu_memory: "12GB"
    
  per_model:
    max_memory: "8GB"
    max_cpu_threads: 8
    max_concurrent_requests: 3
    
  emergency:
    memory_threshold: 0.9
    cpu_threshold: 0.85
    action: "unload_inactive_models"
```

## Key API Concepts

### ChatOllama Initialization Patterns

**Basic Initialization:**
```typescript
import { ChatOllama } from '@langchain/ollama';

// Standard initialization
const model = new ChatOllama({
  model: "deepseek-r1",
  baseUrl: "http://localhost:11434",
  temperature: 0.1,
  maxTokens: 4000
});
```

**Advanced Configuration:**
```typescript
// Model with 2025 features
const advancedModel = new ChatOllama({
  model: "deepseek-r1",
  baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  
  // Core parameters
  temperature: 0.1,
  maxTokens: 4000,
  topP: 0.9,
  
  // DeepSeek-R1 specific features
  thinkingEnabled: true,
  structuredOutput: true,
  
  // Performance optimization
  numCtx: 8192,
  numGpu: 35,
  numThread: 8,
  
  // Request handling
  timeout: 120000,
  keepAlive: "5m",
  
  // Custom headers for monitoring
  headers: {
    "X-Client-Version": "qi-agent-v2",
    "X-Session-ID": sessionId
  }
});
```

### Streaming Patterns

**Basic Streaming:**
```typescript
// Simple streaming implementation
async function streamResponse(prompt: string) {
  const stream = await model.stream([
    { role: "user", content: prompt }
  ]);
  
  for await (const chunk of stream) {
    process.stdout.write(chunk.content);
  }
}
```

**Advanced Streaming with Control:**
```typescript
interface StreamingOptions {
  onToken?: (token: string) => void;
  onThinking?: (thinking: string) => void;
  onComplete?: (response: string) => void;
  onError?: (error: Error) => void;
  controller?: AbortController;
}

class OllamaStreamingManager {
  async streamWithControl(
    prompt: string, 
    options: StreamingOptions = {}
  ): Promise<string> {
    const { onToken, onThinking, onComplete, onError, controller } = options;
    
    try {
      let fullResponse = '';
      let thinkingContent = '';
      
      const stream = await this.model.stream([
        { role: "user", content: prompt }
      ], {
        signal: controller?.signal
      });
      
      for await (const chunk of stream) {
        // Handle thinking mode for DeepSeek-R1
        if (chunk.metadata?.thinking) {
          thinkingContent += chunk.content;
          onThinking?.(chunk.content);
        } else {
          fullResponse += chunk.content;
          onToken?.(chunk.content);
        }
      }
      
      onComplete?.(fullResponse);
      return fullResponse;
      
    } catch (error) {
      onError?.(error as Error);
      throw error;
    }
  }
}
```

### Model-Specific Features (2025)

**DeepSeek-R1 Thinking Mode:**
```typescript
interface DeepSeekR1Options {
  thinkingEnabled: boolean;
  thinkingMode: 'visible' | 'hidden' | 'summary';
  maxThinkingTokens: number;
  preserveThinking: boolean;
}

const deepSeekModel = new ChatOllama({
  model: "deepseek-r1",
  thinkingEnabled: true,
  thinkingMode: 'visible',
  maxThinkingTokens: 2000,
  
  // Custom formatting for thinking output
  formatThinking: (thinking: string) => {
    return `<thinking>\n${thinking}\n</thinking>`;
  }
});
```

**Phi-4 Structured Output:**
```typescript
interface Phi4StructuredOptions {
  structuredOutput: boolean;
  responseFormat: 'json' | 'yaml' | 'markdown';
  schema?: object;
  validateOutput: boolean;
}

const phi4Model = new ChatOllama({
  model: "phi-4:14b",
  structuredOutput: true,
  responseFormat: 'json',
  
  // Schema validation
  schema: {
    type: 'object',
    properties: {
      code: { type: 'string' },
      explanation: { type: 'string' },
      confidence: { type: 'number', minimum: 0, maximum: 1 }
    },
    required: ['code', 'explanation']
  },
  
  validateOutput: true
});
```

## Local Development Optimization

### Ollama Installation and Setup

**Recommended Installation:**
```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Verify installation
ollama --version

# Start Ollama service
ollama serve

# Pull recommended models
ollama pull deepseek-r1
ollama pull phi-4:14b
ollama pull gemma3:9b
```

**Development Configuration:**
```bash
# Set environment variables for development
export OLLAMA_HOST=0.0.0.0:11434
export OLLAMA_MAX_LOADED_MODELS=2
export OLLAMA_NUM_PARALLEL=1
export OLLAMA_DEBUG=1

# Configure memory limits
export OLLAMA_MAX_QUEUE=512
export OLLAMA_KEEP_ALIVE=5m
export OLLAMA_LOAD_TIMEOUT=5m
```

### Model Management Commands

**Essential Ollama Commands:**
```bash
# List available models
ollama list

# Show model information
ollama show deepseek-r1

# Run model interactively
ollama run deepseek-r1

# Remove unused models
ollama rm old-model

# Update models
ollama pull deepseek-r1:latest

# Monitor resource usage
ollama ps
```

### Performance Monitoring

**Key Metrics to Monitor:**
- **Response Time**: Time from request to first token
- **Throughput**: Tokens per second generation
- **Memory Usage**: RAM and GPU memory consumption
- **Model Load Time**: Time to load/unload models
- **Queue Length**: Number of pending requests
- **Error Rate**: Failed requests percentage

**Monitoring Implementation:**
```typescript
interface PerformanceMetrics {
  responseTime: number;
  tokensPerSecond: number;
  memoryUsage: number;
  queueLength: number;
  errorRate: number;
  timestamp: Date;
}

class OllamaMonitor {
  async collectMetrics(): Promise<PerformanceMetrics> {
    return {
      responseTime: await this.measureResponseTime(),
      tokensPerSecond: await this.measureThroughput(),
      memoryUsage: await this.getMemoryUsage(),
      queueLength: await this.getQueueLength(),
      errorRate: await this.calculateErrorRate(),
      timestamp: new Date()
    };
  }
}
```

## Production Deployment Considerations

### System Requirements

**Minimum Requirements:**
- **CPU**: 4 cores, 2.5GHz+
- **RAM**: 8GB (for 7B models)
- **Storage**: 20GB+ SSD for model storage
- **Network**: Stable internet for model downloads

**Recommended Requirements:**
- **CPU**: 8+ cores, 3.0GHz+
- **RAM**: 16GB+ (for 14B models)
- **GPU**: 8GB+ VRAM (optional but recommended)
- **Storage**: 50GB+ NVMe SSD
- **Network**: High-bandwidth for model management

### Scaling Strategies

**Horizontal Scaling:**
- **Multiple Ollama Instances**: Run multiple Ollama services
- **Load Balancing**: Distribute requests across instances
- **Model Specialization**: Different instances for different model types
- **Geographic Distribution**: Deploy instances closer to users

**Vertical Scaling:**
- **Resource Optimization**: Optimize CPU, memory, and GPU usage
- **Model Quantization**: Use quantized models for efficiency
- **Batch Processing**: Process multiple requests together
- **Caching Strategies**: Cache frequently accessed data

### Security Considerations

**Network Security:**
- **Access Control**: Restrict access to Ollama API
- **TLS Encryption**: Use HTTPS for all communications
- **API Authentication**: Implement authentication for API access
- **Network Isolation**: Isolate Ollama service from public internet

**Data Security:**
- **Input Sanitization**: Validate and sanitize all inputs
- **Output Filtering**: Filter sensitive information from outputs
- **Audit Logging**: Log all interactions for security auditing
- **Data Retention**: Implement appropriate data retention policies

## Troubleshooting Guide

### Common Issues and Solutions

**Model Loading Issues:**
- **Out of Memory**: Reduce model size or increase system memory
- **Model Not Found**: Verify model name and check available models
- **Loading Timeout**: Increase timeout settings or check system resources
- **Corrupted Model**: Re-download model using `ollama pull`

**Performance Issues:**
- **Slow Response**: Check system resources and optimize parameters
- **High Memory Usage**: Implement model unloading and memory management
- **GPU Not Utilized**: Verify GPU drivers and Ollama GPU support
- **High CPU Usage**: Optimize thread allocation and CPU settings

**Connection Issues:**
- **Service Unavailable**: Check if Ollama service is running
- **Connection Timeout**: Verify network connectivity and service status
- **API Errors**: Check API endpoint and authentication
- **Port Conflicts**: Ensure Ollama port (11434) is available

## Integration Testing Strategy

### Testing Levels

**Unit Tests:**
- **Model Initialization**: Test model creation and configuration
- **Parameter Validation**: Test parameter validation logic
- **Error Handling**: Test error scenarios and recovery
- **Performance Metrics**: Test monitoring and metrics collection

**Integration Tests:**
- **LangChain Integration**: Test ChatOllama with LangGraph agents
- **Model Switching**: Test dynamic model selection and fallback
- **Streaming**: Test streaming functionality and control
- **Resource Management**: Test memory and resource management

**Performance Tests:**
- **Load Testing**: Test under realistic load conditions
- **Stress Testing**: Test system limits and breaking points
- **Endurance Testing**: Test long-running stability
- **Benchmark Testing**: Compare performance across models

### Test Configuration

**Test Environment Setup:**
```yaml
test_environment:
  ollama:
    base_url: "http://localhost:11434"
    test_models: ["tinyllama", "phi-4:7b"]  # Lightweight for testing
    
  performance_targets:
    max_response_time: 30000  # 30 seconds
    min_tokens_per_second: 1.0
    max_memory_usage: "4GB"
    
  integration:
    timeout: 60000
    retry_attempts: 2
    cleanup_after_test: true
```

## Next Steps

After completing T5 Ollama integration architecture:

1. **Proceed to T6**: [Terminal UI](./T6-terminal-ui.md) for Ink React architecture
2. **Set Up Development Environment**: Install Ollama and test model integration
3. **Performance Benchmarking**: Establish baseline performance metrics
4. **Security Implementation**: Implement security measures for local LLM usage

This T5 implementation guide provides the architectural foundation for robust local LLM integration, enabling high-performance offline AI capabilities while maintaining enterprise-grade reliability and security standards.