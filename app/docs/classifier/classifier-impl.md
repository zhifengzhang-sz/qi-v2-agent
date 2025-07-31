# Classifier Module - Implementation Guide

## 🎯 Implementation Overview

This guide provides step-by-step instructions for implementing the Classifier module with multiple classification strategies and lib layer integration. The implementation focuses on **rule-based classification** with automatic lib layer detection and graceful fallback.

## 📦 Package Selection and Justification

### Core Dependencies

#### 1. No Heavy Dependencies (By Design)
```json
{
  // Deliberately minimal dependencies for classifier module
  // Only using standard JavaScript/TypeScript features
}
```

**Why minimal dependencies**:
- **Fast Startup**: No package loading overhead
- **Reliability**: Fewer dependency conflicts and version issues
- **Maintainability**: Less surface area for security vulnerabilities
- **Bundle Size**: Smaller footprint for client-side usage

**What we implement ourselves**:
- Pattern matching algorithms
- Statistical calculations
- Configuration management
- Performance monitoring

#### 2. Optional Lib Layer Integration
```typescript
// Dynamic import for lib layer detection
try {
  const libModule = require('@qi/lib')
  if (libModule?.InputClassifier) {
    // Use sophisticated lib layer classifier
  }
} catch (error) {
  // Fall back to basic implementation
}
```

**Why optional integration**:
- **Graceful Degradation**: Works without lib layer
- **Performance**: Basic classifier is faster for simple cases
- **Development**: Can develop/test without full lib layer setup

## 🔧 Implementation Steps

### Step 1: Core Interfaces and Types

```typescript
// File: interfaces/IClassifier.ts
export interface IClassifier {
  classify(input: string, options?: ClassificationOptions): Promise<ClassificationResult>
  classifyBatch(inputs: string[]): Promise<ClassificationResult[]>
  getSupportedTypes(): readonly ClassificationType[]
  getSupportedMethods(): readonly ClassificationMethod[]
  getStats(): ClassifierStats
  resetStats(): void
  configure(config: Partial<ClassifierConfig>): void
}

export interface ClassificationResult {
  type: 'command' | 'prompt' | 'workflow'
  confidence: number
  method: ClassificationMethod
  processingTime?: number
  metadata?: Record<string, unknown>
  reasoning?: string
}

export interface ClassificationOptions {
  method?: ClassificationMethod
  includeMetadata?: boolean
  includeReasoning?: boolean
  confidenceThreshold?: number
}

export type ClassificationMethod = 'rule-based' | 'llm-based' | 'hybrid' | 'lib-wrapper'
export type ClassificationType = 'command' | 'prompt' | 'workflow'
```

### Step 2: Configuration System Implementation

```typescript
// File: interfaces/IClassifierConfig.ts
export interface ClassifierConfig {
  defaultMethod: ClassificationMethod
  confidenceThreshold: number
  enableDebugMode: boolean
  ruleBasedConfig: RuleBasedConfig
  statisticsConfig: StatisticsConfig
}

export interface RuleBasedConfig {
  commandPrefix: string
  promptIndicators: string[]
  workflowIndicators: string[]
  fileOperationKeywords: string[]
  technicalTerms: string[]
  confidenceThresholds: {
    command: number
    prompt: number
    workflow: number
  }
  scoringWeights: {
    basePromptScore: number
    baseWorkflowScore: number
    greetingBoost: number
    questionBoost: number
    multiStepBoost: number
    fileOpBoost: number
    lengthPenalty: number
  }
}

// Default configuration with proven patterns
export const DEFAULT_RULE_BASED_CONFIG: RuleBasedConfig = {
  commandPrefix: '/',
  
  // Prompt indicators (conversational patterns)
  promptIndicators: [
    // Greetings
    'hi', 'hello', 'hey', 'thanks', 'thank you', 'please',
    // Questions
    'what', 'how', 'why', 'when', 'where', 'who', 'which',
    // Information requests
    'explain', 'describe', 'tell me', 'show me', 'help me understand',
    // Simple coding requests
    'write', 'create a function', 'make a', 'generate'
  ],
  
  // Workflow indicators (multi-step/complex patterns)
  workflowIndicifiers: [
    // Action verbs
    'fix', 'refactor', 'implement', 'debug', 'build', 'design',
    'test', 'deploy', 'configure', 'setup', 'analyze',
    // Multi-step connectors
    'and then', 'after that', 'next', 'followed by', 'subsequently',
    // Complex operations
    'system', 'architecture', 'integration', 'workflow', 'pipeline'
  ],
  
  // File operation keywords
  fileOperationKeywords: [
    'into file', 'to file', 'save to', 'write to', 'read from',
    'create file', 'update file', 'modify file', 'delete file',
    'file.js', 'file.ts', 'file.py', '.json', '.yaml', '.md'
  ],
  
  // Technical terms that suggest complexity
  technicalTerms: [
    'authentication', 'authorization', 'database', 'API', 'endpoint',
    'middleware', 'component', 'service', 'module', 'library',
    'framework', 'algorithm', 'optimization', 'performance'
  ],
  
  confidenceThresholds: {
    command: 1.0,  // Always 100% for commands
    prompt: 0.8,   // High confidence for prompts
    workflow: 0.7  // Slightly lower for workflows (more complex detection)
  },
  
  scoringWeights: {
    basePromptScore: 0.4,      // Starting score for prompts
    baseWorkflowScore: 0.3,    // Starting score for workflows
    greetingBoost: 0.3,        // Boost for greeting patterns
    questionBoost: 0.2,        // Boost for question patterns
    multiStepBoost: 0.3,       // Boost for multi-step indicators
    fileOpBoost: 0.4,          // Strong boost for file operations
    lengthPenalty: 0.1         // Penalty for very long inputs
  }
}
```

### Step 3: Basic Rule-Based Classifier Implementation

```typescript
// File: impl/BasicClassifier.ts
export class BasicClassifier implements IClassifier {
  private config: RuleBasedConfig
  private stats: ClassifierStatsImpl
  private supportedTypes: readonly ClassificationType[] = ['command', 'prompt', 'workflow']
  private supportedMethods: readonly ClassificationMethod[] = ['rule-based']

  constructor(config?: Partial<RuleBasedConfig>) {
    this.config = { ...DEFAULT_RULE_BASED_CONFIG, ...config }
    this.stats = new ClassifierStatsImpl()
  }

  async classify(input: string, options: ClassificationOptions = {}): Promise<ClassificationResult> {
    const startTime = Date.now()
    const trimmed = input.trim()

    // Input validation
    if (!trimmed) {
      const result = this.createResult('prompt', 0.1, Date.now() - startTime, 'Empty input defaulted to prompt')
      this.updateStats(result)
      return result
    }

    // Stage 1: Command Detection (highest priority, 100% accuracy)
    if (this.isCommand(trimmed)) {
      const result = this.createResult('command', 1.0, Date.now() - startTime, 'Command prefix detected')
      this.updateStats(result)
      return result
    }

    // Stage 2: Prompt vs Workflow Analysis
    const workflowScore = this.calculateWorkflowScore(trimmed)
    const promptScore = this.calculatePromptScore(trimmed)

    // Apply confidence thresholds and determine final classification
    const finalClassification = this.determineClassification(workflowScore, promptScore, trimmed)
    const processingTime = Date.now() - startTime

    const result = this.createResult(
      finalClassification.type,
      finalClassification.confidence,
      processingTime,
      finalClassification.reasoning,
      options.includeMetadata ? finalClassification.metadata : undefined
    )

    this.updateStats(result)
    return result
  }

  // Command detection - simple and 100% accurate
  private isCommand(input: string): boolean {
    return input.startsWith(this.config.commandPrefix) && input.length > 1
  }

  // Calculate workflow score based on multiple indicators
  private calculateWorkflowScore(input: string): number {
    const lowerInput = input.toLowerCase()
    let score = this.config.scoringWeights.baseWorkflowScore

    // Check for workflow indicators
    const workflowMatches = this.config.workflowIndicators.filter(indicator => 
      lowerInput.includes(indicator)
    ).length
    if (workflowMatches > 0) {
      score += workflowMatches * 0.1 // Each match adds 10%
    }

    // Strong boost for file operations
    const fileOpMatches = this.config.fileOperationKeywords.filter(keyword =>
      lowerInput.includes(keyword)
    ).length
    if (fileOpMatches > 0) {
      score += this.config.scoringWeights.fileOpBoost
    }

    // Boost for multi-step indicators
    const multiStepPattern = /\b(then|after|next|and)\b.*\b(then|after|next|and)\b/i
    if (multiStepPattern.test(input)) {
      score += this.config.scoringWeights.multiStepBoost
    }

    // Technical complexity boost
    const techMatches = this.config.technicalTerms.filter(term =>
      lowerInput.includes(term)
    ).length
    if (techMatches > 1) { // Multiple technical terms suggest complexity
      score += techMatches * 0.05
    }

    // Length consideration (longer inputs more likely to be workflows)
    const wordCount = input.split(/\s+/).length
    if (wordCount > 15) {
      score += 0.1
    }

    // File extensions suggest file operations
    const fileExtensionPattern = /\.(js|ts|py|java|html|css|md|json|yaml|yml)\b/i
    if (fileExtensionPattern.test(input)) {
      score += 0.2
    }

    return Math.max(0.1, Math.min(0.95, score)) // Clamp between 0.1 and 0.95
  }

  // Calculate prompt score based on conversational indicators
  private calculatePromptScore(input: string): number {
    const lowerInput = input.toLowerCase()
    let score = this.config.scoringWeights.basePromptScore

    // Check for prompt indicators
    const promptMatches = this.config.promptIndicators.filter(indicator =>
      lowerInput.includes(indicator)
    ).length
    if (promptMatches > 0) {
      score += promptMatches * 0.1
    }

    // Strong boost for greetings
    const greetingPattern = /\b(hi|hello|hey|thanks|thank you)\b/i
    if (greetingPattern.test(input)) {
      score += this.config.scoringWeights.greetingBoost
    }

    // Boost for question patterns
    const questionPattern = /\b(what|how|why|when|where|who|which)\b/i
    if (questionPattern.test(input)) {
      score += this.config.scoringWeights.questionBoost
    }

    // Simple code request pattern
    const simpleCodePattern = /^(write|create|make|generate)\s+(a\s+)?(function|method|class|component)/i
    if (simpleCodePattern.test(input)) {
      score += 0.3
    }

    // Penalties that reduce prompt score
    
    // File operation penalty (suggests workflow)
    if (this.config.fileOperationKeywords.some(keyword => lowerInput.includes(keyword))) {
      score -= 0.4
    }

    // Length penalty (very long inputs less likely to be simple prompts)
    const wordCount = input.split(/\s+/).length
    if (wordCount > 30) {
      score -= this.config.scoringWeights.lengthPenalty
    }

    // Multi-step penalty
    const stepWords = ['then', 'after', 'next', 'and then', 'followed by']
    const stepMatches = stepWords.filter(word => lowerInput.includes(word)).length
    if (stepMatches > 1) {
      score -= 0.3
    }

    return Math.max(0.1, Math.min(0.95, score)) // Clamp between 0.1 and 0.95
  }

  private determineClassification(workflowScore: number, promptScore: number, input: string): {
    type: ClassificationType,
    confidence: number,
    reasoning: string,
    metadata: Record<string, unknown>
  } {
    const metadata = {
      workflowScore,
      promptScore,
      inputLength: input.length,
      wordCount: input.split(/\s+/).length
    }

    // Determine type based on scores and thresholds
    if (workflowScore > promptScore && workflowScore >= this.config.confidenceThresholds.workflow) {
      return {
        type: 'workflow',
        confidence: workflowScore,
        reasoning: `Workflow indicators detected (score: ${workflowScore.toFixed(2)} vs prompt: ${promptScore.toFixed(2)})`,
        metadata
      }
    } else if (promptScore >= this.config.confidenceThresholds.prompt) {
      return {
        type: 'prompt',
        confidence: promptScore,
        reasoning: `Conversational pattern detected (score: ${promptScore.toFixed(2)} vs workflow: ${workflowScore.toFixed(2)})`,
        metadata
      }
    } else {
      // Default to prompt with lower confidence when uncertain
      const confidence = Math.max(promptScore, workflowScore, 0.5)
      return {
        type: 'prompt',
        confidence,
        reasoning: `Uncertain classification, defaulting to prompt (prompt: ${promptScore.toFixed(2)}, workflow: ${workflowScore.toFixed(2)})`,
        metadata
      }
    }
  }

  private createResult(
    type: ClassificationType,
    confidence: number,
    processingTime: number,
    reasoning: string,
    metadata?: Record<string, unknown>
  ): ClassificationResult {
    return {
      type,
      confidence,
      method: 'rule-based',
      processingTime,
      reasoning,
      metadata
    }
  }
}
```

### Step 4: Lib Layer Wrapper Implementation

```typescript
// File: impl/LibClassifierWrapper.ts
export class LibClassifierWrapper implements IClassifier {
  private libClassifier: any // IInputClassifier from lib layer
  private config: LibWrapperConfig
  private stats: ClassifierStatsImpl

  constructor(libClassifier: any, config?: Partial<LibWrapperConfig>) {
    this.libClassifier = libClassifier
    this.config = { ...DEFAULT_LIB_WRAPPER_CONFIG, ...config }
    this.stats = new ClassifierStatsImpl()
  }

  async classify(input: string, options: ClassificationOptions = {}): Promise<ClassificationResult> {
    const startTime = Date.now()

    try {
      // Call lib layer classifier
      const libResult = await this.libClassifier.classifyInput(input, {
        includeMetadata: options.includeMetadata,
        includeReasoning: options.includeReasoning
      })

      // Convert lib result to our interface format
      const result: ClassificationResult = {
        type: this.mapLibTypeToOurType(libResult.type),
        confidence: libResult.confidence || 0.8,
        method: 'lib-wrapper',
        processingTime: Date.now() - startTime,
        reasoning: libResult.reasoning,
        metadata: libResult.metadata ? this.convertLibMetadata(libResult.metadata) : undefined
      }

      this.updateStats(result)
      return result

    } catch (error) {
      // Fallback to basic classification on error
      console.warn('Lib classifier failed, falling back to basic classification:', error)
      
      const basicClassifier = new BasicClassifier()
      const fallbackResult = await basicClassifier.classify(input, options)
      
      // Mark as fallback in metadata
      return {
        ...fallbackResult,
        method: 'lib-wrapper',
        metadata: {
          ...fallbackResult.metadata,
          fallbackUsed: true,
          libError: error instanceof Error ? error.message : String(error)
        }
      }
    }
  }

  private mapLibTypeToOurType(libType: string): ClassificationType {
    // Map lib layer types to our standard types
    switch (libType.toLowerCase()) {
      case 'command':
        return 'command'
      case 'prompt':
      case 'conversational':
        return 'prompt'
      case 'workflow':
      case 'task':
        return 'workflow'
      default:
        return 'prompt' // Default fallback
    }
  }

  private convertLibMetadata(libMetadata: Map<string, unknown>): Record<string, unknown> {
    // Convert Map to plain object for our interface
    return Object.fromEntries(libMetadata)
  }
}
```

### Step 5: Factory Function with Auto-Detection

```typescript
// File: index.ts
export function createClassifier(config?: Partial<ClassifierFactoryConfig>): IClassifier {
  const finalConfig: ClassifierFactoryConfig = {
    defaultMethod: 'rule-based',
    debugMode: false,
    ruleBasedConfig: DEFAULT_RULE_BASED_CONFIG,
    libWrapperConfig: DEFAULT_LIB_WRAPPER_CONFIG,
    ...config
  }

  // Try to detect and use lib layer classifier
  if (finalConfig.defaultMethod === 'lib-wrapper' || finalConfig.defaultMethod === 'auto') {
    try {
      const libModule = require('@qi/lib')
      if (libModule?.InputClassifier) {
        if (finalConfig.debugMode) {
          console.log('🔍 Using lib layer InputClassifier')
        }
        
        const libClassifier = new libModule.InputClassifier()
        return new LibClassifierWrapper(libClassifier, finalConfig.libWrapperConfig)
      }
    } catch (error) {
      if (finalConfig.debugMode) {
        console.log('⚠️ Lib layer not available, falling back to basic classifier:', error.message)
      }
    }
  }

  // Fallback to basic rule-based classifier
  if (finalConfig.debugMode) {
    console.log('📋 Using basic rule-based classifier')
  }
  
  return new BasicClassifier(finalConfig.ruleBasedConfig)
}

// Convenience factory functions
export function createBasicClassifier(config?: Partial<RuleBasedConfig>): BasicClassifier {
  return new BasicClassifier(config)
}

export function createLibClassifier(): IClassifier | null {
  try {
    const libModule = require('@qi/lib')
    if (libModule?.InputClassifier) {
      const libClassifier = new libModule.InputClassifier()
      return new LibClassifierWrapper(libClassifier)
    }
  } catch (error) {
    // Lib layer not available
  }
  return null
}
```

### Step 6: Statistics Implementation

```typescript
// File: impl/ClassifierStatsImpl.ts
export class ClassifierStatsImpl implements ClassifierStats {
  private totalClassifications = 0
  private confidenceSum = 0
  private processingTimeSum = 0
  private typeDistribution: Record<ClassificationType, number> = {
    command: 0,
    prompt: 0,
    workflow: 0
  }
  private methodUsage: Record<string, number> = {}

  recordClassification(result: ClassificationResult): void {
    this.totalClassifications++
    this.confidenceSum += result.confidence
    this.processingTimeSum += result.processingTime || 0
    this.typeDistribution[result.type]++
    this.methodUsage[result.method] = (this.methodUsage[result.method] || 0) + 1
  }

  getStats(): ClassifierStats {
    return {
      totalClassifications: this.totalClassifications,
      averageConfidence: this.totalClassifications > 0 ? this.confidenceSum / this.totalClassifications : 0,
      averageProcessingTime: this.totalClassifications > 0 ? this.processingTimeSum / this.totalClassifications : 0,
      typeDistribution: { ...this.typeDistribution },
      methodUsage: { ...this.methodUsage }
    }
  }

  reset(): void {
    this.totalClassifications = 0
    this.confidenceSum = 0
    this.processingTimeSum = 0
    this.typeDistribution = { command: 0, prompt: 0, workflow: 0 }
    this.methodUsage = {}
  }
}
```

### Step 7: Batch Processing Implementation

```typescript
// Add to BasicClassifier and LibClassifierWrapper
async classifyBatch(inputs: string[]): Promise<ClassificationResult[]> {
  // Parallel processing for better performance
  const classificationPromises = inputs.map(input => this.classify(input))
  return await Promise.all(classificationPromises)
}

// For even better performance, you could implement true batch processing:
async classifyBatchOptimized(inputs: string[]): Promise<ClassificationResult[]> {
  const startTime = Date.now()
  const results: ClassificationResult[] = []

  for (const input of inputs) {
    // Reuse calculations across similar inputs
    const result = await this.classify(input)
    results.push(result)
  }

  // Update batch statistics
  const batchTime = Date.now() - startTime
  console.log(`Batch classified ${inputs.length} inputs in ${batchTime}ms (${(batchTime/inputs.length).toFixed(1)}ms avg)`)

  return results
}
```

## 🧪 Testing Implementation

### Unit Tests

```typescript
// File: __tests__/BasicClassifier.test.ts
import { BasicClassifier } from '../impl/BasicClassifier'
import { DEFAULT_RULE_BASED_CONFIG } from '../interfaces/IClassifierConfig'

describe('BasicClassifier', () => {
  let classifier: BasicClassifier

  beforeEach(() => {
    classifier = new BasicClassifier(DEFAULT_RULE_BASED_CONFIG)
  })

  describe('Command Classification', () => {
    test('should classify commands with 100% confidence', async () => {
      const testCases = ['/help', '/status', '/config set model llama3.2']
      
      for (const input of testCases) {
        const result = await classifier.classify(input)
        expect(result.type).toBe('command')
        expect(result.confidence).toBe(1.0)
        expect(result.method).toBe('rule-based')
      }
    })
  })

  describe('Prompt Classification', () => {
    test('should classify simple prompts correctly', async () => {
      const testCases = [
        'hi there',
        'what is async/await?',
        'explain recursion',
        'write a quicksort function'
      ]
      
      for (const input of testCases) {
        const result = await classifier.classify(input)
        expect(result.type).toBe('prompt')
        expect(result.confidence).toBeGreaterThan(0.7)
      }
    })
  })

  describe('Workflow Classification', () => {
    test('should classify workflows correctly', async () => {
      const testCases = [
        'fix bug in auth.ts and run tests',
        'create authentication system with JWT tokens',
        'analyze codebase and generate documentation',
        'refactor user service and update tests'
      ]
      
      for (const input of testCases) {
        const result = await classifier.classify(input)
        expect(result.type).toBe('workflow')
        expect(result.confidence).toBeGreaterThan(0.6)
      }
    })
  })

  describe('Statistics', () => {
    test('should track classification statistics', async () => {
      await classifier.classify('/help')        // command
      await classifier.classify('hi there')     // prompt
      await classifier.classify('fix bug in auth.ts') // workflow
      
      const stats = classifier.getStats()
      expect(stats.totalClassifications).toBe(3)
      expect(stats.typeDistribution.command).toBe(1)
      expect(stats.typeDistribution.prompt).toBe(1)
      expect(stats.typeDistribution.workflow).toBe(1)
    })
  })
})
```

### Integration Tests

```typescript
// File: __tests__/ClassifierIntegration.test.ts
import { createClassifier } from '../index'

describe('Classifier Integration', () => {
  test('should create classifier with auto-detection', () => {
    const classifier = createClassifier({ defaultMethod: 'auto' })
    expect(classifier).toBeDefined()
    expect(classifier.getSupportedTypes()).toContain('command')
    expect(classifier.getSupportedTypes()).toContain('prompt')
    expect(classifier.getSupportedTypes()).toContain('workflow')
  })

  test('should handle batch processing efficiently', async () => {
    const classifier = createClassifier()
    const inputs = [
      '/help',
      'hello world',
      'fix bug and test',
      'what is TypeScript?',
      '/status',
      'create user authentication system'
    ]

    const startTime = Date.now()
    const results = await classifier.classifyBatch(inputs)
    const processingTime = Date.now() - startTime

    expect(results).toHaveLength(6)
    expect(processingTime).toBeLessThan(100) // Should be fast for rule-based
    
    // Verify types
    expect(results[0].type).toBe('command')
    expect(results[1].type).toBe('prompt')
    expect(results[2].type).toBe('workflow')
  })
})
```

## 🚀 Performance Optimization

### Caching Strategy

```typescript
// Add caching for repeated inputs
class CachedClassifier implements IClassifier {
  private classifier: IClassifier
  private cache = new Map<string, ClassificationResult>()
  private maxCacheSize = 1000

  constructor(classifier: IClassifier) {
    this.classifier = classifier
  }

  async classify(input: string, options?: ClassificationOptions): Promise<ClassificationResult> {
    const cacheKey = `${input}:${JSON.stringify(options || {})}`
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!
      return {
        ...cached,
        processingTime: 0 // Cached result
      }
    }

    const result = await this.classifier.classify(input, options)
    
    // Manage cache size
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }
    
    this.cache.set(cacheKey, result)
    return result
  }
}
```

### Preprocessing Optimization

```typescript
// Pre-compile regex patterns for better performance
class OptimizedPatternMatcher {
  private greetingRegex = /\b(hi|hello|hey|thanks|thank you)\b/i
  private questionRegex = /\b(what|how|why|when|where|who|which)\b/i
  private multiStepRegex = /\b(then|after|next|and)\b.*\b(then|after|next|and)\b/i
  private fileExtensionRegex = /\.(js|ts|py|java|html|css|md|json|yaml|yml)\b/i

  hasGreeting(input: string): boolean {
    return this.greetingRegex.test(input)
  }

  hasQuestion(input: string): boolean {
    return this.questionRegex.test(input)
  }

  hasMultiStep(input: string): boolean {
    return this.multiStepRegex.test(input)
  }

  hasFileExtension(input: string): boolean {
    return this.fileExtensionRegex.test(input)
  }
}
```

This implementation provides a robust, performant classifier that can work standalone or integrate with the lib layer, with comprehensive testing and optimization strategies.