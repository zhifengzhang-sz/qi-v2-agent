# Schema Design Experiments for Workflow Detection

## Problem Analysis

Current schema performance shows workflow detection is the universal challenge:

| Schema | Workflow Accuracy | Issue |
|--------|-------------------|-------|
| minimal | 30% | Too basic, lacks context |
| standard | 20% | Same prompting approach |
| detailed | 30% | More fields don't help core problem |

**Root Issue**: The prompting approach, not schema complexity.

## Hypothesis: Dataset Labeling Issues

Examining "workflow" samples that consistently fail:
- "Thanks very much" - This is conversational, not multi-step
- "I want to make a restaurant reservation" - Could be single request
- "Yes, thanks. What's their phone number?" - Follow-up question, not workflow

**Theory**: The dataset may have ambiguous or incorrect labels for workflow vs prompt.

## Experimental Schema Designs

### **1. Context-Aware Schema**
Focus on conversation context and intent detection:

```json
{
  "type": "object",
  "properties": {
    "type": {
      "enum": ["prompt", "workflow"],
      "description": "prompt: direct question/request, workflow: requires multiple coordinated steps"
    },
    "confidence": { "type": "number" },
    "reasoning": { "type": "string" },
    "conversation_context": {
      "enum": ["greeting", "question", "follow_up", "task_request", "multi_step"],
      "description": "Context type to help distinguish conversational vs task-oriented"
    },
    "step_count": {
      "type": "integer",
      "description": "Estimated number of steps needed (1=prompt, 2+=workflow)"
    },
    "requires_coordination": {
      "type": "boolean", 
      "description": "Does this require coordinating multiple tools/services?"
    }
  }
}
```

### **2. Intent-Based Schema**
Focus on user intent rather than technical classification:

```json
{
  "type": "object", 
  "properties": {
    "type": {
      "enum": ["prompt", "workflow"],
      "description": "Classification based on processing requirements"
    },
    "confidence": { "type": "number" },
    "reasoning": { "type": "string" },
    "user_intent": {
      "enum": ["information_seeking", "conversation", "task_completion", "multi_task_orchestration"],
      "description": "What the user is trying to accomplish"
    },
    "processing_complexity": {
      "enum": ["simple", "moderate", "complex"],
      "description": "How complex will the processing be?"
    },
    "external_dependencies": {
      "type": "array",
      "items": {"type": "string"},
      "description": "What external services/tools might be needed?"
    }
  }
}
```

### **3. Action-Oriented Schema**
Focus on actions required rather than abstract classification:

```json
{
  "type": "object",
  "properties": {
    "type": {
      "enum": ["prompt", "workflow"], 
      "description": "prompt: single response, workflow: orchestrated actions"
    },
    "confidence": { "type": "number" },
    "reasoning": { "type": "string" },
    "required_actions": {
      "type": "array",
      "items": {
        "enum": ["respond", "search", "book", "call", "coordinate", "analyze", "generate"]
      },
      "description": "What actions are needed to fulfill this request?"
    },
    "action_sequence": {
      "type": "boolean",
      "description": "Do actions need to be performed in sequence?"
    },
    "data_dependencies": {
      "type": "boolean",
      "description": "Does later action depend on earlier action's results?"
    }
  }
}
```

### **4. Minimal+ Schema (Conservative Enhancement)**
Enhance minimal schema without overcomplicating:

```json
{
  "type": "object",
  "properties": {
    "type": {
      "enum": ["prompt", "workflow"],
      "description": "prompt: can be answered directly, workflow: needs multiple coordinated steps"  
    },
    "confidence": { "type": "number" },
    "indicators": {
      "type": "object",
      "properties": {
        "multi_step_words": {"type": "boolean", "description": "Contains 'and', 'then', 'also', etc."},
        "action_verbs": {"type": "integer", "description": "Number of action verbs found"},
        "time_references": {"type": "boolean", "description": "References specific times/dates"},
        "location_references": {"type": "boolean", "description": "References specific locations"}
      }
    }
  }
}
```

## Proposed Prompt Engineering Changes

### **Current Approach Problem**
All schemas use similar prompt engineering:
```
"Classify as prompt (single-step) or workflow (multi-step)..."
```

### **New Approach: Explicit Examples**
```
Analyze this input and classify based on PROCESSING REQUIREMENTS:

**PROMPT Examples (answer directly):**
- "What is recursion?" → Single explanation needed
- "Hi, how are you?" → Simple conversational response  
- "Write a function to sort arrays" → Single code generation

**WORKFLOW Examples (multiple coordinated steps):**
- "Book a table at Restaurant X for 4 people at 7pm" → 1) Find restaurant, 2) Check availability, 3) Make reservation
- "Find flights to NYC and book the cheapest one" → 1) Search flights, 2) Compare prices, 3) Book selected flight
- "Analyze sales data and create a report" → 1) Load data, 2) Perform analysis, 3) Generate report

**Key Question**: Can this be handled with a SINGLE response, or does it need MULTIPLE COORDINATED ACTIONS?

Input: "{input}"
```

## Testing Strategy

1. **Test new schemas** with same 30-sample dataset
2. **Focus on workflow accuracy** improvement 
3. **Validate against dataset labeling** - check if "workflows" are actually workflows
4. **A/B test prompt engineering** changes

## Expected Outcomes

- **Context-aware**: Better understanding of conversational context
- **Intent-based**: More accurate intent detection  
- **Action-oriented**: Clearer action requirements
- **Minimal+**: Conservative improvement without complexity

Target: Improve workflow detection from 30% to 60%+ while maintaining prompt accuracy.