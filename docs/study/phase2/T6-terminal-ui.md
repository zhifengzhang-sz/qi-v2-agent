# T6: Terminal UI - Ink React Architecture Guide

## Overview

This guide covers the design and implementation of a professional terminal user interface using Ink and React for the Qi V2 Agent. The architecture focuses on creating a Claude Code-like experience with real-time streaming, interactive components, and responsive design optimized for terminal environments.

## Architecture Decisions

### Component Hierarchy Design

**Recommended Application Structure:**

**Top-Level Architecture:**
```
<QiApp>
├── <Header>                    # Status bar, model info, connection status
├── <ConversationView>          # Main chat interface
│   ├── <MessageList>           # Conversation history
│   │   ├── <UserMessage>       # User input display
│   │   └── <AssistantMessage>  # Agent response with streaming
│   └── <InputArea>             # User input handling
├── <Sidebar>                   # Tool status, server list, settings
└── <StatusBar>                 # Connection status, performance metrics
```

**Component Responsibility Mapping:**
- **Layout Components**: Handle positioning, sizing, and responsive behavior
- **Data Components**: Manage conversation state, agent communication
- **Interaction Components**: Handle user input, keyboard shortcuts
- **Display Components**: Present information with proper formatting
- **Utility Components**: Provide reusable UI elements

**Component Design Principles:**
- **Single Responsibility**: Each component has one clear purpose
- **Composability**: Components can be combined flexibly
- **Reusability**: Common components work across different contexts
- **Performance**: Efficient rendering and state updates
- **Accessibility**: Clear information hierarchy and navigation

### State Management Patterns

**Recommended: Context + Reducer Pattern**

**Global State Architecture:**
```typescript
interface AppState {
  conversation: ConversationState;
  agent: AgentState;
  ui: UIState;
  settings: SettingsState;
}

interface ConversationState {
  messages: Message[];
  currentThread: string;
  isStreaming: boolean;
  streamingContent: string;
}

interface AgentState {
  isConnected: boolean;
  availableTools: Tool[];
  connectedServers: string[];
  currentModel: string;
}

interface UIState {
  activeView: 'chat' | 'settings' | 'help';
  sidebarVisible: boolean;
  theme: ThemeConfig;
  layout: LayoutConfig;
}
```

**State Management Strategy:**
- **Local State**: Use useState for component-specific state
- **Shared State**: Use React Context for cross-component state
- **Complex State**: Use useReducer for complex state transitions
- **Async State**: Use custom hooks for API interactions
- **Performance**: Minimize re-renders with proper state structure

### Real-Time Streaming Display

**Streaming Architecture Decisions:**

**Token-Level Streaming (Recommended):**
- **Immediate Feedback**: Display tokens as they arrive
- **Responsive Feel**: Users see progress immediately
- **Performance**: Efficient updates without blocking UI
- **Error Handling**: Graceful handling of streaming interruptions

**Streaming Implementation Strategy:**
- **Buffer Management**: Manage token buffers for smooth display
- **Update Batching**: Batch updates to prevent excessive re-renders
- **Cursor Management**: Handle typing indicators and cursors
- **Content Formatting**: Apply formatting while streaming

**Streaming Display Patterns:**
```typescript
interface StreamingDisplayProps {
  content: string;
  isStreaming: boolean;
  onComplete?: () => void;
  speed?: 'instant' | 'fast' | 'normal' | 'slow';
  formatter?: (content: string) => string;
}

const StreamingDisplay: React.FC<StreamingDisplayProps> = ({
  content,
  isStreaming,
  speed = 'normal',
  formatter = (text) => text
}) => {
  // Streaming display implementation
};
```

## Integration Strategies

### Agent Response Streaming to UI

**Real-Time Integration Architecture:**

**Event-Driven Updates:**
- **Stream Events**: React to streaming events from agent
- **State Updates**: Update UI state based on streaming progress
- **Error Handling**: Handle streaming errors gracefully
- **Completion Events**: Trigger UI updates on completion

**Integration Patterns:**
```typescript
interface StreamingHook {
  streamingContent: string;
  isStreaming: boolean;
  error: Error | null;
  startStreaming: (prompt: string) => Promise<void>;
  stopStreaming: () => void;
  clearContent: () => void;
}

const useAgentStreaming = (): StreamingHook => {
  // Custom hook implementation for agent streaming
};
```

**Performance Considerations:**
- **Debounced Updates**: Prevent excessive re-renders during streaming
- **Virtual Scrolling**: Handle large conversation histories efficiently
- **Memory Management**: Clean up completed streams
- **Background Processing**: Handle streaming without blocking UI

### User Input Handling

**Input Management Strategy:**

**Multi-Modal Input Support:**
- **Text Input**: Standard text input with autocomplete
- **Command Mode**: Special commands with `/` prefix
- **File Input**: Drag-and-drop file support
- **Keyboard Shortcuts**: Power user keyboard navigation

**Input Processing Pipeline:**
1. **Raw Input Capture**: Capture user input from terminal
2. **Command Detection**: Detect special commands vs regular text
3. **Validation**: Validate input format and content
4. **Processing**: Send to agent or handle as command
5. **Feedback**: Provide immediate feedback to user

**Input Component Architecture:**
```typescript
interface InputAreaProps {
  onSubmit: (input: string) => void;
  onCommand: (command: string, args: string[]) => void;
  placeholder?: string;
  multiline?: boolean;
  suggestions?: string[];
  disabled?: boolean;
}

const InputArea: React.FC<InputAreaProps> = ({
  onSubmit,
  onCommand,
  placeholder = "Type your message...",
  multiline = false
}) => {
  // Input area implementation
};
```

### Progress Indicators

**Progress Display Strategy:**

**Multi-Level Progress Indicators:**
- **Global Progress**: Overall agent processing status
- **Task Progress**: Individual task completion status
- **Streaming Progress**: Real-time content generation
- **Loading States**: Server connection and initialization

**Progress Indicator Types:**
- **Spinner**: Simple loading indication
- **Progress Bar**: Determinate progress with percentage
- **Pulse**: Indeterminate progress indication
- **Status Text**: Descriptive progress messages

**Implementation Patterns:**
```typescript
interface ProgressIndicatorProps {
  type: 'spinner' | 'bar' | 'pulse' | 'dots';
  progress?: number;  // 0-100 for progress bar
  message?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red';
  size?: 'small' | 'medium' | 'large';
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  type,
  progress,
  message,
  color = 'blue'
}) => {
  // Progress indicator implementation
};
```

## Configuration Patterns

### Theme Management

**Theme System Architecture:**

**Theme Configuration Structure:**
```typescript
interface ThemeConfig {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    muted: string;
    error: string;
    warning: string;
    success: string;
  };
  typography: {
    fontFamily: string;
    fontSize: {
      small: number;
      normal: number;
      large: number;
    };
  };
  spacing: {
    small: number;
    medium: number;
    large: number;
  };
  borders: {
    style: 'single' | 'double' | 'rounded';
    color: string;
  };
}
```

**Built-in Theme Presets:**
- **Default**: Clean, professional appearance
- **Dark**: Dark mode with high contrast
- **Light**: Light mode with subtle colors
- **High Contrast**: Accessibility-focused high contrast
- **Minimal**: Minimal UI with reduced visual elements

**Theme Selection Strategy:**
- **Auto Detection**: Detect terminal color capabilities
- **User Preference**: Allow user to override theme
- **Context Awareness**: Adapt to terminal background
- **Accessibility**: Support high contrast and color blind users

### Layout Configuration

**Responsive Layout System:**

**Layout Breakpoints:**
```typescript
interface LayoutBreakpoints {
  small: number;    // < 80 columns
  medium: number;   // 80-120 columns
  large: number;    // > 120 columns
}

interface LayoutConfig {
  breakpoints: LayoutBreakpoints;
  sidebar: {
    width: number;
    visible: boolean;
    position: 'left' | 'right';
  };
  header: {
    height: number;
    visible: boolean;
  };
  footer: {
    height: number;
    visible: boolean;
  };
  margins: {
    horizontal: number;
    vertical: number;
  };
}
```

**Adaptive Layout Strategy:**
- **Terminal Size Detection**: Monitor terminal size changes
- **Dynamic Resizing**: Adjust layout based on available space
- **Component Hiding**: Hide non-essential components in small terminals
- **Flexible Spacing**: Adjust spacing based on available space

### Responsive Terminal Design

**Responsive Design Principles:**

**Size-Adaptive Components:**
- **Collapsible Panels**: Hide/show panels based on space
- **Scalable Text**: Adjust text size for readability
- **Flexible Grid**: Grid layouts that adapt to screen size
- **Priority Content**: Show most important content first

**Terminal Size Handling:**
```typescript
interface TerminalSize {
  columns: number;
  rows: number;
}

const useTerminalSize = (): TerminalSize => {
  // Hook to track terminal size changes
};

const useResponsiveLayout = (size: TerminalSize): LayoutConfig => {
  // Calculate optimal layout based on terminal size
};
```

**Responsive Patterns:**
- **Mobile-First**: Design for smallest terminal first
- **Progressive Enhancement**: Add features as space allows
- **Content Prioritization**: Show most important content first
- **Graceful Degradation**: Maintain functionality in small terminals

## Key API Concepts

### Ink Hooks and Patterns

**Essential Ink Hooks:**

**Terminal Interaction Hooks:**
```typescript
// Terminal size monitoring
const { columns, rows } = useStdout();

// Keyboard input handling
const { input, setInput } = useInput((input, key) => {
  if (key.escape) {
    process.exit();
  }
});

// Application focus management
const { isFocused } = useApp();

// Standard streams
const { stdout, write } = useStdout();
const { stderr } = useStderr();
```

**Custom Hook Patterns:**
```typescript
// Conversation management hook
const useConversation = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const addMessage = useCallback((message: Message) => {
    setMessages(prev => [...prev, message]);
  }, []);
  
  return { messages, isLoading, addMessage };
};

// Agent integration hook
const useAgent = () => {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  const connect = useCallback(async () => {
    // Agent connection logic
  }, []);
  
  return { agent, isConnected, connect };
};
```

### React Patterns for Terminal

**Terminal-Specific React Patterns:**

**Component Composition:**
```typescript
// Layout composition pattern
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box flexDirection="column" height="100%">
    <Header />
    <Box flexGrow={1}>
      {children}
    </Box>
    <Footer />
  </Box>
);

// Content area composition
const ContentArea: React.FC = () => (
  <Box flexDirection="row" height="100%">
    <Sidebar />
    <MainContent />
  </Box>
);
```

**State Management Patterns:**
```typescript
// Context provider pattern
const AppContext = createContext<AppState | null>(null);

const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

// Custom context hook
const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};
```

### Component Composition Strategies

**Composition Patterns:**

**Render Props Pattern:**
```typescript
interface StreamingRendererProps {
  content: string;
  isStreaming: boolean;
  children: (props: {
    displayContent: string;
    cursor: boolean;
  }) => React.ReactNode;
}

const StreamingRenderer: React.FC<StreamingRendererProps> = ({
  content,
  isStreaming,
  children
}) => {
  // Streaming logic
  return children({ displayContent, cursor: isStreaming });
};
```

**Compound Component Pattern:**
```typescript
// Message compound component
const Message = {
  Container: ({ children }: { children: React.ReactNode }) => (
    <Box marginBottom={1}>{children}</Box>
  ),
  
  Header: ({ author, timestamp }: { author: string; timestamp: Date }) => (
    <Text dimColor>{author} - {timestamp.toLocaleTimeString()}</Text>
  ),
  
  Content: ({ children }: { children: React.ReactNode }) => (
    <Box marginLeft={2}>{children}</Box>
  ),
  
  Actions: ({ children }: { children: React.ReactNode }) => (
    <Box justifyContent="flex-end">{children}</Box>
  )
};
```

**Higher-Order Component Pattern:**
```typescript
const withKeyboardShortcuts = <P extends object>(
  Component: React.ComponentType<P>
) => {
  return (props: P) => {
    useInput((input, key) => {
      // Handle keyboard shortcuts
    });
    
    return <Component {...props} />;
  };
};

const withTheme = <P extends object>(
  Component: React.ComponentType<P>
) => {
  return (props: P) => {
    const theme = useTheme();
    return <Component {...props} theme={theme} />;
  };
};
```

## UI Component Library

### Core Components

**Essential UI Components:**

**Layout Components:**
```typescript
// Flexible box component
interface BoxProps {
  flexDirection?: 'row' | 'column';
  justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between';
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  flexGrow?: number;
  flexShrink?: number;
  width?: number | string;
  height?: number | string;
  padding?: number;
  margin?: number;
}

// Text component with formatting
interface TextProps {
  color?: string;
  backgroundColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  dimColor?: boolean;
}
```

**Interactive Components:**
```typescript
// Button component
interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
}

// Input component
interface InputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  password?: boolean;
  focus?: boolean;
  onSubmit?: (value: string) => void;
}
```

### Specialized Components

**Application-Specific Components:**

**Conversation Components:**
```typescript
// Message bubble component
interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  showTimestamp?: boolean;
  showAuthor?: boolean;
}

// Code block component
interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  highlightLines?: number[];
}

// Tool execution component
interface ToolExecutionProps {
  toolName: string;
  parameters: Record<string, any>;
  result?: any;
  error?: string;
  isExecuting?: boolean;
}
```

**Status Components:**
```typescript
// Connection status indicator
interface ConnectionStatusProps {
  isConnected: boolean;
  server: string;
  lastSeen?: Date;
}

// Performance metrics display
interface PerformanceMetricsProps {
  metrics: {
    responseTime: number;
    tokensPerSecond: number;
    memoryUsage: number;
  };
}
```

## User Experience Design

### Navigation Patterns

**Keyboard Navigation Strategy:**

**Primary Navigation:**
- **Tab/Shift+Tab**: Navigate between UI elements
- **Enter**: Activate focused element
- **Escape**: Cancel current action or go back
- **Arrow Keys**: Navigate within components

**Application Shortcuts:**
- **Ctrl+C**: Interrupt current operation
- **Ctrl+D**: Exit application
- **Ctrl+L**: Clear conversation
- **Ctrl+S**: Save conversation
- **Ctrl+,**: Open settings

**Advanced Navigation:**
- **Vim-like**: Optional vim-style navigation for power users
- **Custom Shortcuts**: User-configurable shortcuts
- **Context Menus**: Right-click equivalent for actions
- **Quick Actions**: Command palette style interface

### Information Hierarchy

**Visual Hierarchy Strategy:**

**Information Priority:**
1. **Primary**: Current conversation and user input
2. **Secondary**: Tool status and server connections
3. **Tertiary**: Performance metrics and settings
4. **Background**: Historical data and logs

**Visual Techniques:**
- **Typography**: Different fonts and sizes for hierarchy
- **Color**: Strategic use of color for importance
- **Spacing**: White space to separate content areas
- **Borders**: Visual separation of different sections

### Accessibility Considerations

**Accessibility Features:**

**Screen Reader Support:**
- **ARIA Labels**: Proper labeling for screen readers
- **Focus Management**: Logical focus order
- **Live Regions**: Announcements for dynamic content
- **Semantic HTML**: Proper semantic structure

**Visual Accessibility:**
- **High Contrast**: High contrast color schemes
- **Large Text**: Scalable text sizes
- **Color Independence**: Information not dependent on color alone
- **Clear Indicators**: Clear visual indicators for state changes

**Motor Accessibility:**
- **Keyboard Only**: Full functionality without mouse
- **Large Click Targets**: Easy to target interactive elements
- **No Time Limits**: No time-dependent interactions
- **Error Prevention**: Clear validation and error messages

## Performance Optimization

### Rendering Performance

**React Performance Best Practices:**

**Component Optimization:**
- **Memoization**: Use React.memo for expensive components
- **Callback Stability**: Use useCallback for stable references
- **State Structure**: Optimize state structure to minimize re-renders
- **Lazy Loading**: Lazy load non-essential components

**Streaming Performance:**
- **Batched Updates**: Batch streaming updates to reduce renders
- **Virtual Scrolling**: Implement virtual scrolling for long conversations
- **Debounced Input**: Debounce user input to prevent excessive updates
- **Background Processing**: Process non-critical updates in background

### Memory Management

**Memory Optimization Strategy:**

**State Management:**
- **State Cleanup**: Clean up unused state regularly
- **Memory Limits**: Implement limits on conversation history
- **Garbage Collection**: Trigger GC for large state changes
- **Weak References**: Use weak references where appropriate

**Component Lifecycle:**
- **Cleanup Effects**: Proper cleanup in useEffect
- **Event Listeners**: Remove event listeners on unmount
- **Timers**: Clear timers and intervals
- **Subscriptions**: Unsubscribe from external subscriptions

### Terminal-Specific Optimizations

**Terminal Performance:**

**Rendering Optimization:**
- **Minimal Updates**: Only update changed terminal areas
- **Efficient Diffing**: Optimize terminal content diffing
- **Buffer Management**: Manage terminal output buffers
- **Escape Sequence Optimization**: Optimize terminal escape sequences

**Input/Output Performance:**
- **Non-Blocking I/O**: Avoid blocking terminal I/O operations
- **Stream Processing**: Process input/output streams efficiently
- **Buffer Sizes**: Optimize buffer sizes for performance
- **Async Operations**: Use async operations where possible

## Testing Strategy

### Component Testing

**Testing Approach:**

**Unit Testing:**
- **Component Isolation**: Test components in isolation
- **Props Testing**: Test component behavior with different props
- **State Testing**: Test component state changes
- **Event Testing**: Test user interactions and events

**Integration Testing:**
- **Component Integration**: Test component interactions
- **Hook Testing**: Test custom hooks
- **Context Testing**: Test context providers and consumers
- **Navigation Testing**: Test keyboard navigation

### UI Testing

**Visual Testing:**

**Snapshot Testing:**
- **Component Snapshots**: Capture component output for regression testing
- **Layout Testing**: Test responsive layout changes
- **Theme Testing**: Test different theme applications
- **State Snapshots**: Test component state changes

**Interaction Testing:**
- **User Interactions**: Test keyboard and user inputs
- **Streaming Testing**: Test real-time streaming display
- **Error Handling**: Test error states and recovery
- **Performance Testing**: Test rendering performance

### Accessibility Testing

**A11y Testing Strategy:**

**Automated Testing:**
- **Screen Reader Testing**: Test with screen reader simulators
- **Keyboard Testing**: Test keyboard-only navigation
- **Color Contrast Testing**: Verify color contrast ratios
- **Focus Testing**: Test focus management and indicators

**Manual Testing:**
- **Real Screen Readers**: Test with actual screen reader software
- **Keyboard Users**: Test with keyboard-only users
- **Color Blind Testing**: Test with color blind users
- **Low Vision Testing**: Test with low vision users

## Deployment Considerations

### Terminal Compatibility

**Terminal Support Strategy:**

**Terminal Types:**
- **Modern Terminals**: Full feature support (iTerm2, Windows Terminal)
- **Standard Terminals**: Core functionality (Terminal.app, GNOME Terminal)
- **Legacy Terminals**: Basic functionality (cmd, PowerShell)
- **SSH Terminals**: Remote access compatibility

**Feature Detection:**
- **Color Support**: Detect and adapt to color capabilities
- **Unicode Support**: Test and handle unicode character support
- **Size Detection**: Adapt to different terminal sizes
- **Capability Testing**: Test terminal-specific capabilities

### Cross-Platform Considerations

**Platform Compatibility:**

**Operating Systems:**
- **macOS**: Native terminal integration
- **Linux**: Various terminal emulator support
- **Windows**: PowerShell and Windows Terminal support
- **WSL**: Windows Subsystem for Linux compatibility

**Platform-Specific Features:**
- **Font Rendering**: Handle different font rendering
- **Keyboard Shortcuts**: Adapt shortcuts to platform conventions
- **File System**: Handle different file system behaviors
- **Process Management**: Platform-specific process handling

## Next Steps

After completing T6 terminal UI architecture:

1. **Proceed to T7**: [Configuration Management](./T7-configuration.md) for runtime config system design
2. **Prototype Core Components**: Build basic layout and message components
3. **Test Terminal Compatibility**: Verify compatibility across different terminals
4. **Implement Accessibility**: Add accessibility features and testing

This T6 implementation guide provides the architectural foundation for building a professional, accessible, and performant terminal user interface that delivers a Claude Code-like experience while maintaining the efficiency and power of terminal-based interaction.