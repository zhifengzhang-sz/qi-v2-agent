"""
Classification logic using Python LangChain.

Implements prompt vs workflow classification using ChatOllama with function calling,
providing better reliability than TypeScript LangChain implementation.
"""

import time
import json
from typing import Dict, Any, Optional
from pydantic import BaseModel

from langchain_ollama import ChatOllama
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage

from schemas import (
    get_schema_model, 
    ClassificationResult,
    MinimalSchema,
    StandardSchema,
    DetailedSchema,
    OptimizedSchema,
    ContextAwareSchema
)


class ClassificationConfig(BaseModel):
    """Configuration for classification requests"""
    base_url: str = "http://localhost:11434"
    model_id: str = "llama3.2:3b"
    temperature: float = 0.1
    timeout: int = 30000


class PythonLangChainClassifier:
    """Python LangChain classifier using function calling for structured output"""
    
    def __init__(self, config: ClassificationConfig):
        self.config = config
        self.llm = ChatOllama(
            model=config.model_id,
            base_url=config.base_url,
            temperature=config.temperature,
            timeout=config.timeout / 1000,  # Convert ms to seconds
        )
    
    def classify_input(
        self, 
        input_text: str, 
        schema_name: str = "standard"
    ) -> ClassificationResult:
        """
        Classify input text using the specified schema.
        
        Args:
            input_text: Text to classify
            schema_name: Schema to use for classification
            
        Returns:
            ClassificationResult with the classification and metadata
        """
        start_time = time.time()
        
        try:
            # Get the schema model
            schema_model = get_schema_model(schema_name)
            
            # Create the function tool based on the schema
            classification_tool = self._create_classification_tool(schema_model, schema_name)
            
            # Bind the tool to the LLM
            llm_with_tools = self.llm.bind_tools([classification_tool])
            
            # Create the classification prompt
            prompt = self._create_classification_prompt(input_text, schema_name)
            
            # Invoke the LLM with function calling
            response = llm_with_tools.invoke([HumanMessage(content=prompt)])
            
            # Extract the tool call result
            if not response.tool_calls:
                raise ValueError("No tool calls found in the response")
            
            tool_call = response.tool_calls[0]
            result = tool_call["args"]
            
            # Fix confidence field - ensure it's a float
            if 'confidence' in result:
                try:
                    result['confidence'] = float(result['confidence'])
                except (ValueError, TypeError):
                    result['confidence'] = 0.5  # Default fallback
            
            # Calculate latency
            latency_ms = (time.time() - start_time) * 1000
            
            return ClassificationResult(
                result=result,
                schema_name=schema_name,
                model_id=self.config.model_id,
                latency_ms=latency_ms,
                success=True
            )
            
        except Exception as e:
            latency_ms = (time.time() - start_time) * 1000
            return ClassificationResult(
                result={},
                schema_name=schema_name,
                model_id=self.config.model_id,
                latency_ms=latency_ms,
                success=False,
                error_message=str(e)
            )
    
    def _create_classification_tool(self, schema_model: type[BaseModel], schema_name: str):
        """Create a LangChain tool based on the schema model"""
        
        # Create dynamic tool based on schema fields
        schema_fields = schema_model.model_fields
        
        @tool
        def classify_text(**kwargs) -> dict:
            """Classify the input text as prompt or workflow based on the analysis.
            
            Classifications:
            - prompt: Single-step requests, questions, greetings, simple tasks
            - workflow: Multi-step tasks requiring coordination, orchestration, or sequential operations
            """
            
            # Validate required fields
            if 'type' not in kwargs or 'confidence' not in kwargs:
                raise ValueError("type and confidence are required fields")
            
            # Build result based on provided kwargs and schema requirements
            result = {}
            for field_name, field_info in schema_fields.items():
                if field_name in kwargs:
                    result[field_name] = kwargs[field_name]
            
            return result
        
        # Dynamically set the tool's args_schema
        classify_text.args_schema = schema_model
        
        return classify_text
    
    def _create_classification_prompt(self, input_text: str, schema_name: str) -> str:
        """Create the classification prompt based on schema complexity"""
        
        base_prompt = f"""You are a text classifier. Analyze the following input and classify it as either "prompt" or "workflow".

**Input to classify:** "{input_text}"

**Classification Rules:**
- **PROMPT**: Single-step requests, questions, greetings, simple tasks that can be completed directly
  Examples: "hi", "what is recursion?", "write a function", "explain this concept"
  
- **WORKFLOW**: Multi-step tasks requiring coordination, orchestration, or sequential operations  
  Examples: "create a new project with tests and documentation", "fix bugs and deploy", "analyze codebase and suggest improvements"

**Key Indicators:**
- Look for multiple actions: "and", "then", "also", "with", "plus"
- File operations: "create", "update", "fix" + file references
- Testing requirements: "with tests", "run tests", "verify"
- Coordination needs: multiple systems, tools, or sequential steps"""

        # Add schema-specific instructions
        if schema_name == "context_aware":
            base_prompt += """

**Additional Analysis Required:**
- conversation_context: "greeting" for hi/hello, "question" for queries, "task_request" for work requests
- step_count: Count estimated steps (1 = prompt, 2+ = workflow)
- requires_coordination: True if multiple tools/services needed"""

        elif schema_name == "detailed":
            base_prompt += """

**Additional Analysis Required:**
- indicators: List key words/phrases that influenced your decision
- complexity_score: Rate 1-5 (1=very simple, 5=very complex)"""

        elif schema_name == "optimized":
            base_prompt += """

**Additional Analysis Required:**
- task_steps: Estimate number of distinct steps needed"""

        base_prompt += f"""

**Instructions:**
1. Analyze the input text carefully
2. Determine if it's a single-step (prompt) or multi-step (workflow) request
3. Provide a confidence score between 0.0 and 1.0
4. Use the classify_text function with your analysis

Remember: When in doubt, prefer "prompt" for simple requests and "workflow" only for clearly multi-step tasks."""
        
        return base_prompt


# Global classifier instance (will be initialized by the MCP server)
_classifier: Optional[PythonLangChainClassifier] = None


def initialize_classifier(config: ClassificationConfig) -> None:
    """Initialize the global classifier instance"""
    global _classifier
    _classifier = PythonLangChainClassifier(config)


def get_classifier() -> PythonLangChainClassifier:
    """Get the initialized classifier instance"""
    if _classifier is None:
        raise RuntimeError("Classifier not initialized. Call initialize_classifier() first.")
    return _classifier