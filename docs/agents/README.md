# Qi Agent Architecture Evolution

This directory contains the architectural documentation for the qi-v2-agent project across multiple versions, showcasing the evolution from stateless request-response to advanced AI model training capabilities.

## Version Overview

### **V1: Stateless Agent Framework** 📁 `v1/`
**Status**: ✅ **Implemented** | **Focus**: Three-Type Classification & Workflow Orchestration

**Key Features:**
- **Three-Type Input Classification**: Clean separation of commands, prompts, and workflows
- **Workflow Extraction & Orchestration**: Convert complex requests into executable workflow specifications
- **Technology Independence**: Abstract interfaces supporting multiple model providers (Ollama, OpenAI, etc.)
- **MCP Tool Integration**: Standardized tool execution via Model Context Protocol
- **LangGraph Workflow Engine**: State-based workflow execution with real tool integration
- **Production Ready**: Operational reliability with retry logic, rate limiting, and monitoring

**Architecture Principle:**
```
User Input → InputClassifier → (Command | Prompt | Workflow) → Handler → Response
```

**Best For**: Independent task execution, clear workflow requirements, production deployments

---

### **V2: Stateful Conversational Agent** 📁 `v2/`
**Status**: 📋 **Designed** | **Focus**: Context-Aware Conversation Management

**Key Features:**
- **Conversation State Management**: Persistent context across multiple conversation turns
- **Context-Aware Classification**: Input classification considers conversation history and constraints
- **Constraint Tracking**: Respect user preferences like "don't update files" across conversation
- **Intent Evolution**: Track changing user intentions (exploration → implementation)
- **Session Management**: Long-running conversations with automatic summarization
- **Backward Compatibility**: Supports both stateless (V1) and stateful (V2) processing modes

**Enhanced Architecture:**
```
User Input + Conversation State → Context-Aware Classifier → (Command | Prompt | Workflow) → Handler → Response + State Update
```

**Examples:**
```
Turn 1: "let's discuss this, please don't update any files" 
Turn 2: "implement quicksort algorithm in src/utils.js"
Result: PROMPT (discussion) not WORKFLOW (file modification)
```

**Implementation Timeline**: 4-7 weeks | **Difficulty**: Medium (6/10)

---

### **V3: Continuous Learning Agent** 📁 `v3/` *(Future)*
**Status**: 🔮 **Planned** | **Focus**: Adaptive Model Training & Personalization

**Key Features:**
- **Continuous Fine-tuning**: Automatically improve model performance using conversation data
- **Personalized Adaptation**: Learn individual user patterns, preferences, and coding styles  
- **Domain Specialization**: Adapt to project-specific terminology, patterns, and requirements
- **Performance Optimization**: Model efficiency improvements based on usage patterns
- **Privacy-First Training**: Local fine-tuning preserving user data privacy
- **Multi-Model Orchestration**: Dynamically select and combine specialized models

**Advanced Architecture:**
```
User Interaction → V2 Processing → Response + Training Data Collection → 
Continuous Model Fine-tuning → Improved Personalized Models → Enhanced Future Responses
```

**Training Capabilities:**
- **User Style Learning**: Adapt to coding preferences, naming conventions, architectural patterns
- **Project Context**: Learn project-specific APIs, frameworks, and business logic
- **Error Pattern Recognition**: Improve debugging capabilities based on historical issues
- **Workflow Optimization**: Refine workflow generation based on successful task completions

**Technical Approach**: LoRA/QLoRA fine-tuning, incremental learning, federated learning techniques

---

## Component Reusability Across Versions

| Component | V1 | V2 | V3 |
|-----------|----|----|----| 
| **Three-Type Classification** | ✅ Core | ✅ Enhanced | ✅ ML-Optimized |
| **Workflow Orchestration** | ✅ Implemented | ✅ Context-Aware | ✅ Adaptive |
| **Model Providers** | ✅ Static | ✅ Static | ✅ Dynamic + Fine-tuned |
| **Tool Integration** | ✅ MCP Standard | ✅ MCP Standard | ✅ ML-Enhanced Selection |
| **Memory Management** | ❌ None | ✅ Conversation State | ✅ Learning Memory |
| **Personalization** | ❌ None | ❌ None | ✅ User-Specific Models |

## Migration Path

### **V1 → V2 Migration**
- **Effort**: Medium (4-7 weeks)
- **Compatibility**: Full backward compatibility  
- **Reusability**: 60% direct reuse, 30% enhancement, 10% new
- **Risk**: Low (incremental enhancement)

### **V2 → V3 Migration** *(Estimated)*
- **Effort**: High (12-16 weeks)
- **Compatibility**: V2 features preserved with ML enhancements
- **New Infrastructure**: Training pipeline, model versioning, performance monitoring
- **Risk**: Medium (new ML infrastructure required)

## Getting Started

- **For Current Implementation**: See `v1/agent.md` for the production-ready stateless framework
- **For Stateful Planning**: Review `v2/` documentation for conversation-aware design
- **For Future Research**: V3 will focus on continuous learning and model personalization

## Design Philosophy

Each version builds upon the previous architecture while maintaining:
- **Clean Abstractions**: Technology-independent interfaces
- **Backward Compatibility**: Existing functionality preserved
- **Incremental Enhancement**: Gradual capability evolution
- **Production Focus**: Operational reliability and performance

The qi-agent evolution demonstrates a thoughtful progression from basic task execution to sophisticated AI-powered assistance with continuous learning capabilities.