#!/usr/bin/env python3
"""
Python LangChain MCP Server

Provides classification capabilities using Python LangChain with better
function calling reliability than TypeScript implementation.
"""

import asyncio
import sys
import os
import json
from typing import Any, Dict

from mcp.server.stdio import stdio_server
from mcp.server import Server, NotificationOptions
from mcp.server.models import InitializationOptions
from mcp import types

from classification import ClassificationConfig, initialize_classifier, get_classifier
from schemas import list_available_schemas


# Initialize the MCP server
server = Server("python-langchain-classifier")


@server.list_tools()
async def handle_list_tools() -> list[types.Tool]:
    """List available tools"""
    return [
        types.Tool(
            name="classify_input",
            description="Classify input text as prompt or workflow using Python LangChain with function calling",
            inputSchema={
                "type": "object",
                "properties": {
                    "input_text": {
                        "type": "string",
                        "description": "Text to classify"
                    },
                    "schema_name": {
                        "type": "string",
                        "description": "Schema to use for classification",
                        "enum": list_available_schemas(),
                        "default": "standard"
                    },
                    "model_id": {
                        "type": "string",
                        "description": "Model to use for classification",
                        "default": "llama3.2:3b"
                    },
                    "temperature": {
                        "type": "number",
                        "description": "Temperature for model generation",
                        "default": 0.1,
                        "minimum": 0.0,
                        "maximum": 2.0
                    }
                },
                "required": ["input_text"]
            },
        ),
        types.Tool(
            name="list_schemas",
            description="List all available classification schemas",
            inputSchema={
                "type": "object",
                "properties": {},
            },
        )
    ]


@server.call_tool()
async def handle_call_tool(
    name: str, arguments: dict[str, Any] | None
) -> list[types.TextContent | types.ImageContent | types.EmbeddedResource]:
    """Handle tool calls"""
    
    if name == "list_schemas":
        schemas = list_available_schemas()
        return [
            types.TextContent(
                type="text",
                text=json.dumps({
                    "available_schemas": schemas,
                    "default_schema": "standard"
                }, indent=2)
            )
        ]
    
    elif name == "classify_input":
        if not arguments:
            raise ValueError("classify_input requires arguments")
        
        input_text = arguments.get("input_text")
        if not input_text:
            raise ValueError("input_text is required")
        
        schema_name = arguments.get("schema_name", "standard")
        model_id = arguments.get("model_id", "llama3.2:3b")
        temperature = arguments.get("temperature", 0.1)
        
        # Update classifier config if model changed
        config = ClassificationConfig(
            model_id=model_id,
            temperature=temperature
        )
        initialize_classifier(config)
        
        # Perform classification
        classifier = get_classifier()
        result = classifier.classify_input(input_text, schema_name)
        
        # Return result as JSON
        return [
            types.TextContent(
                type="text", 
                text=json.dumps(result.dict(), indent=2)
            )
        ]
    
    else:
        raise ValueError(f"Unknown tool: {name}")


async def main():
    """Main entry point for the MCP server"""
    
    # Initialize the classifier with configuration from environment variables
    config = ClassificationConfig(
        base_url=os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434'),
        model_id=os.getenv('MODEL_ID', 'llama3.2:3b'),
        temperature=float(os.getenv('TEMPERATURE', '0.1'))
    )
    initialize_classifier(config)
    
    # Run the server using stdin/stdout for MCP protocol
    async with stdio_server() as (read_stream, write_stream):
        initialization_options = InitializationOptions(
            server_name="python-langchain-classifier",
            server_version="1.0.0",
            capabilities=server.get_capabilities(
                notification_options=NotificationOptions(),
                experimental_capabilities={}
            )
        )
        await server.run(read_stream, write_stream, initialization_options)


if __name__ == "__main__":
    asyncio.run(main())