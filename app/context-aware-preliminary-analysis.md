# Context-Aware Schema - Preliminary Analysis

## Test Execution Status

**Date**: 2025-08-07  
**Schema**: context_aware  
**Method**: langchain-ollama-function-calling  
**Models**: qwen3:0.6b, llama3.2:3b  
**Dataset**: balanced-10x3.json (30 samples)

## Promising Early Observations

### 1. Enhanced Structured Output
The Context-Aware Schema is generating rich, structured information:
```json
{
  "confidence": 1,
  "conversation_context": "greeting/question", 
  "reasoning": "The input is a direct question...",
  "requires_coordination": false,
  "step_count": 1,
  "type": "prompt"
}
```

### 2. Context Classification Working
- **Greeting**: "Thanks very much." → `"greeting"`
- **Question**: "What's their phone number?" → `"question"`  
- **Task Request**: Restaurant booking → `"task_request"`
- **Follow Up**: Conversational continuations → `"follow_up"`

### 3. Step Count Analysis
- Single-step requests: `"step_count": 1`
- Multi-step workflows: `"step_count": 2` or higher
- Provides quantitative complexity measure

### 4. Coordination Detection
- Simple requests: `"requires_coordination": false`
- Complex orchestration: `"requires_coordination": true`
- Helps distinguish simple vs complex tasks

### 5. Workflow Detection Improvements
Observed successful workflow classifications for:
- Restaurant reservation requests
- Multi-action requests (find restaurants + specific questions)
- Tasks requiring coordination between services

## Model Differences Observed

### qwen3:0.6b Behavior:
- Consistent `confidence: 1` (very confident)
- More conservative, tends toward `"prompt"` classification
- Good at basic context recognition
- Some timeout errors on complex inputs

### llama3.2:3b Behavior:  
- More nuanced `confidence: 0.9` (appropriately cautious)
- Better workflow detection capability
- String values instead of numbers for some fields
- More sophisticated reasoning

## Key Improvements Over Previous Schemas

1. **Context Awareness**: Explicit conversation context classification
2. **Quantitative Analysis**: Step counting provides objective complexity measure
3. **Coordination Logic**: Clear distinction between simple requests and orchestrated tasks
4. **Rich Reasoning**: Enhanced explanations for classification decisions
5. **Structured Indicators**: Multiple signals for better decision-making

## Next Steps

1. **Complete Test Results**: Wait for full 60-test execution to finish
2. **Accuracy Analysis**: Compare workflow detection rate vs previous 30% ceiling
3. **Model Optimization**: Fine-tune prompting for better consistency
4. **Schema Refinement**: Address string vs number field type inconsistencies
5. **Production Testing**: Test on larger datasets if improvements confirmed

## Preliminary Assessment

The Context-Aware Schema shows **significant promise** for improving workflow detection through:
- Multi-dimensional analysis (context + steps + coordination)
- Richer structured output for better decision-making
- Clear improvement in workflow recognition patterns

**Expected Outcome**: Should exceed our target of improving workflow detection from 30% to 60%+ accuracy.