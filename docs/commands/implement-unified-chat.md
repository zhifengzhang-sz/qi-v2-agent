# /implement-unified-chat

This custom command implements a unified chat interface with automatic workflow detection using LangChain function calling, similar to Claude Code's natural language interface.

## Knowledge Update (Required First Step)

Before implementation, update knowledge on LangChain and LangGraph:

1. **Latest LangChain TypeScript API**: 
   - Current version: @langchain/core ^0.3.30
   - Modern `tool()` function usage (replaces deprecated DynamicTool)
   - Function calling integration patterns with chat models

2. **LangGraph Best Practices**:
   - createReactAgent() with tools integration
   - Streaming and memory management
   - Tool execution patterns

3. **Current Project Context**:
   - Existing qi-v2 agentFactory already uses createReactAgent
   - Smart routing infrastructure validated and optimized
   - Performance targets: 12ms first token, 90% render reduction

## Implementation Plan for Unified Chat Interface (v-0.2.6)

### Analysis of Current Implementation Guide

**Critical Issues Found in docs/study/phase2/cli/ink/unified-chat-impl-guide.md:**
1. **Outdated API**: Uses `DynamicTool` (deprecated) instead of modern `tool()` function  
2. **Architecture Duplication**: Creates separate UnifiedQiAgentFactory unnecessarily
3. **Missing Key Insight**: Current AgentFactory already supports this with smart routing

### Corrected Implementation Strategy

**Leverage Existing Validated Architecture:**
- Current `qi-v2 agentFactory` already uses `createReactAgent` with MCP tools
- Existing workflow message functions (`createEditWorkflowMessages`, etc.) perfectly trigger smart routing  
- All performance optimizations (streaming, token batching, timeout handling) already validated
- Smart routing detects tool requirements: simple conversation → direct LLM, complex requests → LangGraph

### Implementation Steps

#### Step 1: Create Modern LangChain Function Calling Tools

**File:** `lib/src/tools/workflow-tools.ts`

```typescript
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { QiV2AgentFactory } } from '../agent/factory.js';
import { createEditWorkflowMessages, createAnalyzeWorkflowMessages, createExplainWorkflowMessages } from '../../app/src/workflows/messages.js';

export interface WorkflowToolsConfig {
  agentFactory: qi-v2 agentFactory;
  threadId?: string;
}

export function createWorkflowTools(config: WorkflowToolsConfig) {
  const { agentFactory, threadId } = config;

  const editFilesTool = tool(
    async ({ files, instruction }) => {
      try {
        const workflowMessages = createEditWorkflowMessages(files, { message: instruction });
        
        let response = '';
        await agentFactory.stream(workflowMessages, {
          onToken: (token) => response += token,
          onComplete: (final) => response = final,
        }, threadId);
        
        return `Successfully processed edit request: ${response}`;
      } catch (error) {
        return `Edit workflow failed: ${error.message}`;
      }
    },
    {
      name: "edit_files",
      description: `Edit, modify, fix, or update code files with natural language instructions.
      
Use this when user wants to:
- Fix bugs or issues in code  
- Modify existing functionality
- Add new features to files
- Refactor or improve code
- Update documentation in files

Examples:
- "Fix the null check issue in auth.ts" 
- "Add error handling to utils.js"
- "Refactor the login function"`,
      schema: z.object({
        files: z.array(z.string()).describe("Array of file paths to edit"),
        instruction: z.string().describe("Detailed instruction on what changes to make")
      })
    }
  );

  const analyzeCodeTool = tool(
    async ({ target, options = {} }) => {
      try {
        const workflowMessages = createAnalyzeWorkflowMessages(target, options);
        
        let response = '';
        await agentFactory.stream(workflowMessages, {
          onToken: (token) => response += token,
          onComplete: (final) => response = final,
        }, threadId);
        
        return `Analysis complete: ${response}`;
      } catch (error) {
        return `Analysis workflow failed: ${error.message}`;
      }
    },
    {
      name: "analyze_code",
      description: `Analyze code complexity, structure, dependencies, and quality.
      
Use this when user wants to:
- Check code complexity or quality
- Analyze file or directory structure  
- Review dependencies and imports
- Get insights about codebase
- Understand code architecture

Examples:
- "Analyze the complexity of my utils directory"
- "Check the dependencies in src/"
- "How complex is this codebase?"`,
      schema: z.object({
        target: z.string().describe("File, directory, or code pattern to analyze"),
        options: z.object({
          complexity: z.boolean().optional().describe("Focus on complexity analysis"),
          dependencies: z.boolean().optional().describe("Analyze dependencies and imports"),
          codebase: z.boolean().optional().describe("Analyze entire codebase"),
          format: z.enum(['text', 'json', 'markdown']).optional().describe("Output format")
        }).optional()
      })
    }
  );

  const explainConceptTool = tool(
    async ({ target, options = {} }) => {
      try {
        const workflowMessages = createExplainWorkflowMessages(target, options);
        
        let response = '';
        await agentFactory.stream(workflowMessages, {
          onToken: (token) => response += token,
          onComplete: (final) => response = final,
        }, threadId);
        
        return `Explanation: ${response}`;
      } catch (error) {
        return `Explanation workflow failed: ${error.message}`;
      }
    },
    {
      name: "explain_concept",
      description: `Explain code concepts, functions, or programming topics.
      
Use this when user wants to:
- Understand specific code or functions
- Learn programming concepts  
- Get explanations of complex logic
- Educational assistance
- Code walkthroughs

Examples:
- "Explain how this function works"
- "What does async/await do?"
- "Explain the code in auth.ts"`,
      schema: z.object({
        target: z.string().describe("File path, function, or concept to explain"),
        options: z.object({
          concept: z.string().optional().describe("Specific programming concept to explain"),
          line: z.number().optional().describe("Focus on specific line number"),
          function: z.string().optional().describe("Focus on specific function"),
          level: z.enum(['beginner', 'intermediate', 'advanced']).optional().describe("Explanation level")
        }).optional()
      })
    }
  );

  return [editFilesTool, analyzeCodeTool, explainConceptTool];
}
```

#### Step 2: Enhance Existing AgentFactory

**File:** `lib/src/agent/factory.ts` - Add to imports and modify initialization

```typescript
// Add import
import { createWorkflowTools } from '../tools/workflow-tools.js';

// In initialize() method, after getting MCP tools:
const mcpTools = await this.mcpManager.getTools();
const langchainMcpTools = this.mcpManager.convertToLangChainTools(mcpTools);

// Add workflow tools
const workflowTools = createWorkflowTools({
  agentFactory: this,
  threadId: undefined // Will be provided per conversation
});

// Combine all tools
const allTools = [...langchainMcpTools, ...workflowTools];

console.log(`🔧 Loaded ${allTools.length} tools (${mcpTools.length} MCP + ${workflowTools.length} workflow)`);

// Update agent creation to use all tools
this.agent = createReactAgent({
  llm: this.llm.getModel(),
  tools: allTools, // Use combined tools
  ...(this.memorySaver && { checkpointSaver: this.memorySaver }),
  systemMessage: `You are qi-v2 agent, a helpful AI coding assistant with natural language workflow capabilities.

AUTOMATIC TOOL USAGE:
When users request file operations, code analysis, or explanations, automatically use the appropriate tools:

- edit_files: For "fix bug in auth.ts", "add feature to utils.js", "refactor this code"
- analyze_code: For "analyze my code complexity", "check dependencies", "review this file"  
- explain_concept: For "explain this function", "how does async work", "what is this code doing"

For regular conversation, respond naturally without using tools.

Available MCP tools: ${langchainMcpTools.map(t => t.name).join(', ')}
Available workflow tools: edit_files, analyze_code, explain_concept

Always provide helpful, accurate responses and use tools when they would benefit the user.`
});
```

#### Step 3: Add Unified Chat Command

**File:** `app/src/cli/commands.ts` - Add new command

```typescript
// Add after existing commands
program
  .command('unified')
  .alias('u')
  .description('Unified chat interface with natural language workflows (v-0.2.6)')
  .option('-c, --config <path>', 'Configuration file path', '../config/qi-config.yaml')
  .option('-m, --model <name>', 'Model to use')
  .option('-t, --thread <id>', 'Thread ID for conversation persistence')
  .option('--debug', 'Enable debug logging')
  .option('--no-thinking', 'Disable thinking mode for DeepSeek-R1')
  .action(async (options) => {
    try {
      if (options.debug) {
        console.log('🐛 Debug mode enabled for unified chat');
      }

      console.log('🚀 Starting Unified Qi Agent...');
      console.log('💡 Natural language workflows enabled:');
      console.log('   - "Fix the bug in auth.ts" → Automatically edits files');
      console.log('   - "Analyze my code complexity" → Automatically analyzes code'); 
      console.log('   - "Explain how this function works" → Automatically explains code');
      console.log('   - Regular conversation works as normal');

      // Use same configuration logic as chat command
      const configLoader = new ConfigLoader(options.config);
      let config = configLoader.loadConfig();

      if (options.model) {
        config = {
          ...config,
          model: {
            ...config.model,
            name: options.model,
          },
        };
      }

      if (options.noThinking) {
        config = {
          ...config,
          model: {
            ...config.model,
            thinkingEnabled: false,
          },
        };
      }

      // Initialize enhanced agent (now with workflow tools)
      const agentFactory = new QiV2AgentFactory(config);
      await agentFactory.initialize();

      console.log('⚡ Skipping health check for faster startup');

      // Use existing ChatWorkflow - it will automatically benefit from enhanced agent
      console.log('🎯 Creating unified chat workflow...');
      const chatWorkflow = new ChatWorkflow(agentFactory, {
        threadId: options.thread,
        debug: options.debug,
      });

      console.log('▶️  Starting unified chat workflow...');
      await chatWorkflow.start();

    } catch (error) {
      console.error('❌ Failed to start unified chat:', error);
      process.exit(1);
    }
  });
```

### Implementation Benefits

**100% Architecture Reuse:**
- Leverages validated qi-v2 agentFactory patterns
- Maintains all streaming optimizations (token batching, completion detection)
- Preserves 12ms first token performance target
- Reuses existing smart routing infrastructure

**Modern LangChain Integration:**
- Uses latest `tool()` function API (not deprecated DynamicTool)
- Proper Zod schema validation for tool parameters
- Standard LangChain function calling patterns

**Additive Enhancement:**
- No breaking changes to existing functionality
- All current commands (`qi chat`, `qi edit`, etc.) remain unchanged
- New unified interface as `qi unified` command
- Backward compatibility maintained

### Validation Steps

After each implementation step:

```bash
bun run check      # Verify TypeScript compilation and linting
bun run test       # Run test suite
qi unified --debug # Test unified interface
```

### Success Criteria

**v-0.2.6 Milestone Completion:**
- [ ] Natural language commands automatically trigger workflows
- [ ] "Fix bug in auth.ts" → edit_files tool execution
- [ ] "Analyze code complexity" → analyze_code tool execution  
- [ ] "Explain this function" → explain_concept tool execution
- [ ] Regular conversation maintains normal chat behavior
- [ ] All existing performance targets maintained
- [ ] Backward compatibility with all existing commands

### User Experience Transformation

**Before (v-0.2.5):**
```bash
qi chat                                    # Chat mode
qi edit file.ts -m "fix bug"              # Separate command
qi analyze src/                           # Separate command
```

**After (v-0.2.6):**
```bash
qi unified                                # Single unified interface
> Hello, how are you?                     # Regular chat
AI: Hi! I'm ready to help with your code.

> Fix the null check issue in auth.ts
AI: I'll help you fix the null check in auth.ts. Let me analyze and edit the file.
    [Automatically calls edit_files tool]
    ✅ Fixed null check validation in auth.ts on lines 23-25

> What's the complexity of my utils directory?  
AI: I'll analyze the complexity of your utils directory.
    [Automatically calls analyze_code tool]  
    📊 Utils directory analysis: Average complexity 3.2/10...

> Thanks, explain how async/await works
AI: Async/await is a JavaScript feature that... [Regular conversation]
```

This implementation transforms the CLI into a Claude Code-style conversational interface while maintaining all architectural benefits and performance optimizations achieved in v-0.2.4 and v-0.2.5.