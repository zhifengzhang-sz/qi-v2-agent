#!/bin/bash

# Test Ollama Model Function Calling Capability
# Usage: ./test-function-calling.sh <model-name>
# Example: ./test-function-calling.sh qwen3:8b

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default Ollama host
OLLAMA_HOST=${OLLAMA_HOST:-"http://localhost:11434"}

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to print usage
usage() {
    echo "Usage: $0 <model-name>"
    echo ""
    echo "Test if an Ollama model supports function calling (tools)."
    echo ""
    echo "Examples:"
    echo "  $0 qwen3:8b"
    echo "  $0 qwen3-coder:30b"
    echo "  $0 llama3.1:8b"
    echo ""
    echo "Environment Variables:"
    echo "  OLLAMA_HOST - Ollama server URL (default: http://localhost:11434)"
    echo "               Current: $OLLAMA_HOST"
    exit 1
}

# Check if model name is provided
if [ $# -eq 0 ]; then
    print_status $RED "❌ Error: Model name is required"
    echo ""
    usage
fi

MODEL_NAME="$1"

print_status $BLUE "🧪 Testing Function Calling Capability"
echo "======================================"
echo ""
print_status $YELLOW "🤖 Model: $MODEL_NAME"
print_status $YELLOW "🔗 Ollama Host: $OLLAMA_HOST"
echo ""

# Test payload with a simple function definition
TEST_PAYLOAD='{
  "model": "'$MODEL_NAME'",
  "messages": [
    {
      "role": "user", 
      "content": "What is the weather like today?"
    }
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Get the current weather for a location",
        "parameters": {
          "type": "object",
          "properties": {
            "location": {
              "type": "string",
              "description": "The city and country, e.g. San Francisco, CA"
            }
          },
          "required": ["location"]
        }
      }
    }
  ]
}'

print_status $BLUE "📡 Testing function calling support..."

# Make the API call and capture both stdout and stderr
RESPONSE=$(curl -s -X POST "$OLLAMA_HOST/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d "$TEST_PAYLOAD" 2>&1)

# Check if curl command failed
CURL_EXIT_CODE=$?
if [ $CURL_EXIT_CODE -ne 0 ]; then
    print_status $RED "❌ Failed to connect to Ollama server"
    print_status $RED "   Please check if Ollama is running at: $OLLAMA_HOST"
    exit 1
fi

# Parse the response
if echo "$RESPONSE" | grep -q '"error"'; then
    # Extract error message
    ERROR_MSG=$(echo "$RESPONSE" | grep -o '"message":"[^"]*"' | cut -d'"' -f4)
    
    if echo "$ERROR_MSG" | grep -qi "does not support tools"; then
        print_status $RED "❌ Function Calling: NOT SUPPORTED"
        print_status $RED "   $ERROR_MSG"
        echo ""
        print_status $YELLOW "💡 Recommendation: Use OllamaWrapper method instead of LangChain"
        print_status $YELLOW "   OllamaWrapper works with ALL models using JSON prompting"
    else
        print_status $RED "❌ Error occurred: $ERROR_MSG"
    fi
    
    echo ""
    print_status $BLUE "📋 Raw Response:"
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
    
elif echo "$RESPONSE" | grep -q '"tool_calls"'; then
    print_status $GREEN "✅ Function Calling: SUPPORTED"
    print_status $GREEN "   Model returned tool_calls in response"
    echo ""
    print_status $YELLOW "💡 Recommendation: Use LangChain withStructuredOutput for best accuracy"
    
    echo ""
    print_status $BLUE "📋 Tool Calls Found:"
    echo "$RESPONSE" | jq '.choices[0].message.tool_calls' 2>/dev/null || echo "Could not parse tool_calls"
    
elif echo "$RESPONSE" | grep -q '"content"'; then
    print_status $YELLOW "⚠️  Function Calling: UNCERTAIN"
    print_status $YELLOW "   Model responded with text content instead of tool_calls"
    print_status $YELLOW "   This might indicate partial or no function calling support"
    
    echo ""
    print_status $BLUE "📋 Response Content:"
    echo "$RESPONSE" | jq '.choices[0].message.content' 2>/dev/null || echo "Could not parse content"
    
else
    print_status $RED "❌ Unexpected response format"
    echo ""
    print_status $BLUE "📋 Raw Response:"
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
fi

echo ""
print_status $BLUE "🔧 Testing Complete"

# Additional information
echo ""
print_status $BLUE "ℹ️  Additional Information:"
echo "  • Models with function calling: qwen3:8b, llama3.1:8b, mistral:7b-instruct"
echo "  • Models without function calling: qwen2.5-coder:*, qwen3-coder:30b"
echo "  • Check official list: https://ollama.com/search?c=tools"
echo "  • For non-function calling models, use OllamaWrapper method"