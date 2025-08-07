# Python LangChain MCP Server

A Model Context Protocol (MCP) server that provides classification capabilities using Python LangChain with function calling. This server addresses reliability issues found in TypeScript LangChain implementations.

## Overview

This MCP server provides:
- **Better function calling reliability**: Python LangChain handles complex schemas more robustly than TypeScript
- **Multiple schema complexity levels**: From minimal (2 fields) to context-aware (6 fields)
- **Consistent API**: Maintains compatibility with existing TypeScript study framework
- **Error elimination**: Targets 0% error rate vs 23.3% in TypeScript implementation

## Installation

1. Create a Python virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

## Usage

### Standalone Testing

Run the MCP server directly:
```bash
python server.py
```

### Integration with TypeScript Framework

The server is designed to integrate with the existing qi-v2-agent study framework via MCP protocol.

## Available Tools

### classify_input

Classifies input text as "prompt" or "workflow" using specified schema complexity.

**Parameters:**
- `input_text` (required): Text to classify
- `schema_name` (optional): Schema complexity level (default: "standard")
- `model_id` (optional): Ollama model to use (default: "llama3.2:3b")  
- `temperature` (optional): Generation temperature (default: 0.1)

**Example:**
```python
{
    "input_text": "create a new project with tests",
    "schema_name": "context_aware",
    "model_id": "llama3.2:3b",
    "temperature": 0.1
}
```

### list_schemas

Lists all available classification schemas.

## Available Schemas

1. **minimal**: Basic type and confidence (fastest, lowest accuracy)
2. **standard**: Adds reasoning field (balanced performance)
3. **detailed**: Comprehensive with indicators and complexity scoring
4. **optimized**: Research-optimized balance of speed and accuracy
5. **context_aware**: Advanced context analysis for better workflow detection

## Expected Performance Improvements

Based on TypeScript LangChain limitations:

| Schema | TypeScript (Current) | Python (Expected) | Improvement |
|--------|---------------------|-------------------|-------------|
| minimal | 56.7%, 0% errors | 56.7%, 0% errors | Same (schema limitation) |
| standard | ~80%, low errors | ~85%, 0% errors | +5% accuracy, eliminate errors |
| context_aware | 73.3%, 23.3% errors | **85-90%, 0% errors** | +15% accuracy, eliminate errors |

## Configuration

The server connects to Ollama at `http://localhost:11434` by default. Ensure Ollama is running with the required models:

```bash
ollama pull llama3.2:3b
ollama pull qwen3:8b  # Optional for larger model testing
```

## Integration Architecture

```
TypeScript Study Framework
    ↓ MCP Protocol
Python LangChain MCP Server  
    ↓ ChatOllama Function Calling
Ollama Server (localhost:11434)
    ↓ Model Inference
llama3.2:3b / qwen3:8b / other models
```

## Error Handling

The server provides detailed error reporting including:
- Function calling failures
- Schema validation errors
- Model connection issues
- Performance metrics (latency, success rates)

## Development

### Testing Individual Schemas

Each schema can be tested independently to measure performance improvements over TypeScript implementation.

### Performance Monitoring

The server tracks:
- Classification accuracy
- Response latency
- Error rates
- Schema-specific performance metrics

## Known Issues

- Requires Ollama server running locally
- Model performance depends on available compute resources
- Complex schemas require sufficient model capability (8B+ recommended for context_aware)