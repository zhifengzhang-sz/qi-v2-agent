# V2 Stateful Agent: Design Requirements

## Problem Statement

The V1 stateless agent processes each input independently, leading to context-unaware behavior that breaks conversational flow and user expectations.

### **Core Issue Example**
```
Turn 1: "let's discuss this, please don't update any files"
Turn 2: "implement quicksort algorithm in src/utils.js"

V1 Result: WORKFLOW → File modification attempt (INCORRECT)
V2 Goal:   PROMPT → Discussion/suggestions only (CORRECT)
```

**Root Cause**: The InputClassifier only analyzes the current input "implement quicksort algorithm in src/utils.js" and correctly identifies it as a workflow request, but completely ignores the previous constraint "don't update files".

## V2 Design Goals

### **Primary Objective**
Transform the agent from stateless request-response processing to stateful conversational interaction that maintains context awareness across multiple turns.

### **Key Capabilities Required**

1. **Conversation Constraint Tracking**
   - Remember user preferences: "don't update files", "just discuss", "read-only mode"
   - Apply constraints across multiple conversation turns
   - Handle constraint modifications and cancellations

2. **Context Continuity**
   - Previous instructions affecting current interpretation
   - Workflow state awareness (continuing vs. starting new)
   - Domain context persistence across turns

3. **User Intent Evolution**
   - Track changing user intentions (exploration → implementation)
   - Understand conversation flow progression
   - Adapt responses based on conversation trajectory

4. **Session-Based Preferences**
   - User's working style and preferences
   - Domain focus and specialization context
   - Conversation-specific configurations

## Enhanced Business Logic Flow

### **V1 (Current) - Stateless**
```
User Input → InputClassifier → (Command | Prompt | Workflow) → Handler → Response
```

**Characteristics:**
- Each input processed independently
- No conversation history consideration
- Classification based solely on current input content
- Fast, simple, predictable behavior

### **V2 (Target) - Stateful**
```
User Input + Conversation State → Context-Aware Classifier → (Command | Prompt | Workflow) → Handler → Response + State Update
```

**Enhanced Characteristics:**
- **Conversation Memory**: Previous messages, constraints, and context
- **State-Aware Classification**: Classification considers conversation history
- **Intent Tracking**: Understanding user's evolving intentions
- **Constraint Management**: Respecting previous instructions and limitations
- **State Persistence**: Conversation state maintained across sessions

## Interface Design Changes

### **InputClassifier Enhancement**

**Current Interface:**
```typescript
interface IInputClassifier {
  classifyInput(input: string, context?: ProcessingContext): Promise<InputClassificationResult>;
  getSupportedTypes(): readonly string[];
}
```

**V2 Enhanced Interface:**
```typescript
interface IStatefulInputClassifier extends IInputClassifier {
  classifyInput(
    input: string, 
    conversationState: ConversationState,
    context?: ProcessingContext
  ): Promise<InputClassificationResult>;
  
  // New methods for stateful processing
  updateConversationConstraints(constraints: ConversationConstraint[]): void;
  getActiveConstraints(): readonly ConversationConstraint[];
  analyzeContextContinuity(input: string, history: ConversationState): ContextContinuityResult;
}
```

### **New Data Structures**

**ConversationConstraint:**
```typescript
interface ConversationConstraint {
  readonly id: string;
  readonly type: 'file-modification' | 'mode-restriction' | 'domain-focus' | 'custom';
  readonly description: string;
  readonly isActive: boolean;
  readonly priority: number;
  readonly createdAt: Date;
  readonly expiresAt?: Date;
  readonly conditions?: ConstraintCondition[];
}
```

**ContextContinuityResult:**
```typescript
interface ContextContinuityResult {
  readonly isContinuation: boolean;
  readonly previousContext?: string;
  readonly contextWeight: number; // 0-1, how much previous context should influence
  readonly suggestedInputType: 'command' | 'prompt' | 'workflow';
  readonly reasoning: string;
}
```

**EnhancedProcessingContext:**
```typescript
interface EnhancedProcessingContext extends ProcessingContext {
  readonly conversationId: string;
  readonly turnNumber: number;
  readonly activeConstraints: readonly ConversationConstraint[];
  readonly conversationSummary?: string;
  readonly userPreferences: ReadonlyMap<string, unknown>;
  readonly sessionDuration: number;
}
```

## Classification Algorithm Requirements

### **Context-Aware Classification Logic**

The enhanced InputClassifier must implement a multi-stage analysis:

**Stage 1: Constraint Analysis**
```typescript
// Analyze active conversation constraints
const activeConstraints = getActiveConstraints(conversationState);
const applicableConstraints = filterApplicableConstraints(input, activeConstraints);

// Check for constraint violations
if (wouldViolateConstraints(inputType, applicableConstraints)) {
  // Override classification to respect constraints
  return overrideClassificationForConstraints(input, applicableConstraints);
}
```

**Stage 2: Context Continuity Analysis**
```typescript
// Analyze relationship to previous conversation
const continuity = analyzeContextContinuity(input, conversationState);

// Weight current input analysis with historical context
const contextWeight = calculateContextWeight(continuity, conversationState);
const adjustedConfidence = baseConfidence * (1 - contextWeight) + continuityConfidence * contextWeight;
```

**Stage 3: Intent Evolution Tracking**
```typescript
// Track how user intent has evolved
const intentHistory = extractIntentHistory(conversationState);
const currentIntent = analyzeCurrentIntent(input);
const intentEvolution = analyzeIntentEvolution(intentHistory, currentIntent);

// Adjust classification based on intent trajectory
return adjustClassificationForIntentEvolution(classification, intentEvolution);
```

## Constraint Precedence Rules

### **Constraint Priority System**

1. **Explicit Recent Constraints** (Priority: 100)
   - Direct user instructions in last 3 turns
   - Example: "don't update files", "read-only mode"

2. **Session-Level Preferences** (Priority: 80)
   - User preferences established for the session
   - Example: "I'm just exploring today"

3. **Domain Context Rules** (Priority: 60)
   - Context-specific behavioral rules
   - Example: In documentation mode, prefer explanations over implementations

4. **Default System Behavior** (Priority: 40)
   - Standard V1 classification logic
   - Used when no higher priority constraints apply

### **Constraint Conflict Resolution**

**Rule 1: Temporal Precedence**
- More recent constraints override older ones
- Explicit constraint cancellation ("ignore that, go ahead and implement")

**Rule 2: Specificity Precedence**  
- Specific constraints override general ones
- File-specific constraints override mode constraints

**Rule 3: Safety Precedence**
- Restrictive constraints override permissive ones when in conflict
- "Don't modify" overrides "go ahead and implement"

## Memory Management Requirements

### **Conversation Summarization**

**Trigger Conditions:**
- Conversation exceeds 50 turns
- Memory usage exceeds threshold
- Explicit user request for session reset

**Summarization Strategy:**
- Preserve active constraints and user preferences
- Maintain domain context and current workflow state
- Compress historical interactions while preserving critical context

**Summary Structure:**
```typescript
interface ConversationSummary {
  readonly sessionId: string;
  readonly activeConstraints: ConversationConstraint[];
  readonly userPreferences: ReadonlyMap<string, unknown>;
  readonly domainContext: string;
  readonly currentWorkflowState?: WorkflowState;
  readonly keyInteractions: ConversationHighlight[];
  readonly createdAt: Date;
}
```

### **Context Window Management**

**Sliding Window Strategy:**
- Keep last 20 turns in full detail
- Maintain constraint history for entire session
- Compress older interactions into summary form

**Performance Optimization:**
- Index conversation history for fast constraint lookup
- Cache frequently accessed context patterns
- Lazy load historical context only when needed

## Session Management Requirements

### **Session Lifecycle**

**Session Creation:**
- Generate unique session ID
- Initialize conversation state
- Set up memory providers
- Configure default constraints

**Session Maintenance:**
- Update conversation state after each turn
- Persist critical state to storage
- Monitor memory usage and performance
- Handle session timeouts and cleanup

**Session Termination:**
- Save final conversation state
- Clean up memory resources
- Archive conversation history
- Generate session summary

### **Multi-Session Support**

**Concurrent Sessions:**
- Support multiple active conversations
- Isolate session state and memory
- Handle session switching and context management

**Session Persistence:**
- Restore conversation state across system restarts
- Handle session migration and backup
- Support conversation history export/import

## Performance Requirements

### **Response Time Targets**

- **Simple Classification**: < 100ms (same as V1)
- **Context-Aware Classification**: < 300ms
- **Long History Analysis**: < 500ms
- **Session Initialization**: < 200ms

### **Memory Usage Limits**

- **Per Session**: Maximum 50MB active memory
- **Conversation History**: Maximum 1000 turns before summarization
- **Concurrent Sessions**: Support 100+ active sessions

### **Scalability Requirements**

- **Horizontal Scaling**: Session state externalization for multi-instance deployment
- **Database Integration**: Support for PostgreSQL/Redis session storage
- **Caching Strategy**: Intelligent caching of conversation context and constraints

## Backward Compatibility

### **V1 Compatibility Mode**

**Gradual Migration:**
- Support V1 stateless mode as fallback
- Allow per-session configuration of stateful vs. stateless processing
- Provide compatibility layer for existing V1 integrations

**Interface Preservation:**
- Maintain all existing V1 interfaces
- Add V2 functionality as extensions, not replacements
- Support mixed-mode deployments

## Testing Requirements

### **Conversation Flow Testing**

**Constraint Tracking Tests:**
- Verify constraint preservation across multiple turns
- Test constraint conflict resolution
- Validate constraint expiration and cleanup

**Context Continuity Tests:**
- Test workflow continuation across conversation breaks
- Verify domain context persistence
- Validate user intent evolution tracking

**Performance Tests:**
- Load testing with long conversation histories
- Memory usage analysis under various scenarios
- Concurrent session stress testing

### **Edge Case Handling**

**Adversarial Input:**
- "Ignore previous instructions"
- Contradictory constraints in single input
- Rapid context switching

**System Limits:**
- Maximum conversation length handling
- Memory pressure responses
- Session timeout and recovery

## Success Metrics

### **Functional Metrics**

- **Context Accuracy**: 95% correct constraint application
- **Conversation Flow**: 90% natural conversation continuity
- **User Satisfaction**: Improved conversational experience feedback

### **Performance Metrics**

- **Response Time**: Meet response time targets 99% of the time
- **Memory Efficiency**: Stay within memory usage limits
- **System Reliability**: 99.9% uptime with graceful degradation

### **Adoption Metrics**

- **Feature Usage**: Track stateful feature adoption
- **Session Duration**: Measure average conversation length
- **User Retention**: Improved user engagement with stateful features

## Implementation Priorities

### **Phase 1: Foundation (Weeks 1-2)**
1. Session management infrastructure
2. Basic conversation state persistence
3. Simple constraint tracking

### **Phase 2: Core Features (Weeks 3-5)**
1. Context-aware InputClassifier
2. Constraint precedence system
3. Conversation summarization

### **Phase 3: Optimization (Weeks 6-7)**
1. Performance optimization
2. Advanced memory management
3. Comprehensive testing and validation

This design provides a comprehensive roadmap for transforming the V1 stateless agent into a sophisticated V2 stateful conversational system while maintaining the architectural excellence and component reusability of the current implementation.