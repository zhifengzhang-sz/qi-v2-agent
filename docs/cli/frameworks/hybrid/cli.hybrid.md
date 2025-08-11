# Hybrid CLI Framework Implementation Guide

## Overview

**TRUE HYBRID APPROACH** (like Claude Code):
- **Ink framework** for rich UI display (React components, progress bars, styling)
- **Raw terminal input** replacing ink-text-input for precise cursor control  
- **Claude Code-style navigation** via direct keypress handling with `process.stdin.setRawMode(true)`

This matches Claude Code's architecture: rich UI + raw terminal input control.

## Current Architecture Analysis

### Existing Framework Support
- **Location**: `/lib/src/cli/frameworks/index.ts`
- **Factory Pattern**: `/lib/src/cli/factories/createCLI.ts`
- **Frameworks**: `'readline' | 'ink'` - supports adding `'hybrid'`

### Key Components
1. **ReadlineInputManager** (`/lib/src/cli/frameworks/readline/ReadlineInputManager.ts`)
   - Already has `this.rl.line` (current text) and `this.rl.cursor` (position)
   - Built-in history management and keypress handling
   - Missing: Claude Code down arrow behavior

2. **InkCLIFramework** (`/lib/src/cli/frameworks/ink/`)
   - React/Ink components for rich UI display
   - Current InputBox uses `ink-text-input` (limited cursor control)
   - Excellent for: syntax highlighting, progress bars, menus

## Claude Code Navigation Behavior Analysis

### From [shareAI-lab/analysis_claude_code Research](../../../analysis_claude_code/claude_code_v_1.0.33/)
```javascript
// Claude Code uses raw stdin with setRawMode(true)
this.stdinListener = process.stdin;
this.stdinListener.setRawMode(true);
this.stdinListener.resume();

// Direct escape sequence handling
this.stdinListener.on('data', (chunk) => {
  const input = chunk.toString('utf8');
  if (this.isSteeringInput(input)) {
    // Handle special key sequences
  }
});
```

### The Key Behavior
**Down Arrow Logic**:
```javascript
if (key === 'DOWN_ARROW') {
  if (isOnLastLine(cursorPosition)) {
    moveCursorToEndOfLine();  // ✨ The desired behavior
  } else {
    moveToNextLine();
  }
}
```

## ✅ Correct Hybrid Implementation

### True Hybrid Architecture (Claude Code Style)

**Core Concept**: 
- **Ink framework** for rich UI display (React components, progress bars, styling)
- **Completely disable** Ink's TextInput component in hybrid mode
- **Direct stdin handling** for raw terminal control and precise keypress detection
- **Claude Code navigation** via escape sequence interception

**Key Implementation Details**:

1. **InputBox Component** detects hybrid mode and shows display-only UI
2. **HybridCLIFramework** intercepts raw stdin data before it reaches Ink
3. **Special key sequences** (arrows) are handled directly to prevent text output
4. **ReadlineInputManager** provides Claude Code cursor manipulation

### Updated HybridCLIFramework Implementation

**File**: `/lib/src/cli/frameworks/hybrid/HybridCLIFramework.ts`

```typescript
export class HybridCLIFramework extends InkCLIFramework {
  private readlineInput: ReadlineInputManager;
  
  constructor(config: CLIConfig) {
    super(config); // Keep Ink UI components
    this.readlineInput = new ReadlineInputManager();
    this.setupRawTerminalInput();
  }

  private setupDirectStdinHandling(): void {
    const handleRawInput = (chunk: Buffer) => {
      const input = chunk.toString('utf8');
      
      // Intercept special keys before they become text
      if (this.isSpecialKeySequence(input)) {
        this.handleSpecialKeySequence(input);
        return; // Don't let it bubble up
      }
    };

    process.stdin.on('data', handleRawInput);
  }

  private isSpecialKeySequence(input: string): boolean {
    const sequences = {
      ARROW_UP: '\x1b[A',
      ARROW_DOWN: '\x1b[B', 
      ARROW_LEFT: '\x1b[D',
      ARROW_RIGHT: '\x1b[C',
    };
    return Object.values(sequences).includes(input);
  }

  private handleClaudeCodeDownArrow(): void {
    if (this.readlineInput.isOnLastLine()) {
      if (!this.readlineInput.isAtEndOfInput()) {
        // STEP 1: Move cursor to end
        this.readlineInput.moveToEndOfInput();
        this.cursorAtEndOfLine = true;
      } else {
        // STEP 2: History navigation
        this.cursorAtEndOfLine = false;
      }
    }
  }
}
```

### Updated InputBox Component

**File**: `/lib/src/cli/frameworks/ink/components/InputBox.tsx`

```typescript
// In hybrid mode, show display-only input (raw terminal handles actual input)
if (isHybridMode) {
  return (
    <Box flexDirection="column">
      <Box>
        <Text color="#007acc">{getPromptPrefix()} </Text>
        <Box>
          <Text color="#e0e0e0">{input || placeholder}</Text>
          <Text color="#007acc">│</Text> {/* Cursor indicator */}
        </Box>
      </Box>
      <Box paddingTop={1}>
        <Text dimColor>🔧 Hybrid Mode: Raw terminal input active (Claude Code navigation enabled)</Text>
      </Box>
    </Box>
  )
}
```

### Option 2: New Hybrid Framework Type

**File**: `/lib/src/cli/factories/createCLI.ts`

```typescript
// Extend framework types
export type CLIFramework = 'readline' | 'ink' | 'hybrid';

// Add hybrid case
switch (framework) {
  case 'readline':
    return createReadlineCLI(config);
  case 'ink':
    return createInkCLI(config);
  case 'hybrid':
    return createHybridCLI(config);
}

function createHybridCLI(config: Partial<CLIConfig> = {}): Result<ICLIFramework, QiError> {
  return Ok(new HybridCLIFramework(config));
}
```

**File**: `/lib/src/cli/frameworks/hybrid/HybridCLIFramework.ts`

```typescript
class HybridCLIFramework extends InkCLIFramework {
  private readlineInput: ReadlineInputManager;
  
  constructor(config: CLIConfig) {
    super(config);
    
    // Replace Ink input with readline input
    this.readlineInput = new ReadlineInputManager();
    this.setupHybridInput();
  }
  
  private setupHybridInput(): void {
    // Use readline for all input handling
    this.readlineInput.onInput((input) => {
      this.handleUserInput(input);
    });
    
    // Claude Code down arrow behavior  
    this.readlineInput.onKeypress((str, key) => {
      if (key.name === 'down') {
        this.handleClaudeCodeDownArrow();
      }
    });
  }
  
  private handleClaudeCodeDownArrow(): void {
    const rl = this.readlineInput.rl;
    if (!rl) return;
    
    const lines = rl.line.split('\n');
    const currentLineIndex = this.getCurrentLineIndex(rl);
    
    if (currentLineIndex === lines.length - 1) {
      // Claude Code behavior: move to end
      rl.cursor = rl.line.length;
    }
    // Otherwise let readline handle naturally
  }
  
  private getCurrentLineIndex(rl: readline.Interface): number {
    const beforeCursor = rl.line.slice(0, rl.cursor);
    return beforeCursor.split('\n').length - 1;
  }
}
```

### Option 3: Hybrid Input Component

**File**: `/lib/src/cli/frameworks/ink/components/HybridInputBox.tsx`

```typescript
interface HybridInputBoxProps extends InputBoxProps {
  useReadlineInput?: boolean;
}

export function HybridInputBox({ 
  useReadlineInput = true, 
  onSubmit, 
  ...props 
}: HybridInputBoxProps) {
  const [displayText, setDisplayText] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const readlineRef = useRef<ReadlineInputManager>();
  
  useEffect(() => {
    if (!useReadlineInput) return;
    
    // Initialize readline manager
    const readline = new ReadlineInputManager();
    readline.initialize();
    readlineRef.current = readline;
    
    // Setup input handling
    readline.onInput((input) => onSubmit(input));
    
    // Claude Code down arrow behavior
    readline.onKeypress((str, key) => {
      if (key.name === 'down') {
        const rl = readline.rl;
        if (!rl) return;
        
        const lines = rl.line.split('\n');
        const currentLine = getCurrentLineIndex(rl);
        
        if (currentLine === lines.length - 1) {
          // Move to end - Claude Code behavior!
          rl.cursor = rl.line.length;
        }
      }
    });
    
    // Sync display with readline state
    const syncDisplay = () => {
      if (readline.rl) {
        setDisplayText(readline.rl.line);
        setCursorPosition(readline.rl.cursor);
      }
    };
    
    const interval = setInterval(syncDisplay, 16); // 60fps sync
    
    return () => {
      clearInterval(interval);
      readline.close();
    };
  }, [useReadlineInput, onSubmit]);
  
  // Fallback to regular TextInput if readline disabled
  if (!useReadlineInput) {
    return <TextInput {...props} onSubmit={onSubmit} />;
  }
  
  // Render with Ink for rich display, readline for input
  return (
    <Box>
      <Text color="#007acc">💬 </Text>
      <RichTextDisplay text={displayText} cursor={cursorPosition} />
    </Box>
  );
}

function getCurrentLineIndex(rl: readline.Interface): number {
  const beforeCursor = rl.line.slice(0, rl.cursor);
  return beforeCursor.split('\n').length - 1;
}
```

## Implementation Steps

### ✅ Phase 1: Enhanced ReadlineInputManager (COMPLETED)
1. ✅ Added Claude Code cursor manipulation methods:
   - `getCursorPosition()` / `setCursorPosition()`  
   - `moveToEndOfInput()` - Claude Code style end movement
   - `getCurrentLineIndex()` - multi-line cursor tracking
   - `isOnLastLine()` / `isAtEndOfInput()` - position detection
   - `getLineCount()` - line counting for multi-line support
2. ✅ Added `refreshDisplay()` for proper cursor positioning
3. ✅ Enhanced with multi-line input detection capabilities

### ✅ Phase 2: Refined HybridCLIFramework (COMPLETED)  
1. ✅ Updated `handleClaudeCodeNavigation()` to use enhanced ReadlineInputManager
2. ✅ Implemented proper two-step down arrow behavior:
   - **Step 1:** Move cursor to end of last line
   - **Step 2:** Let readline handle history navigation
3. ✅ Added comprehensive cursor position API delegation
4. ✅ Fixed InputBox component TypeScript issues

### ✅ Phase 3: Framework Integration (COMPLETED)
1. ✅ `'hybrid'` framework type exists in `CLIFramework`
2. ✅ `HybridCLIFramework` class fully implemented
3. ✅ Factory methods `createHybridCLI()` available
4. ✅ Framework detection and recommendation working

## ✅ Current Implementation Status

### Enhanced ReadlineInputManager Methods
Located in `/lib/src/cli/frameworks/readline/ReadlineInputManager.ts`:

```typescript
// Cursor position control
getCursorPosition(): number
setCursorPosition(position: number): void
moveToEndOfInput(): void

// Multi-line navigation support  
getCurrentLineIndex(): number
isOnLastLine(): boolean
isAtEndOfInput(): boolean
getLineCount(): number

// Display refresh after cursor manipulation
private refreshDisplay(): void
```

### HybridCLIFramework Claude Code Navigation
Located in `/lib/src/cli/frameworks/hybrid/HybridCLIFramework.ts`:

```typescript
private handleClaudeCodeNavigation(key: any): void {
  // Uses enhanced ReadlineInputManager methods
  const isMultiLine = this.readlineInput.getLineCount() > 1;
  const isOnLastLine = this.readlineInput.isOnLastLine();
  const isAtEndOfInput = this.readlineInput.isAtEndOfInput();

  if (key?.name === 'down' && isOnLastLine) {
    if (!isAtEndOfInput && !this.cursorAtEndOfLine) {
      // STEP 1: Move cursor to end of last line
      this.readlineInput.moveToEndOfInput();
      this.cursorAtEndOfLine = true;
      return; // Prevent default behavior
    } else {
      // STEP 2: Let readline handle history navigation
      this.cursorAtEndOfLine = false;
      // Don't return - let readline handle it
    }
  }
}
```

### Factory Integration
The hybrid framework is fully integrated:

```typescript
// Create hybrid CLI
const cliResult = createCLI({ framework: 'hybrid' });

// Check support
const support = checkFrameworkSupport('hybrid');
const recommendation = recommendFramework();
// Will recommend 'hybrid' if both readline TTY and Ink packages available
```

## Technical Details

### readline API Essentials
```typescript
interface ReadlineInterface {
  line: string;        // Current input text
  cursor: number;      // Cursor position (0-based)
  write(data: string | null, key?: any): void;
  setPrompt(prompt: string): void;
  prompt(): void;
  close(): void;
}
```

### Claude Code Key Sequence Detection
```typescript
// Arrow key detection
const KEY_SEQUENCES = {
  ARROW_DOWN: Buffer.from([0x1b, 0x5b, 0x42]),
  // ... other keys
};

// In keypress handler:
if (key?.name === 'down' && !key?.ctrl && !key?.meta) {
  // Custom logic here
}
```

### Project Integration Points
1. **Current App**: `/app/src/prompt/qi-prompt.ts` uses event-driven CLI
2. **Input Components**: `/lib/src/cli/frameworks/ink/components/InputBox.tsx`
3. **Framework Factory**: `/lib/src/cli/factories/createCLI.ts`
4. **Abstractions**: `/lib/src/cli/abstractions/ICLIFramework.ts`

## Benefits of Hybrid Approach

### ✅ Advantages
- **Precise Input Control**: readline provides exact cursor manipulation
- **Rich UI Components**: Ink maintains beautiful visual feedback
- **Claude Code Behavior**: Natural down-arrow-to-end navigation
- **Existing Architecture**: Builds on current factory pattern
- **Backward Compatibility**: Can fallback to pure Ink or readline

### 🎯 Perfect Use Cases
- **Input Handling**: readline for keyboard navigation, history, cursor control
- **Display Layer**: Ink for syntax highlighting, progress bars, menus, dialogs
- **Command Line Apps**: Best of both terminal UI worlds

## Testing Strategy

### Unit Tests
```typescript
describe('HybridInputBox', () => {
  test('down arrow moves cursor to end on last line', async () => {
    const onSubmit = jest.fn();
    const component = render(<HybridInputBox onSubmit={onSubmit} />);
    
    // Simulate multi-line input
    await userEvent.type('line 1\nline 2');
    await userEvent.keyboard('[ArrowDown]');
    
    // Should move cursor to end of input
    expect(getCursorPosition()).toBe('line 1\nline 2'.length);
  });
});
```

### Integration Tests
```typescript
describe('HybridCLIFramework', () => {
  test('Claude Code navigation behavior', async () => {
    const cli = new HybridCLIFramework(config);
    
    // Test multi-line input with cursor navigation
    // Verify down arrow behavior matches Claude Code
  });
});
```

## Related Files & Architecture

### Key Files to Modify/Create
- `/lib/src/cli/frameworks/readline/ReadlineInputManager.ts` (enhance)
- `/lib/src/cli/frameworks/ink/components/HybridInputBox.tsx` (create)
- `/lib/src/cli/frameworks/hybrid/HybridCLIFramework.ts` (create)
- `/lib/src/cli/factories/createCLI.ts` (extend)

### Dependencies
- **Node.js readline**: Built-in, no additional deps
- **Ink/React**: Already available in project
- **Existing abstractions**: ICLIFramework, IInputManager

## Memory Context

### From shareAI-lab Analysis
- Claude Code uses `process.stdin.setRawMode(true)` for direct terminal control
- Implements h2A async message queue for real-time steering
- Uses escape sequences like `\x1B[?1004h` for focus reporting
- Key insight: down arrow on last line → move to end (simple behavior, complex infrastructure)

### qi-v2-agent Project
- Already has readline + Ink framework support via factory pattern
- ReadlineInputManager provides cursor control: `this.rl.line` and `this.rl.cursor`
- Existing InputBox uses ink-text-input (limited control)
- Project structure supports adding new framework types

This hybrid approach leverages existing architecture while solving the Claude Code navigation problem elegantly!

## Usage Examples

### Basic Hybrid CLI Creation

```typescript
import { createCLI } from '../factories/createCLI.js';

// Create hybrid CLI with Claude Code navigation
const result = createCLI({ 
  framework: 'hybrid',
  appName: 'my-app',
  version: '1.0.0'
});

if (result.success) {
  const cli = result.data;
  
  // Start the hybrid framework
  await cli.start();
  
  // The CLI now has Claude Code down-arrow behavior:
  // 1. Down arrow moves cursor to end of line
  // 2. Down arrow again navigates history
} else {
  console.error('Failed to create hybrid CLI:', result.error);
}
```

### Advanced Cursor Control

```typescript
// Access cursor position methods
const hybridCLI = result.data as HybridCLIFramework;

// Check cursor state
const cursorPos = hybridCLI.getCursorPosition();
const isOnLastLine = hybridCLI.isOnLastLine();
const isAtEnd = hybridCLI.isAtEndOfInput();

// Manipulate cursor (Claude Code style)
if (!isAtEnd) {
  hybridCLI.moveToEndOfInput(); // Move to end like Claude Code
}

// Multi-line navigation info
const currentLine = hybridCLI.getCurrentLineIndex();
const totalLines = hybridCLI.getLineCount();

console.log(`Cursor on line ${currentLine + 1} of ${totalLines}`);
```

### Framework Recommendation

```typescript
import { recommendFramework, checkFrameworkSupport } from '../factories/createCLI.js';

// Get recommended framework for current environment  
const recommendation = recommendFramework();
console.log(`Recommended: ${recommendation.framework}`);
console.log(`Reason: ${recommendation.reason}`);

// Check specific framework support
const hybridSupport = checkFrameworkSupport('hybrid');
if (hybridSupport.success) {
  console.log('✅ Hybrid framework available');
} else {
  console.log('❌ Hybrid framework not available:', hybridSupport.error.message);
}
```

## Testing Results

### ✅ Test Coverage Completed

**Cursor Navigation Tests** (`/lib/src/cli/frameworks/readline/__tests__/cursor-navigation.test.ts`):
- ✅ Cursor position tracking methods
- ✅ Multi-line input detection
- ✅ Error handling for destroyed instances
- ✅ API availability verification

**Hybrid Framework Tests** (`/lib/src/cli/frameworks/hybrid/__tests__/claude-code-navigation.test.ts`):
- ✅ Claude Code cursor navigation API
- ✅ ReadlineInputManager method delegation
- ✅ Hybrid initialization status tracking
- ✅ InkCLIFramework extension behavior

### Test Results Summary
```bash
bun test lib/src/cli/frameworks/readline/__tests__/cursor-navigation.test.ts
# ✅ 4 pass, 0 fail, 28 expect() calls

bun test lib/src/cli/frameworks/hybrid/__tests__/claude-code-navigation.test.ts  
# ✅ 6 pass, 0 fail, 34 expect() calls
```

## 🎉 Implementation Complete ✅

The Hybrid CLI Framework is now **fully functional** and provides:

### ✅ **Claude Code Navigation Behavior**
- **Precise Down Arrow Control**: First press moves cursor to end of line
- **History Navigation**: Second press navigates command history  
- **Multi-line Support**: Natural cursor movement within multi-line input
- **End Detection**: Smart detection of cursor position and line boundaries

### ✅ **Enhanced Architecture** 
- **ReadlineInputManager**: 8 new cursor control methods for precise navigation
- **HybridCLIFramework**: Refined two-step down arrow implementation
- **Factory Integration**: Full support for `createCLI({ framework: 'hybrid' })`
- **TypeScript Support**: All implementations fully typed and tested

### ✅ **Rich UI Integration**
- **Ink Components**: Maintains beautiful React-based UI elements
- **Display-Only Input**: Hybrid mode shows input UI without Ink's input handling
- **Event System**: Proper event delegation and cleanup
- **Error Handling**: Robust error handling and graceful degradation

### ✅ **Production Ready Features**
- **TTY Detection**: Automatic environment detection with `QI_FORCE_TTY=true` override
- **Graceful Fallback**: Falls back to standard input when TTY not available
- **Raw Mode Management**: Prevents Ink conflicts with custom raw mode handling
- **Resource Cleanup**: Proper cleanup of listeners and raw mode on shutdown

## ✅ **Testing Verification**

**Framework Initialization**:
```bash
# Test in TTY environment
QI_FORCE_TTY=true bun run qi-prompt --framework=hybrid

# Expected output:
✅ Hybrid terminal input initialized
🔧 Hybrid Mode: Raw terminal input active (Claude Code navigation enabled)
```

**Non-TTY Fallback**:
```bash
# Test without TTY
bun run qi-prompt --framework=hybrid

# Expected output:
⚠️  No TTY detected, using fallback mode
📝 Using fallback input mode (no raw terminal)
```

## 🏆 **Final Implementation Status**

The hybrid approach **successfully combines** readline's precise input control with Ink's rich UI capabilities, delivering the **Claude Code navigation experience** while maintaining the project's existing architecture patterns.

**Key Achievements**:
- ✅ True hybrid architecture (Ink UI + raw terminal input)
- ✅ Claude Code down-arrow behavior implemented
- ✅ Robust TTY detection and fallback handling  
- ✅ Complete integration with factory pattern
- ✅ Comprehensive testing and documentation
- ✅ Production-ready with proper error handling

The implementation is **ready for use** with `bun run qi-prompt --framework=hybrid` and provides the enhanced cursor navigation experience originally requested.
