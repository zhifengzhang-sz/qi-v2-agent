# QiCore Subagent Workflow App

## Architecture Design

This app demonstrates the **optimal workflow** for QiCore compliance analysis using **main assistant + qicore-specialist collaboration**, leveraging existing qi-v2-agent infrastructure.

## How It Leverages Existing Modules

### **1. Prompt System Integration** 
- **Uses**: `app/src/prompt/qi-prompt.ts` patterns
- **Purpose**: Structured prompt handling for qicore-specialist communication
- **Integration**: 
  - Reuses `QiPromptCLI` message-driven architecture
  - Leverages `QiAsyncMessageQueue` for orchestration
  - Uses existing command handler patterns for `/analyze` commands

### **2. Context Management Integration**
- **Uses**: `lib/src/context/` module (ContextManager, SecurityBoundaryManager)  
- **Purpose**: Manage analysis sessions and file discovery context
- **Integration**:
  - Creates isolated contexts for each analysis session
  - Uses `ConversationContext` to track analysis progress
  - Leverages `ContextManager.createConversationContext()` for session management
  - Uses security boundaries for safe file access

### **3. Message-Driven Orchestration**
- **Uses**: `QiAsyncMessageQueue` from prompt system
- **Purpose**: Coordinate between file discovery, analysis, and reporting phases
- **Integration**:
  - Phase 1 messages: File discovery requests
  - Phase 2 messages: qicore-specialist analysis requests  
  - Phase 3 messages: Report generation and aggregation

## Architecture Components

### **Core Workflow Classes**

```typescript
// Main orchestrator using existing patterns
export class QiCoreAnalysisOrchestrator {
  private contextManager: ContextManager;
  private messageQueue: QiAsyncMessageQueue;
  private promptHandler: any; // From existing prompt system
}

// File discovery service using native Claude Code tools
export class FileDiscoveryService {
  async discoverModules(pattern: string): Promise<AnalysisTarget[]>
  async readFileContents(filePath: string): Promise<string>
  async validateFileExists(filePath: string): Promise<boolean>
}

// qicore-specialist integration layer  
export class QiCoreSpecialistService {
  async analyzeCode(content: string, moduleType: 'EXTERNAL' | 'INTERNAL'): Promise<ComplianceResult>
  private formatAnalysisPrompt(content: string, type: string): string
}

// Report aggregation and generation
export class ComplianceReporter {
  async generateReport(results: ComplianceResult[]): Promise<ComplianceReport>
  async exportReport(report: ComplianceReport, format: 'markdown' | 'json'): Promise<string>
}
```

### **Integration Patterns**

#### **1. Context-Aware Sessions**
```typescript
// Create analysis session using existing ContextManager
const analysisContext = await contextManager.createConversationContext('sub-agent', parentId);

// Track analysis progress in conversation context
await contextManager.addMessageToContext(analysisContext.id, {
  role: 'system',
  content: 'Starting QiCore compliance analysis',
  timestamp: new Date(),
  metadata: { phase: 'discovery', targetPath: 'lib/src/context/' }
});
```

#### **2. Message Queue Coordination**
```typescript
// Discovery phase message
await messageQueue.sendMessage({
  type: 'QICORE_ANALYSIS_DISCOVERY',
  payload: { targetPath: 'lib/src/context/', moduleType: 'EXTERNAL' },
  priority: 'high'
});

// Analysis phase message  
await messageQueue.sendMessage({
  type: 'QICORE_SPECIALIST_ANALYZE',
  payload: { content: fileContent, moduleType: 'EXTERNAL' },
  priority: 'normal'
});

// Reporting phase message
await messageQueue.sendMessage({
  type: 'QICORE_GENERATE_REPORT', 
  payload: { results: analysisResults },
  priority: 'low'
});
```

#### **3. Prompt System Integration**
```typescript
// Use existing prompt handler patterns for qicore-specialist communication
const analysisPrompt = `
Use qicore-specialist to analyze this ${moduleType} module for QiCore compliance:

\`\`\`typescript
${fileContent}
\`\`\`

Focus on: ${getFocusAreas(moduleType)}
`;

const result = await promptHandler.processPrompt(analysisPrompt, {
  contextId: analysisContext.id,
  expectSubagentUsage: true,
  subagentType: 'qicore-specialist'
});
```

## CLI Interface Design

### **Commands Integration**
Extends existing command system from `qi-prompt.ts`:

```bash
# Start comprehensive analysis  
bun run qicore-subagent analyze --target lib/src/context/

# Analyze specific module type
bun run qicore-subagent analyze --target lib/src/context/ --type EXTERNAL

# Generate compliance report
bun run qicore-subagent report --session session_123 --format markdown

# Demo workflow
bun run qicore-subagent demo
```

### **Configuration Integration**
Reuses existing configuration patterns:

```yaml
# config/qicore-analysis.yaml
analysis:
  target_patterns:
    external: ["lib/src/*/index.ts", "lib/src/*/abstractions/*"]  
    internal: ["lib/src/*/impl/*", "lib/src/*/persistence/*"]
  
  qicore_specialist:
    prompt_template: "qicore-compliance-analysis"
    focus_areas:
      external: ["two-layer architecture", "error transformation", "clean APIs"]
      internal: ["Result<T> usage", "functional composition", "performance"]

  reporting:
    formats: ["markdown", "json"]
    include_evidence: true
    show_line_numbers: true
```

## Benefits of This Design

### **1. Leverages Existing Infrastructure**
- ✅ Reuses proven message queue architecture
- ✅ Uses established context management patterns  
- ✅ Integrates with existing prompt handling system
- ✅ Follows existing CLI command patterns

### **2. Demonstrates Optimal Workflow**
- ✅ Shows main assistant + qicore-specialist collaboration
- ✅ Solves the file access limitation problem
- ✅ Provides reusable patterns for other analysis tasks
- ✅ Creates a template for future subagent integrations

### **3. Production-Ready Architecture**
- ✅ Error handling with QiCore Result<T> patterns
- ✅ Session management and persistence  
- ✅ Configurable and extensible
- ✅ Proper separation of concerns

### **4. Educational Value**
- ✅ Shows how to build around subagent limitations
- ✅ Demonstrates architectural best practices
- ✅ Provides working examples of optimal workflows
- ✅ Creates documentation for future development

This design transforms the "limitation" we discovered into a **feature** - showing how to build robust, scalable analysis systems that work within Claude Code's subagent constraints while leveraging the full power of the existing qi-v2-agent architecture.