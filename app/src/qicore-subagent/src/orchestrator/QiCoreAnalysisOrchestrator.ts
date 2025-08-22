/**
 * QiCore Analysis Orchestrator
 * 
 * Main orchestrator using verified patterns from manual analysis.
 * Integrates with existing ContextManager, QiAsyncMessageQueue, and StateManager
 * to coordinate the optimal main assistant + qicore-specialist workflow.
 */

import { randomUUID } from 'node:crypto';
import {
  create,
  failure,
  flatMap,
  fromAsyncTryCatch,
  match,
  type QiError,
  type Result,
  success,
} from '../utils/result';
import { SimpleContextManager, createDefaultAppContext } from '../utils/context';
import { SimpleMessageQueue } from '../utils/messaging';
import type { QiMessage } from '../utils/messaging';
import type {
  AnalysisConfig,
  AnalysisMessage,
  AnalysisSession,
  AnalysisTarget,
  ComplianceResult,
  IAnalysisOrchestrator,
  SessionSummary,
} from '../types/index';
import { FileDiscoveryService } from '../services/FileDiscoveryService';
import { QiCoreSpecialistService } from '../services/QiCoreSpecialistService';

// Error factory for orchestrator operations
const orchestratorError = {
  sessionNotFound: (sessionId: string): QiError =>
    create('SESSION_NOT_FOUND', `Analysis session not found: ${sessionId}`, 'VALIDATION', { sessionId }),
  
  sessionAlreadyRunning: (sessionId: string): QiError =>
    create('SESSION_ALREADY_RUNNING', `Analysis session already running: ${sessionId}`, 'BUSINESS', { sessionId }),
  
  invalidTargetPath: (targetPath: string): QiError =>
    create('INVALID_TARGET_PATH', `Invalid target path: ${targetPath}`, 'VALIDATION', { targetPath }),
  
  orchestrationFailed: (sessionId: string, phase: string, cause: string): QiError =>
    create('ORCHESTRATION_FAILED', `Analysis orchestration failed in ${phase}: ${cause}`, 'SYSTEM', { 
      sessionId, 
      phase, 
      cause 
    }),
};

// Configuration helper using verified pattern from qi-prompt.ts
interface AppConfigHelper {
  getOr: (path: string, defaultValue: any) => any;
}

const createAppConfigHelper = (stateManager: any): AppConfigHelper => ({
  getOr: (path: string, defaultValue: any) => {
    try {
      const config = stateManager?.getConfig?.() || {};
      const keys = path.split('.');
      
      // Handle QiCore-specific configuration paths
      if (keys[0] === 'qicore') {
        if (keys[1] === 'analysis') {
          if (keys[2] === 'patterns') {
            if (keys[3] === 'external') {
              return ['**/index.ts', '**/abstractions/**/*.ts', '**/interfaces/**/*.ts'];
            }
            if (keys[3] === 'internal') {
              return ['**/impl/**/*.ts', '**/persistence/**/*.ts', '**/*.internal.ts'];
            }
          }
          if (keys[2] === 'focus_areas') {
            if (keys[3] === 'external') {
              return ['two-layer architecture', 'error transformation', 'clean APIs', 'backward compatibility'];
            }
            if (keys[3] === 'internal') {
              return ['Result<T> usage', 'functional composition', 'performance optimization', 'standalone functions'];
            }
          }
          if (keys[2] === 'specialist') {
            if (keys[3] === 'timeout_ms') return 30000;
            if (keys[3] === 'max_retries') return 3;
          }
        }
      }
      
      return defaultValue;
    } catch {
      return defaultValue;
    }
  },
});

export class QiCoreAnalysisOrchestrator implements IAnalysisOrchestrator {
  private readonly contextManager: SimpleContextManager;
  private readonly messageQueue: SimpleMessageQueue;
  private readonly fileDiscovery: FileDiscoveryService;
  private readonly qicoreSpecialist: QiCoreSpecialistService;
  private readonly configHelper: AppConfigHelper;
  private readonly sessions = new Map<string, AnalysisSession>();
  
  constructor(stateManager?: any) {
    // Initialize context manager using simplified pattern
    const appContext = createDefaultAppContext();
    this.contextManager = new SimpleContextManager();
    
    // Initialize message queue using simplified pattern
    this.messageQueue = new SimpleMessageQueue({
      maxConcurrent: 1, // Sequential processing as per qi-prompt.ts
      priorityQueuing: true,
      autoCleanup: true,
      enableStats: true,
      messageTtl: 300000, // 5 minutes
    });
    
    // Initialize config helper using verified pattern
    this.configHelper = createAppConfigHelper(stateManager);
    
    // Initialize services
    this.fileDiscovery = new FileDiscoveryService();
    this.qicoreSpecialist = new QiCoreSpecialistService(
      this.configHelper.getOr('qicore.analysis.specialist.max_retries', 3),
      this.configHelper.getOr('qicore.analysis.specialist.timeout_ms', 30000)
    );
    
    // Set up message handling
    this.setupMessageHandlers();
  }

  async initialize(): Promise<Result<void, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        // Initialize context manager using verified pattern
        await this.contextManager.initialize();
        
        // Start message queue processing
        await this.messageQueue.start();
        
        return undefined;
      },
      (error) => create(
        'ORCHESTRATOR_INIT_FAILED',
        `Failed to initialize QiCore analysis orchestrator: ${String(error)}`,
        'SYSTEM',
        { error: String(error) }
      )
    );
  }

  async startAnalysis(targetPath: string, config: AnalysisConfig): Promise<string> {
    return fromAsyncTryCatch(
      async () => {
        // Validate target path
        const pathExists = await this.fileDiscovery.validateFileExists(targetPath);
        if (!pathExists) {
          throw orchestratorError.invalidTargetPath(targetPath);
        }
        
        // Create new session
        const sessionId = `qicore_analysis_${randomUUID()}`;
        
        // Create conversation context using verified API
        const contextResult = this.contextManager.createConversationContext('sub-agent');
        const conversationContext = match(
          (context) => context,
          (error) => { throw error; },
          contextResult
        );
        
        // Initialize session
        const session: AnalysisSession = {
          sessionId,
          contextId: conversationContext.id,
          startTime: new Date(),
          status: 'RUNNING',
          targetPath,
          totalTargets: 0,
          completedTargets: 0,
          results: [],
          config,
        };
        
        this.sessions.set(sessionId, session);
        
        // Start analysis workflow with message queue
        await this.sendAnalysisMessage({
          type: 'QICORE_ANALYSIS_START',
          sessionId,
          payload: { targetPath, config },
          timestamp: new Date(),
          priority: 'high',
        });
        
        return sessionId;
      },
      (error) => create(
        'START_ANALYSIS_FAILED',
        `Failed to start QiCore analysis: ${String(error)}`,
        'SYSTEM',
        { targetPath, error: String(error) }
      )
    ).then(result => match(
      (sessionId) => sessionId,
      (error) => { throw error; },
      result
    ));
  }

  async getSession(sessionId: string): Promise<AnalysisSession | null> {
    return Promise.resolve(this.sessions.get(sessionId) || null);
  }

  async getSessionSummary(sessionId: string): Promise<SessionSummary | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    
    const overallScore = session.results.length > 0 
      ? session.results.reduce((sum, r) => sum + r.score, 0) / session.results.length
      : 0;
    
    const duration = session.endTime 
      ? session.endTime.getTime() - session.startTime.getTime()
      : Date.now() - session.startTime.getTime();
    
    return {
      sessionId,
      targetPath: session.targetPath,
      totalTargets: session.totalTargets,
      overallCompliance: this.calculateOverallCompliance(session.results),
      averageScore: overallScore,
      duration,
      timestamp: session.startTime,
    };
  }

  async cancelAnalysis(sessionId: string): Promise<void> {
    return fromAsyncTryCatch(
      async () => {
        const session = this.sessions.get(sessionId);
        if (!session) {
          throw orchestratorError.sessionNotFound(sessionId);
        }
        
        // Update session status
        session.status = 'CANCELLED';
        session.endTime = new Date();
        
        // Send cancellation message
        await this.sendAnalysisMessage({
          type: 'QICORE_SESSION_UPDATE',
          sessionId,
          payload: { status: 'CANCELLED' },
          timestamp: new Date(),
          priority: 'high',
        });
        
        return undefined;
      },
      (error) => create(
        'CANCEL_ANALYSIS_FAILED',
        `Failed to cancel analysis session ${sessionId}: ${String(error)}`,
        'SYSTEM',
        { sessionId, error: String(error) }
      )
    ).then(result => match(
      () => {},
      (error) => { throw error; },
      result
    ));
  }

  async listSessions(): Promise<SessionSummary[]> {
    const summaries: SessionSummary[] = [];
    
    for (const [sessionId] of this.sessions) {
      const summary = await this.getSessionSummary(sessionId);
      if (summary) {
        summaries.push(summary);
      }
    }
    
    // Sort by timestamp, newest first
    return summaries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Private implementation methods

  private setupMessageHandlers(): void {
    // Handle different phases of the analysis workflow
    this.messageQueue.registerHandler('QICORE_ANALYSIS_START', {
      handle: async (message) => this.handleAnalysisStart(message),
    });
    
    this.messageQueue.registerHandler('QICORE_DISCOVERY_REQUEST', {
      handle: async (message) => this.handleDiscoveryRequest(message),
    });
    
    this.messageQueue.registerHandler('QICORE_SPECIALIST_ANALYZE', {
      handle: async (message) => this.handleSpecialistAnalyze(message),
    });
  }

  private async sendAnalysisMessage(message: AnalysisMessage): Promise<void> {
    // Convert our AnalysisMessage to QiMessage format for the queue
    const qiMessage: QiMessage = {
      id: randomUUID(),
      type: message.type,
      payload: message.payload,
      timestamp: message.timestamp,
      priority: this.mapPriority(message.priority),
      retryCount: 0,
    };
    
    const result = await this.messageQueue.sendMessage(qiMessage);
    match(
      () => {}, // Success - no action needed
      (error) => { throw error; },
      result
    );
  }

  private async handleAnalysisStart(message: QiMessage): Promise<Result<void, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        const { sessionId, payload } = message;
        const { targetPath, config } = payload as { targetPath: string; config: AnalysisConfig };
        
        // Phase 1: File Discovery (main assistant capability)
        const targets = await this.fileDiscovery.discoverModules(targetPath, config);
        
        // Update session with discovered targets
        const session = this.sessions.get(sessionId);
        if (session) {
          session.totalTargets = targets.length;
          this.sessions.set(sessionId, session);
        }
        
        // Phase 2: Queue analysis tasks for each target
        for (const target of targets) {
          await this.sendAnalysisMessage({
            type: 'QICORE_SPECIALIST_ANALYZE',
            sessionId,
            payload: { target },
            timestamp: new Date(),
            priority: 'normal',
          });
        }
        
        return undefined;
      },
      (error) => orchestratorError.orchestrationFailed(
        message.payload.sessionId,
        'analysis_start',
        String(error)
      )
    );
  }

  private async handleDiscoveryRequest(message: QiMessage): Promise<Result<void, QiError>> {
    return success(undefined); // Placeholder for discovery phase
  }

  private async handleSpecialistAnalyze(message: QiMessage): Promise<Result<void, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        const { sessionId, payload } = message;
        const { target } = payload as { target: AnalysisTarget };
        
        // Use main assistant file access to read content
        const fileContent = await this.fileDiscovery.readFileContents(target.filePath);
        
        // Get config for this session
        const session = this.sessions.get(sessionId);
        if (!session) {
          throw orchestratorError.sessionNotFound(sessionId);
        }
        
        // Analyze with qicore-specialist service
        const analysisResult = await this.qicoreSpecialist.analyzeCode(
          fileContent,
          target.moduleType,
          session.config
        );
        
        // Update session with result
        session.results = [...session.results, analysisResult];
        session.completedTargets = session.results.length;
        
        // Check if analysis is complete
        if (session.completedTargets >= session.totalTargets) {
          session.status = 'COMPLETED';
          session.endTime = new Date();
        }
        
        this.sessions.set(sessionId, session);
        
        return undefined;
      },
      (error) => orchestratorError.orchestrationFailed(
        message.payload.sessionId,
        'specialist_analyze',
        String(error)
      )
    );
  }

  private mapPriority(priority: 'low' | 'normal' | 'high' | 'critical'): number {
    const priorityMap = { low: 1, normal: 2, high: 3, critical: 4 };
    return priorityMap[priority];
  }

  private calculateOverallCompliance(results: readonly ComplianceResult[]): any {
    if (results.length === 0) return 'NOT_ANALYZED';
    
    const criticalCount = results.filter(r => r.complianceLevel === 'CRITICAL_VIOLATIONS').length;
    const majorCount = results.filter(r => r.complianceLevel === 'MAJOR_VIOLATIONS').length;
    const minorCount = results.filter(r => r.complianceLevel === 'MINOR_VIOLATIONS').length;
    const compliantCount = results.filter(r => r.complianceLevel === 'COMPLIANT').length;
    
    if (criticalCount > 0) return 'CRITICAL_VIOLATIONS';
    if (majorCount > results.length / 2) return 'MAJOR_VIOLATIONS';
    if (minorCount > compliantCount) return 'MINOR_VIOLATIONS';
    return 'COMPLIANT';
  }

  async shutdown(): Promise<Result<void, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        // Stop message queue processing
        await this.messageQueue.stop();
        
        // Shutdown context manager using verified pattern
        await this.contextManager.shutdown();
        
        return undefined;
      },
      (error) => create(
        'ORCHESTRATOR_SHUTDOWN_FAILED',
        `Failed to shutdown QiCore analysis orchestrator: ${String(error)}`,
        'SYSTEM',
        { error: String(error) }
      )
    );
  }
}