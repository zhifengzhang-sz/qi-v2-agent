"""
Schema definitions for classification tasks.

Python equivalent of the TypeScript schema registry, using Pydantic models
for type-safe schema definitions and validation.
"""

from typing import Literal, List
from pydantic import BaseModel, Field
from enum import Enum


class ClassificationType(str, Enum):
    """Classification types (commands excluded - handled by rule-based classifier)"""
    PROMPT = "prompt"
    WORKFLOW = "workflow"


class ConversationContext(str, Enum):
    """Context types for conversation analysis"""
    GREETING = "greeting"
    QUESTION = "question"
    FOLLOW_UP = "follow_up"
    TASK_REQUEST = "task_request"
    MULTI_STEP = "multi_step"


class MinimalSchema(BaseModel):
    """Basic type and confidence only - optimized for speed"""
    type: ClassificationType = Field(
        description="Classification: prompt (single-step) or workflow (multi-step)"
    )
    confidence: float = Field(
        ge=0.0, le=1.0,
        description="Confidence score from 0.0 to 1.0"
    )


class StandardSchema(BaseModel):
    """Type, confidence, and reasoning - good balance of accuracy and speed"""
    type: ClassificationType = Field(
        description="Classification: prompt (single-step task) or workflow (multi-step orchestrated task)"
    )
    confidence: float = Field(
        ge=0.0, le=1.0,
        description="Confidence score from 0.0 to 1.0"
    )
    reasoning: str = Field(
        max_length=150,
        description="Brief explanation of why this classification was chosen"
    )


class DetailedSchema(BaseModel):
    """Comprehensive output with indicators and complexity scoring"""
    type: ClassificationType = Field(
        description="Classification: prompt (conversational/single-step) or workflow (complex/multi-step)"
    )
    confidence: float = Field(
        ge=0.0, le=1.0,
        description="Confidence score from 0.0 to 1.0"
    )
    reasoning: str = Field(
        max_length=200,
        description="Detailed explanation of classification decision"
    )
    indicators: List[str] = Field(
        description="Key indicators that led to this classification"
    )
    complexity_score: int = Field(
        ge=1, le=5,
        description="Task complexity rating: 1=simple, 5=very complex"
    )


class OptimizedSchema(BaseModel):
    """Research-optimized schema balancing accuracy, speed, and reliability"""
    type: ClassificationType = Field(
        description="Classification: prompt (single-step request) or workflow (multi-step task requiring orchestration)"
    )
    confidence: float = Field(
        ge=0.0, le=1.0,
        description="Classification confidence from 0.0 to 1.0"
    )
    reasoning: str = Field(
        min_length=10, max_length=100,
        description="Concise reasoning for this classification"
    )
    task_steps: int = Field(
        ge=1,
        description="Estimated number of steps required to complete this task"
    )


class ContextAwareSchema(BaseModel):
    """Context-aware schema focusing on conversation context and task complexity analysis"""
    type: ClassificationType = Field(
        description="prompt: direct question/request, workflow: requires multiple coordinated steps"
    )
    confidence: float = Field(
        ge=0.0, le=1.0,
        description="Confidence score from 0.0 to 1.0"
    )
    reasoning: str = Field(
        max_length=150,
        description="Brief explanation of classification decision"
    )
    conversation_context: ConversationContext = Field(
        description="Context type: greeting/question/follow_up always prompt, task_request/multi_step may be workflow"
    )
    step_count: int = Field(
        ge=1,
        description="Estimated number of steps needed (1=prompt, 2+=workflow)"
    )
    requires_coordination: bool = Field(
        description="Does this require coordinating multiple tools/services?"
    )


class ClassificationResult(BaseModel):
    """Result wrapper for classification responses"""
    result: dict
    schema_name: str
    model_id: str
    latency_ms: float
    success: bool
    error_message: str | None = None


# Schema registry mapping names to Pydantic models
SCHEMA_REGISTRY = {
    "minimal": MinimalSchema,
    "standard": StandardSchema,
    "detailed": DetailedSchema,
    "optimized": OptimizedSchema,
    "context_aware": ContextAwareSchema,
}


def get_schema_model(schema_name: str) -> type[BaseModel]:
    """Get Pydantic model for a schema name"""
    if schema_name not in SCHEMA_REGISTRY:
        available = ", ".join(SCHEMA_REGISTRY.keys())
        raise ValueError(f"Unknown schema '{schema_name}'. Available schemas: {available}")
    
    return SCHEMA_REGISTRY[schema_name]


def list_available_schemas() -> List[str]:
    """List all available schema names"""
    return list(SCHEMA_REGISTRY.keys())