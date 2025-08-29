#!/bin/bash

# Load environment variables from .env file
if [ -f .env ]; then
    export $(cat .env | grep -v '#' | xargs)
else
    echo "Error: .env file not found!"
    echo "Please create a .env file with your DEEPSEEK_API_KEY"
    exit 1
fi

# Check if API key is loaded
if [ -z "$DEEPSEEK_API_KEY" ]; then
    echo "Error: DEEPSEEK_API_KEY not found in .env file"
    exit 1
fi

# Set Anthropic-compatible environment variables
export ANTHROPIC_BASE_URL="https://api.deepseek.com/anthropic"
export ANTHROPIC_AUTH_TOKEN="$DEEPSEEK_API_KEY"
export ANTHROPIC_MODEL="deepseek-chat"
export ANTHROPIC_SMALL_FAST_MODEL="deepseek-chat"

# Launch Claude Code (try to find claude command in PATH or common locations)
if command -v claude &> /dev/null; then
    claude "$@"
elif [ -f "$HOME/.claude/local/claude" ]; then
    "$HOME/.claude/local/claude" "$@"
elif [ -f "/usr/local/bin/claude" ]; then
    /usr/local/bin/claude "$@"
else
    echo "Error: claude command not found!"
    echo "Please ensure Claude Code is installed and available in your PATH"
    echo "Or install it to one of the standard locations:"
    echo "  - $HOME/.claude/local/claude"
    echo "  - /usr/local/bin/claude"
    exit 1
fi