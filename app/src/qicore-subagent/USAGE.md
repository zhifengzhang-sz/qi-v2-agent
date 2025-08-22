# QiCore Subagent Workflow - Usage Guide

## 🎯 Overview

This app demonstrates the **optimal workflow** for QiCore compliance analysis using the **main assistant + qicore-specialist collaboration pattern**. It solves the qicore-specialist file access limitation through architectural design while leveraging existing qi-v2-agent infrastructure.

## 🚀 Quick Start

### 1. Installation and Setup

```bash
# Navigate to the app directory
cd app/src/qicore-subagent

# Install dependencies
bun install

# Build the project
bun run build

# Make CLI executable
chmod +x dist/cli/index.js
```

### 2. Run Interactive Demo

```bash
# Start interactive demo to see the workflow in action
bun run demo --interactive

# Or use the built CLI directly
./dist/cli/index.js demo --interactive
```

The demo will analyze known QiCore-compliant modules in the qi-v2-agent codebase and show you the complete workflow.

### 3. Basic Analysis

```bash
# Analyze a specific directory
bun run analyze --target lib/src/context/

# Analyze with specific module type filter
bun run analyze --target lib/src/context/impl/ --type INTERNAL

# Generate detailed report
bun run analyze --target lib/src/state/ --format markdown --output report.md
```

## 📋 Available Commands

### Analysis Commands

```bash
# Analyze target directory
qicore-subagent analyze [options]
  -t, --target <path>      Target directory (default: ./lib/src)
  --type <MODULE_TYPE>     Filter by module type (EXTERNAL | INTERNAL)
  -c, --config <path>      Custom configuration file
  -o, --output <path>      Save report to file
  -f, --format <format>    Report format (markdown | json)
  -d, --debug              Enable debug output
  --dry-run                Show what would be analyzed

# Examples
qicore-subagent analyze --target lib/src/context/
qicore-subagent analyze -t lib/src/state -f json -o results.json
qicore-subagent analyze --target . --type EXTERNAL --debug
```

### Demo Commands

```bash
# Run demo workflow
qicore-subagent demo [options]
  -i, --interactive        Interactive mode with prompts
  -v, --verbose            Detailed output during analysis
  --skip-report            Skip final report generation

# Examples
qicore-subagent demo                    # Quick demo
qicore-subagent demo --interactive      # Interactive with prompts
qicore-subagent demo --verbose          # Detailed output
```

### Report Commands

```bash
# Generate report for existing session
qicore-subagent report <session-id> [options]
  -f, --format <format>    Output format (markdown | json)
  -o, --output <path>      Save to file

# Examples
qicore-subagent report session_123 --format markdown
qicore-subagent report session_456 -f json -o detailed-report.json
```

## 🔧 Configuration

### Default Configuration

The app uses smart defaults based on QiCore patterns:

```typescript
const DEFAULT_CONFIG = {
  targetPatterns: {
    external: ['**/index.ts', '**/abstractions/**/*.ts', '**/interfaces/**/*.ts'],
    internal: ['**/impl/**/*.ts', '**/persistence/**/*.ts', '**/*.internal.ts'],
  },
  focusAreas: {
    external: ['two-layer architecture', 'error transformation', 'clean APIs'],
    internal: ['Result<T> usage', 'functional composition', 'standalone functions'],
  },
  qicoreSpecialist: {
    maxRetries: 3,
    timeoutMs: 30000,
  },
  reporting: {
    formats: ['markdown'],
    includeEvidence: true,
    showLineNumbers: true,
  },
};
```

### Custom Configuration

Create a configuration file for project-specific settings:

```json
{
  "targetPatterns": {
    "external": ["lib/src/*/index.ts", "lib/src/*/abstractions/*.ts"],
    "internal": ["lib/src/*/impl/*.ts", "lib/src/*/persistence/*.ts"]
  },
  "focusAreas": {
    "external": ["two-layer architecture", "error transformation", "clean APIs"],
    "internal": ["Result<T> usage", "functional composition", "performance"]
  },
  "qicoreSpecialist": {
    "maxRetries": 5,
    "timeoutMs": 45000
  },
  "reporting": {
    "formats": ["markdown", "json"],
    "includeEvidence": true,
    "showLineNumbers": true
  }
}
```

Use with: `qicore-subagent analyze --config my-config.json`

## 🏗️ Architecture Deep Dive

### The Core Problem Solved

**Problem**: qicore-specialist subagent cannot read files due to Claude Code CLI limitations
**Solution**: Main assistant handles file operations, provides content to qicore-specialist for analysis

### Workflow Components

#### 1. **File Discovery Service** (Main Assistant)
- Uses native Claude Code tools (Read, LS, Glob)
- Discovers modules matching EXTERNAL/INTERNAL patterns
- Reads file contents and metadata
- Validates file existence and permissions

#### 2. **QiCore Specialist Service** (Hybrid)
- Formats analysis prompts for qicore-specialist
- Applies QiCore pattern analysis (based on our manual verification)
- Parses specialist responses
- Provides compliance scoring

#### 3. **Analysis Orchestrator** (Coordination)
- Uses `QiAsyncMessageQueue` for message-driven coordination
- Manages analysis sessions with `ContextManager`
- Coordinates between discovery, analysis, and reporting phases
- Handles progress tracking and error recovery

#### 4. **Compliance Reporter** (Results)
- Generates comprehensive reports with insights
- Exports to markdown or JSON formats
- Provides actionable recommendations
- Tracks compliance trends

### Message-Driven Architecture

The workflow uses the proven message queue patterns from `qi-prompt.ts`:

```typescript
// Phase 1: Discovery
await messageQueue.sendMessage({
  type: 'QICORE_ANALYSIS_START',
  payload: { targetPath, config },
  priority: 'high'
});

// Phase 2: Analysis (per file)
await messageQueue.sendMessage({
  type: 'QICORE_SPECIALIST_ANALYZE',
  payload: { target: fileTarget },
  priority: 'normal'
});

// Phase 3: Reporting
await messageQueue.sendMessage({
  type: 'QICORE_GENERATE_REPORT',
  payload: { sessionId },
  priority: 'low'
});
```

## 📊 Understanding Results

### Compliance Levels

- **✅ COMPLIANT**: Perfect QiCore pattern usage
- **⚠️ MINOR_VIOLATIONS**: Small issues, easily fixable
- **🚨 MAJOR_VIOLATIONS**: Significant pattern violations
- **💥 CRITICAL_VIOLATIONS**: Fundamental QiCore misuse

### Violation Types

- **METHOD_CHAINING**: Uses `result.match()` instead of `match(onSuccess, onError, result)`
- **TRY_CATCH**: Uses try/catch instead of `fromAsyncTryCatch`
- **DIRECT_ACCESS**: Accesses `.value` or `.error` directly
- **MISSING_RESULT**: Missing Result<T> return types
- **ARCHITECTURE_VIOLATION**: Missing two-layer architecture (EXTERNAL modules)

### Report Sections

1. **Executive Summary**: Overall statistics and compliance distribution
2. **Module Analysis**: Type-specific insights (EXTERNAL vs INTERNAL)
3. **Common Violations**: Patterns found across multiple modules
4. **Best Practices**: Examples of excellent QiCore usage
5. **Recommendations**: Specific actions to improve compliance
6. **Next Steps**: Prioritized improvement roadmap

## 🎓 Educational Examples

### Example 1: Analyzing Context Module

```bash
# Analyze the context module (known to be highly compliant)
qicore-subagent analyze --target lib/src/context/ --debug
```

**Expected Output:**
- High compliance scores (90-95%)
- Examples of excellent standalone function usage
- Demonstration of two-layer architecture
- Minimal violations

### Example 2: Finding Method Chaining Violations

```bash
# Look for method chaining issues across the codebase
qicore-subagent analyze --target lib/src/ --format json | jq '.moduleAnalysis[].commonViolations[] | select(.type == "METHOD_CHAINING")'
```

### Example 3: Comparing Module Types

```bash
# Analyze external modules
qicore-subagent analyze --target lib/src/context/ --type EXTERNAL --output external-report.md

# Analyze internal modules  
qicore-subagent analyze --target lib/src/context/impl/ --type INTERNAL --output internal-report.md

# Compare the different patterns and compliance expectations
```

## 🔍 Debugging and Troubleshooting

### Debug Mode

Enable debug output to see the workflow in detail:

```bash
qicore-subagent analyze --target lib/src/context/ --debug
```

Debug output includes:
- File discovery progress
- Analysis phase transitions
- Message queue activity
- Error details and retry attempts

### Common Issues

#### 1. **File Access Errors**
```
Error: FILE_NOT_FOUND: File not found: /path/to/file
```
**Solution**: Ensure target path exists and is readable

#### 2. **Configuration Issues**
```
Error: CONFIG_NOT_FOUND: Configuration file not found
```
**Solution**: Check config file path or omit --config to use defaults

#### 3. **Analysis Timeout**
```
Error: ANALYSIS_TIMEOUT: qicore-specialist analysis timed out after 30000ms
```
**Solution**: Increase timeout in config or use --debug to see where it's stuck

#### 4. **Empty Results**
```
Warning: No files found matching patterns
```
**Solution**: Check target patterns in config match your project structure

### Dry Run Mode

Test your configuration without running analysis:

```bash
qicore-subagent analyze --target lib/src/context/ --dry-run
```

## 🚀 Advanced Usage

### Custom Analysis Workflows

#### 1. **Pre-commit QiCore Check**

```bash
#!/bin/bash
# .git/hooks/pre-commit

# Run QiCore analysis on staged files
STAGED_TS_FILES=$(git diff --cached --name-only --diff-filter=ACMR | grep '\.ts$')

if [ -n "$STAGED_TS_FILES" ]; then
    echo "Running QiCore compliance check..."
    
    for file in $STAGED_TS_FILES; do
        # Analyze individual file
        qicore-subagent analyze --target $(dirname "$file") --format json > /tmp/qicore-check.json
        
        # Check for critical violations
        CRITICAL=$(jq '.summary.complianceDistribution.criticalViolations' /tmp/qicore-check.json)
        
        if [ "$CRITICAL" -gt 0 ]; then
            echo "❌ Critical QiCore violations found in $file"
            echo "Run: qicore-subagent analyze --target $(dirname "$file") --debug"
            exit 1
        fi
    done
    
    echo "✅ QiCore compliance check passed"
fi
```

#### 2. **CI/CD Integration**

```yaml
# .github/workflows/qicore-compliance.yml
name: QiCore Compliance Check

on: [push, pull_request]

jobs:
  qicore-analysis:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        
      - name: Install dependencies
        run: bun install
        
      - name: Run QiCore analysis
        run: |
          cd app/src/qicore-subagent
          bun run analyze --target ../../../lib/src/ --format json --output qicore-report.json
          
      - name: Check compliance
        run: |
          CRITICAL=$(jq '.summary.complianceDistribution.criticalViolations' qicore-report.json)
          MAJOR=$(jq '.summary.complianceDistribution.majorViolations' qicore-report.json)
          
          if [ "$CRITICAL" -gt 0 ]; then
            echo "❌ Critical QiCore violations found"
            exit 1
          elif [ "$MAJOR" -gt 5 ]; then
            echo "⚠️ Too many major violations ($MAJOR)"
            exit 1
          fi
          
          echo "✅ QiCore compliance acceptable"
          
      - name: Upload report
        uses: actions/upload-artifact@v3
        with:
          name: qicore-compliance-report
          path: qicore-report.json
```

#### 3. **Team Compliance Dashboard**

```bash
#!/bin/bash
# Generate team compliance dashboard

# Analyze all major modules
modules=("context" "state" "messaging" "tools")
date=$(date +%Y-%m-%d)
dashboard_file="qicore-dashboard-$date.md"

echo "# QiCore Team Compliance Dashboard - $date" > $dashboard_file
echo "" >> $dashboard_file

for module in "${modules[@]}"; do
    echo "## $module Module" >> $dashboard_file
    
    qicore-subagent analyze --target lib/src/$module/ --format markdown >> $dashboard_file
    echo "" >> $dashboard_file
done

echo "Dashboard generated: $dashboard_file"
```

## 🎯 Benefits of This Workflow

### 1. **Solves Real Problems**
- ✅ Works around qicore-specialist file access limitations
- ✅ Provides accurate QiCore compliance analysis
- ✅ Integrates with existing development workflows

### 2. **Educational Value**
- ✅ Shows optimal main assistant + specialist collaboration
- ✅ Demonstrates architectural patterns for subagent limitations
- ✅ Provides working examples of QiCore best practices

### 3. **Production Ready**
- ✅ Handles errors gracefully with QiCore Result<T> patterns
- ✅ Provides detailed reporting and actionable insights
- ✅ Scales to large codebases with message-driven architecture

### 4. **Extensible Design**
- ✅ Easy to add new analysis types
- ✅ Configurable for different project needs
- ✅ Template for future subagent integrations

## 🤝 Contributing

This app serves as a reference implementation for optimal Claude Code subagent workflows. Key areas for enhancement:

1. **Analysis Patterns**: Add new QiCore violation detection rules
2. **Reporting**: Enhance report formats and visualizations  
3. **Integration**: Add support for more CI/CD platforms
4. **Performance**: Optimize analysis for very large codebases
5. **Configuration**: Add YAML config support and more customization options

## 📚 Related Documentation

- **QiCore Framework**: See `qi-v2-qicore/typescript/docs/` for QiCore patterns
- **qi-v2-agent Architecture**: See `lib/src/` for infrastructure modules used
- **Claude Code CLI**: See `.claude/` for subagent configurations
- **Message Queue**: See `lib/src/messaging/` for queue implementation details

This workflow demonstrates that limitations can become features when approached with thoughtful architectural design. The "file access problem" led us to build a more robust, scalable, and educational solution than what pure qicore-specialist access would have provided.