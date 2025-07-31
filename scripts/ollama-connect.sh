#!/bin/bash

# Simple Ollama WSL2 Connection Script
# Usage: source ./ollama-connect.sh (to set environment variable)
# Or: ./ollama-connect.sh (just to test connection)

# Function to get Windows host IP dynamically
get_windows_host() {
    # Method 1: From default route (most reliable for WSL2)
    local host_ip=$(ip route show default | awk '/default/ { print $3; exit }')
    if [ ! -z "$host_ip" ]; then
        echo "$host_ip"
        return 0
    fi
    
    # Method 2: From resolv.conf  
    if [ -f /etc/resolv.conf ]; then
        host_ip=$(awk '/nameserver/ { print $2; exit }' /etc/resolv.conf)
        if [ ! -z "$host_ip" ] && [ "$host_ip" != "127.0.0.1" ]; then
            echo "$host_ip"
            return 0
        fi
    fi
    
    # Fallback
    echo "172.18.144.1"
}

# Get Windows host IP
WINDOWS_HOST=$(get_windows_host)
export OLLAMA_HOST="http://$WINDOWS_HOST:11434"

echo "Windows Host: $WINDOWS_HOST"
echo "OLLAMA_HOST set to: $OLLAMA_HOST"

# Add to .bashrc for persistence
if ! grep -q "OLLAMA_HOST.*$WINDOWS_HOST" ~/.bashrc 2>/dev/null; then
    # Remove old OLLAMA_HOST entries
    sed -i '/export OLLAMA_HOST=/d' ~/.bashrc 2>/dev/null || true
    echo "export OLLAMA_HOST=\"$OLLAMA_HOST\"" >> ~/.bashrc
    echo "✅ Added to ~/.bashrc for persistence"
fi

# Test connection with better logic
echo "Testing connection..."

# Get the response
response=$(curl --connect-timeout 5 -s "$OLLAMA_HOST/api/tags" 2>/dev/null)
curl_exit_code=$?

if [ $curl_exit_code -ne 0 ]; then
    echo "❌ Connection failed - Ollama server not reachable"
    echo "   Check if Ollama is running on Windows: ollama serve"
elif [ -z "$response" ]; then
    echo "⚠️  Connection established but no response from Ollama"
    echo "   Server may be starting up or blocked by firewall"
else
    # Try to parse models from response
    models=$(echo "$response" | jq -r '.models[].name' 2>/dev/null)
    if [ -n "$models" ] && [ "$models" != "null" ]; then
        echo "$models"
        echo "✅ Connection successful! Found $(echo "$models" | wc -l) models"
    else
        echo "⚠️  Connected to Ollama but no models available"
        echo "   Raw response: $response"
        echo "   Try: ollama pull qwen2.5-coder:7b"
    fi
fi