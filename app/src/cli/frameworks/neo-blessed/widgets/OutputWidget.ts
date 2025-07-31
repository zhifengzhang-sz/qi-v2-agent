/**
 * Output Widget for Neo-blessed CLI
 * 
 * Shows command results and system messages with scrolling
 */

import blessed from 'neo-blessed'

interface OutputMessage {
  id: string
  content: string
  type: 'info' | 'success' | 'error' | 'warning' | 'command' | 'response'
  timestamp: Date
}

interface OutputWidgetOptions {
  parent: blessed.Widgets.Screen
  maxMessages?: number
}

const MESSAGE_COLORS = {
  info: 'blue',
  success: 'green',
  error: 'red',
  warning: 'yellow',
  command: 'cyan',
  response: 'white'
} as const

const MESSAGE_PREFIXES = {
  info: 'ℹ️',
  success: '✅',
  error: '❌',
  warning: '⚠️',
  command: '▶️',
  response: '💬'
} as const

export class OutputWidget {
  private widget: blessed.Widgets.BoxElement
  private messages: OutputMessage[] = []
  private maxMessages: number
  
  constructor(options: OutputWidgetOptions) {
    this.maxMessages = options.maxMessages || 100
    
    this.widget = blessed.box({
      parent: options.parent,
      top: 3,
      left: 0,
      right: 0,
      bottom: 6,
      border: {
        type: 'line'
      },
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: ' ',
        track: {
          bg: 'cyan'
        },
        style: {
          inverse: true
        }
      },
      keys: true,
      vi: true,
      mouse: true,
      tags: true,
      padding: {
        left: 1,
        right: 1,
        top: 1,
        bottom: 1
      }
    })
    
    // Show welcome message
    this.addMessage('Welcome to Qi CLI! Type /help for available commands.', 'info')
    
    this.setupEventHandlers()
  }
  
  addMessage(content: string, type: OutputMessage['type'] = 'info'): void {
    const message: OutputMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content,
      type,
      timestamp: new Date()
    }
    
    this.messages.push(message)
    
    // Keep only the most recent messages
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages)
    }
    
    this.updateDisplay()
  }
  
  clearMessages(): void {
    this.messages = []
    this.updateDisplay()
  }
  
  private updateDisplay(): void {
    if (this.messages.length === 0) {
      this.widget.setContent('{dim-fg}No messages{/dim-fg}')
    } else {
      const content = this.messages.map(msg => this.formatMessage(msg)).join('\\n')
      this.widget.setContent(content)
    }
    
    // Scroll to bottom
    this.widget.setScrollPerc(100)
    this.render()
  }
  
  private formatMessage(message: OutputMessage): string {
    const color = MESSAGE_COLORS[message.type]
    const prefix = MESSAGE_PREFIXES[message.type]
    
    // Format timestamp
    const timeStr = message.timestamp.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
    
    return `{dim-fg}[${timeStr}]{/dim-fg} {${color}-fg}${prefix} ${message.content}{/${color}-fg}`
  }
  
  private setupEventHandlers(): void {
    // Handle scrolling with keyboard
    this.widget.on('keypress', (ch: string, key: blessed.Widgets.Events.IKeyEventArg) => {
      switch (key.name) {
        case 'up':
          this.widget.scroll(-1)
          this.render()
          break
        case 'down':
          this.widget.scroll(1)
          this.render()
          break
        case 'pageup':
          this.widget.scroll(-10)
          this.render()
          break
        case 'pagedown':
          this.widget.scroll(10)
          this.render()
          break
        case 'home':
          this.widget.scrollTo(0)
          this.render()
          break
        case 'end':
          this.widget.setScrollPerc(100)
          this.render()
          break
      }
    })
  }
  
  private render(): void {
    this.widget.screen.render()
  }
  
  getWidget(): blessed.Widgets.BoxElement {
    return this.widget
  }
  
  destroy(): void {
    this.widget.destroy()
  }
}

// Helper function to create output messages
export function createOutputMessage(
  content: string, 
  type: OutputMessage['type'] = 'info'
): OutputMessage {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    content,
    type,
    timestamp: new Date()
  }
}

export type { OutputMessage }