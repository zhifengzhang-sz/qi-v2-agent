/**
 * Tool-based Context Manager
 * 
 * Context manager that uses the toolbox architecture instead of built-in implementations.
 * Replaces ClaudeCodeContextManager with proper functional design.
 */

import { randomUUID } from 'node:crypto';
import type { 
  AppContext, 
  ContextMessage, 
  ConversationContext 
} from '../abstractions/index.js';
import { ContextManager } from './ContextManager.js';
import type { 
  ToolRegistry,
  FileContentResolver,
  ProjectStructureScanner,
  FileReferenceParser,
  SessionManager,
  Session,
  FileReference,
  ProjectContext,
} from '../../tools/index.js';
import type { SimpleWorkflowClass } from '../../workflows/index.js';

/**
 * Context manager configuration using toolbox architecture
 */
export interface ToolbasedContextConfig {
  readonly enableFileReferences: boolean;
  readonly enableProjectDiscovery: boolean;
  readonly enableSessionPersistence: boolean;
  readonly enableContextAwarePrompting: boolean;
  readonly maxContextWindow: number;
  readonly maxFilesPerSession: number;
  readonly maxFileSize: number;
  readonly sessionStoragePath: string;
  readonly projectMemoryFileName: string;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ToolbasedContextConfig = {
  enableFileReferences: true,
  enableProjectDiscovery: true,
  enableSessionPersistence: true,
  enableContextAwarePrompting: true,
  maxContextWindow: 8000,
  maxFilesPerSession: 20,
  maxFileSize: 1024 * 1024, // 1MB
  sessionStoragePath: '.claude-sessions',
  projectMemoryFileName: 'CLAUDE.md',
};

/**
 * Tool-based Context Manager
 * 
 * Uses toolbox architecture for context management operations.
 */
export class ToolbasedContextManager extends ContextManager {
  private config: ToolbasedContextConfig;
  private toolRegistry: ToolRegistry;
  private currentProjectContext?: ProjectContext;
  private activeSessionId?: string;

  constructor(
    initialAppContext: AppContext,
    toolRegistry: ToolRegistry,
    config: Partial<ToolbasedContextConfig> = {}
  ) {
    super(initialAppContext);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.toolRegistry = toolRegistry;
  }

  async initialize(): Promise<void> {
    await super.initialize();

    // Initialize session manager if enabled
    if (this.config.enableSessionPersistence) {
      const sessionManager = this.toolRegistry.get<SessionManager>('session-manager');
      if (sessionManager) {
        await sessionManager.initialize();
      }
    }

    // Discover project context if enabled
    if (this.config.enableProjectDiscovery) {
      await this.discoverProjectContext();
    }
  }

  async shutdown(): Promise<void> {
    // Save any pending session data
    if (this.config.enableSessionPersistence) {
      const sessionManager = this.toolRegistry.get<SessionManager>('session-manager');
      if (sessionManager) {
        await sessionManager.saveSessions();
      }
    }

    await super.shutdown();
  }

  /**
   * Start a new conversation session
   */
  async startNewConversation(title: string): Promise<Session> {
    if (!this.config.enableSessionPersistence) {
      throw new Error('Session persistence is not enabled');
    }

    const sessionManager = this.toolRegistry.get<SessionManager>('session-manager');
    if (!sessionManager) {
      throw new Error('SessionManager tool not available');
    }

    const appContext = this.getApplicationContext();
    const session = await sessionManager.createSession(title, appContext.currentDirectory);
    this.activeSessionId = session.id;
    
    return session;
  }

  /**
   * Get the current active session
   */
  getCurrentSession(): Session | null {
    if (!this.activeSessionId) return null;

    const sessionManager = this.toolRegistry.get<SessionManager>('session-manager');
    if (!sessionManager) return null;

    return sessionManager.getSession(this.activeSessionId);
  }

  /**
   * Add a file reference to the current session
   */
  async addFileReference(filePath: string): Promise<boolean> {
    if (!this.activeSessionId || !this.config.enableFileReferences) {
      return false;
    }

    const sessionManager = this.toolRegistry.get<SessionManager>('session-manager');
    if (!sessionManager) return false;

    return sessionManager.addFileReference(this.activeSessionId, filePath);
  }

  /**
   * Process file references in a message and enhance with content
   */
  async processFileReferencesInMessage(message: string): Promise<{
    originalMessage: string;
    enhancedMessage: string;
    filesReferenced: FileReference[];
    hasReferences: boolean;
  }> {
    if (!this.config.enableFileReferences) {
      return {
        originalMessage: message,
        enhancedMessage: message,
        filesReferenced: [],
        hasReferences: false,
      };
    }

    // Parse file references
    const parser = this.toolRegistry.get<FileReferenceParser>('file-reference-parser');
    if (!parser) {
      return {
        originalMessage: message,
        enhancedMessage: message,
        filesReferenced: [],
        hasReferences: false,
      };
    }

    const parseResult = await parser.execute(message);
    if (!parseResult.hasReferences) {
      return {
        originalMessage: message,
        enhancedMessage: message,
        filesReferenced: [],
        hasReferences: false,
      };
    }

    // Resolve file content
    const resolver = this.toolRegistry.get<FileContentResolver>('file-content-resolver');
    if (!resolver) {
      return {
        originalMessage: message,
        enhancedMessage: parseResult.cleanedInput,
        filesReferenced: [],
        hasReferences: true,
      };
    }

    const appContext = this.getApplicationContext();
    const filePaths = parseResult.references.map(ref => ref.filePath);
    const fileReferences = await Promise.all(
      filePaths.map(filePath => resolver.resolveFile(filePath, appContext.currentDirectory))
    );

    // Add to session if we have an active one
    if (this.activeSessionId) {
      for (const filePath of filePaths) {
        await this.addFileReference(filePath);
      }
    }

    // Build enhanced message with file content
    let enhancedMessage = parseResult.cleanedInput;
    const validFiles = fileReferences.filter(ref => ref.exists && ref.content);
    
    if (validFiles.length > 0) {
      enhancedMessage = this.buildEnhancedMessage(parseResult.cleanedInput, validFiles);
    }

    return {
      originalMessage: message,
      enhancedMessage,
      filesReferenced: fileReferences,
      hasReferences: true,
    };
  }

  /**
   * Get context-aware prompt with file references and project context
   */
  async getContextAwarePrompt(sessionId: string, prompt: string): Promise<string> {
    if (!this.config.enableContextAwarePrompting) {
      return prompt;
    }

    let contextAwarePrompt = prompt;

    // Process file references first
    const fileResult = await this.processFileReferencesInMessage(prompt);
    contextAwarePrompt = fileResult.enhancedMessage;

    // Add project context if available
    if (this.currentProjectContext) {
      contextAwarePrompt = this.addProjectContextToPrompt(
        contextAwarePrompt, 
        this.currentProjectContext
      );
    }

    // Add conversation history if session exists
    const sessionManager = this.toolRegistry.get<SessionManager>('session-manager');
    if (sessionManager) {
      const session = sessionManager.getSession(sessionId);
      if (session && session.messages.length > 0) {
        contextAwarePrompt = this.addConversationHistoryToPrompt(
          contextAwarePrompt, 
          session.messages
        );
      }
    }

    return contextAwarePrompt;
  }

  /**
   * Get current project context
   */
  getCurrentProjectContext(): ProjectContext | null {
    return this.currentProjectContext || null;
  }

  /**
   * Get all memory entries (placeholder for now)
   */
  getAllMemories(): Array<{ type: string; path: string; content: string }> {
    // This would be implemented with proper memory tools
    return [];
  }

  /**
   * Discover project context using project scanner tool
   */
  private async discoverProjectContext(): Promise<void> {
    const scanner = this.toolRegistry.get<ProjectStructureScanner>('project-structure-scanner');
    if (!scanner) {
      console.warn('ProjectStructureScanner tool not available');
      return;
    }

    const appContext = this.getApplicationContext();
    const projectRoot = await scanner.findProjectRoot(appContext.currentDirectory);
    
    if (projectRoot) {
      const projectContext = await scanner.discoverProjectContext(projectRoot);
      this.currentProjectContext = projectContext || undefined;
    }
  }

  /**
   * Build enhanced message with file content
   */
  private buildEnhancedMessage(cleanedMessage: string, validFiles: FileReference[]): string {
    let enhanced = '# Referenced Files\n\n';
    
    for (const file of validFiles) {
      enhanced += `## ${file.relativePath}\n`;
      if (file.lastModified) {
        enhanced += `*Last modified: ${file.lastModified.toISOString()}*\n\n`;
      }
      enhanced += '```\n';
      enhanced += file.content || '';
      enhanced += '\n```\n\n';
    }

    enhanced += '# Request\n\n';
    enhanced += cleanedMessage;

    return enhanced;
  }

  /**
   * Add project context to prompt
   */
  private addProjectContextToPrompt(prompt: string, projectContext: ProjectContext): string {
    const projectInfo = `\n\n# Project Context\n\n` +
      `**Project Root:** ${projectContext.root}\n` +
      `**Type:** ${projectContext.metadata.get('projectType') || 'unknown'}\n` +
      `**Config Files:** ${projectContext.configFiles.join(', ')}\n` +
      `**Memory Files:** ${projectContext.memoryFiles.join(', ')}\n\n`;

    return projectInfo + prompt;
  }

  /**
   * Add conversation history to prompt (recent messages only)
   */
  private addConversationHistoryToPrompt(
    prompt: string, 
    messages: readonly ContextMessage[]
  ): string {
    if (messages.length === 0) {
      return prompt;
    }

    // Get last few messages to provide context
    const recentMessages = messages.slice(-3);
    let historySection = '\n\n# Recent Conversation\n\n';
    
    for (const message of recentMessages) {
      historySection += `**${message.role}:** ${message.content.substring(0, 200)}`;
      if (message.content.length > 200) {
        historySection += '...';
      }
      historySection += '\n\n';
    }

    return historySection + '# Current Request\n\n' + prompt;
  }
}