#!/usr/bin/env node
/**
 * QiCore Subagent CLI
 * 
 * Command-line interface for the QiCore compliance analysis workflow.
 * Demonstrates optimal main assistant + qicore-specialist collaboration.
 */

import { parseArgs } from 'node:util';
import { join, resolve } from 'node:path';
import {
  create,
  match,
  success,
  type QiError,
  type Result,
} from '../utils/result';
import type {
  AnalysisCliOptions,
  AnalysisConfig,
  ComplianceReport,
  DemoOptions,
} from '../types/index';
import { QiCoreAnalysisOrchestrator } from '../orchestrator/QiCoreAnalysisOrchestrator';
import { ComplianceReporter } from '../services/ComplianceReporter';

// CLI Error factory
const cliError = {
  invalidTarget: (target: string): QiError =>
    create('INVALID_TARGET', `Invalid target path: ${target}`, 'VALIDATION', { target }),
  
  configNotFound: (configPath: string): QiError =>
    create('CONFIG_NOT_FOUND', `Configuration file not found: ${configPath}`, 'SYSTEM', { configPath }),
  
  analysisFailed: (reason: string): QiError =>
    create('ANALYSIS_FAILED', `Analysis failed: ${reason}`, 'SYSTEM', { reason }),
};

// Default analysis configuration
const DEFAULT_CONFIG: AnalysisConfig = {
  targetPatterns: {
    external: ['**/index.ts', '**/abstractions/**/*.ts', '**/interfaces/**/*.ts'],
    internal: ['**/impl/**/*.ts', '**/persistence/**/*.ts', '**/*.internal.ts'],
  },
  focusAreas: {
    external: ['two-layer architecture', 'error transformation', 'clean APIs', 'backward compatibility'],
    internal: ['Result<T> usage', 'functional composition', 'performance optimization', 'standalone functions'],
  },
  qicoreSpecialist: {
    promptTemplate: 'qicore-compliance-analysis',
    maxRetries: 3,
    timeoutMs: 30000,
  },
  reporting: {
    formats: ['markdown'],
    includeEvidence: true,
    showLineNumbers: true,
  },
};

class QiCoreAnalysisCLI {
  private orchestrator: QiCoreAnalysisOrchestrator;
  private reporter: ComplianceReporter;

  constructor() {
    this.orchestrator = new QiCoreAnalysisOrchestrator();
    this.reporter = new ComplianceReporter();
  }

  async run(): Promise<void> {
    try {
      const { values, positionals } = parseArgs({
        args: process.argv.slice(2),
        options: {
          target: { type: 'string', short: 't' },
          type: { type: 'string' },
          config: { type: 'string', short: 'c' },
          output: { type: 'string', short: 'o' },
          format: { type: 'string', short: 'f' },
          debug: { type: 'boolean', short: 'd' },
          'dry-run': { type: 'boolean' },
          interactive: { type: 'boolean', short: 'i' },
          verbose: { type: 'boolean', short: 'v' },
          'skip-report': { type: 'boolean' },
          help: { type: 'boolean', short: 'h' },
        },
        allowPositionals: true,
      });

      if (values.help) {
        this.showHelp();
        return;
      }

      const command = positionals[0];
      
      switch (command) {
        case 'analyze':
          await this.handleAnalyze({
            target: values.target || positionals[1] || './lib/src',
            type: values.type as any,
            config: values.config,
            output: values.output,
            format: values.format as any,
            debug: values.debug,
            dryRun: values['dry-run'],
          });
          break;
          
        case 'demo':
          await this.handleDemo({
            interactive: values.interactive,
            verbose: values.verbose,
            skipReport: values['skip-report'],
          });
          break;
          
        case 'report':
          await this.handleReport(positionals[1], values.format as any, values.output);
          break;
          
        default:
          if (!command) {
            await this.handleDemo({ interactive: true });
          } else {
            console.error(`Unknown command: ${command}`);
            this.showHelp();
            process.exit(1);
          }
      }
    } catch (error) {
      console.error('CLI Error:', error);
      process.exit(1);
    }
  }

  private async handleAnalyze(options: AnalysisCliOptions): Promise<void> {
    console.log('🔍 Starting QiCore compliance analysis...\n');
    
    if (options.debug) {
      console.log('Analysis options:', JSON.stringify(options, null, 2));
    }

    // Resolve target path
    const targetPath = resolve(options.target);
    console.log(`📂 Target: ${targetPath}`);

    // Load configuration
    const config = await this.loadConfig(options.config);
    
    if (options.dryRun) {
      console.log('\n🏃 Dry run mode - would analyze:');
      console.log(`   Target: ${targetPath}`);
      console.log(`   Module type: ${options.type || 'ALL'}`);
      console.log(`   Output: ${options.output || 'console'}`);
      return;
    }

    // Initialize orchestrator
    const initResult = await this.orchestrator.initialize();
    match(
      () => console.log('✅ Orchestrator initialized'),
      (error) => { throw error; },
      initResult
    );

    try {
      // Start analysis
      const sessionId = await this.orchestrator.startAnalysis(targetPath, config);
      console.log(`🚀 Analysis started (Session: ${sessionId})\n`);

      // Wait for completion with progress updates
      await this.waitForCompletion(sessionId, options.debug);

      // Generate and display report
      if (options.output || !options.format || options.format === 'markdown') {
        await this.generateAndShowReport(sessionId, options.format, options.output);
      }

    } finally {
      // Cleanup
      const shutdownResult = await this.orchestrator.shutdown();
      match(
        () => options.debug && console.log('🔧 Orchestrator shutdown'),
        (error) => console.warn('Shutdown warning:', error),
        shutdownResult
      );
    }
  }

  private async handleDemo(options: DemoOptions): Promise<void> {
    console.log('🎯 QiCore Subagent Workflow Demo\n');
    console.log('This demonstrates the optimal main assistant + qicore-specialist collaboration.\n');

    if (options.interactive) {
      console.log('📋 Demo will analyze the following targets:');
      console.log('   1. lib/src/context/ (EXTERNAL modules)');
      console.log('   2. lib/src/context/impl/ (INTERNAL modules)');
      console.log('   3. lib/src/state/persistence/ (INTERNAL modules)\n');

      // Simple interactive prompt
      process.stdout.write('Continue with demo? (y/n): ');
      process.stdin.setRawMode(true);
      process.stdin.resume();
      
      const userInput = await new Promise<string>((resolve) => {
        process.stdin.once('data', (data) => {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          resolve(data.toString().trim().toLowerCase());
        });
      });

      if (userInput !== 'y' && userInput !== 'yes') {
        console.log('Demo cancelled.');
        return;
      }
    }

    // Run demo analysis on known good targets (absolute paths to qi-v2-agent lib)
    const qiAgentRoot = resolve(join(process.cwd(), '../../../'));
    const demoTargets = [
      join(qiAgentRoot, 'lib/src/context'),
      join(qiAgentRoot, 'lib/src/state/persistence'),
    ];

    for (const target of demoTargets) {
      console.log(`\n🔍 Analyzing: ${target}`);
      
      try {
        await this.handleAnalyze({
          target,
          format: 'markdown',
          debug: options.verbose,
          dryRun: false,
        });
      } catch (error) {
        console.warn(`⚠️  Demo target ${target} failed:`, error);
      }
    }

    if (!options.skipReport) {
      console.log('\n📊 Demo completed! Check the generated reports above.');
      console.log('\n💡 Key workflow benefits demonstrated:');
      console.log('   ✅ Main assistant handles file discovery');
      console.log('   ✅ qicore-specialist provides analysis expertise');
      console.log('   ✅ Optimal collaboration around file access limitations');
      console.log('   ✅ Structured reporting with evidence');
    }
  }

  private async handleReport(sessionId: string, format?: 'markdown' | 'json', output?: string): Promise<void> {
    if (!sessionId) {
      throw cliError.analysisFailed('Session ID required for report generation');
    }

    console.log(`📊 Generating report for session: ${sessionId}`);

    const session = await this.orchestrator.getSession(sessionId);
    if (!session) {
      throw cliError.analysisFailed(`Session not found: ${sessionId}`);
    }

    const report = await this.reporter.generateReport(session);
    const reportContent = await this.reporter.exportReport(report, format || 'markdown');

    if (output) {
      const outputPath = resolve(output);
      await import('node:fs/promises').then(fs => fs.writeFile(outputPath, reportContent, 'utf-8'));
      console.log(`✅ Report saved to: ${outputPath}`);
    } else {
      console.log('\n' + reportContent);
    }
  }

  private async loadConfig(configPath?: string): Promise<AnalysisConfig> {
    if (!configPath) {
      return DEFAULT_CONFIG;
    }

    try {
      const resolvedPath = resolve(configPath);
      const content = await import('node:fs/promises').then(fs => fs.readFile(resolvedPath, 'utf-8'));
      
      if (configPath.endsWith('.json')) {
        return JSON.parse(content);
      } else if (configPath.endsWith('.yaml') || configPath.endsWith('.yml')) {
        // For YAML support, we'd need a YAML parser
        console.warn('YAML config support not implemented, using default config');
        return DEFAULT_CONFIG;
      } else {
        throw cliError.configNotFound(`Unsupported config format: ${configPath}`);
      }
    } catch (error) {
      console.warn(`Config loading failed: ${String(error)}, using default config`);
      return DEFAULT_CONFIG;
    }
  }

  private async waitForCompletion(sessionId: string, debug: boolean = false): Promise<void> {
    const maxWaitTime = 300000; // 5 minutes
    const checkInterval = 2000; // 2 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const session = await this.orchestrator.getSession(sessionId);
      if (!session) {
        throw cliError.analysisFailed(`Session lost: ${sessionId}`);
      }

      if (debug) {
        console.log(`⏳ Progress: ${session.completedTargets}/${session.totalTargets} targets`);
      }

      if (session.status === 'COMPLETED') {
        console.log(`✅ Analysis completed! (${session.completedTargets} targets analyzed)`);
        return;
      } else if (session.status === 'FAILED') {
        throw cliError.analysisFailed('Analysis session failed');
      } else if (session.status === 'CANCELLED') {
        throw cliError.analysisFailed('Analysis session was cancelled');
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    throw cliError.analysisFailed('Analysis timed out');
  }

  private async generateAndShowReport(sessionId: string, format?: 'markdown' | 'json', output?: string): Promise<void> {
    console.log('\n📊 Generating compliance report...');

    const session = await this.orchestrator.getSession(sessionId);
    if (!session) {
      throw cliError.analysisFailed(`Session not found: ${sessionId}`);
    }

    const report = await this.reporter.generateReport(session);
    const reportContent = await this.reporter.exportReport(report, format || 'markdown');

    if (output) {
      const outputPath = resolve(output);
      await import('node:fs/promises').then(fs => fs.writeFile(outputPath, reportContent, 'utf-8'));
      console.log(`✅ Report saved to: ${outputPath}`);
    } else {
      console.log('\n' + '='.repeat(80));
      console.log('📋 QICORE COMPLIANCE REPORT');
      console.log('='.repeat(80));
      console.log(reportContent);
      console.log('='.repeat(80));
    }
  }

  private showHelp(): void {
    console.log(`
🎯 QiCore Subagent Workflow CLI

USAGE:
  qicore-subagent [command] [options]

COMMANDS:
  analyze [target]     Analyze target path for QiCore compliance
  demo                 Run interactive demo of the workflow
  report <session-id>  Generate report for completed analysis
  help                 Show this help message

ANALYZE OPTIONS:
  -t, --target <path>      Target directory to analyze (default: ./lib/src)
  --type <MODULE_TYPE>     Module type filter (EXTERNAL | INTERNAL)
  -c, --config <path>      Configuration file path
  -o, --output <path>      Output file for report
  -f, --format <format>    Report format (markdown | json)
  -d, --debug              Enable debug output
  --dry-run                Show what would be analyzed without running

DEMO OPTIONS:
  -i, --interactive        Interactive demo mode
  -v, --verbose            Verbose output during demo
  --skip-report            Skip final report generation

EXAMPLES:
  # Run interactive demo
  qicore-subagent demo --interactive

  # Analyze context module
  qicore-subagent analyze --target lib/src/context/

  # Analyze with custom config and save report
  qicore-subagent analyze -t lib/src/state -c config.json -o report.md

  # Generate report for existing session
  qicore-subagent report session_123 --format json --output results.json

WORKFLOW:
  This CLI demonstrates the optimal main assistant + qicore-specialist 
  collaboration pattern for QiCore compliance analysis, solving the 
  file access limitation through architectural design.
`);
  }
}

// CLI Entry Point
if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = new QiCoreAnalysisCLI();
  cli.run().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { QiCoreAnalysisCLI };