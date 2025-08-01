/**
 * Input Widget for Neo-blessed CLI
 *
 * Handles user input with proper parsing and command detection
 */

import blessed from 'neo-blessed';
import type { AppState, AppSubState } from '../../../abstractions/index.js';

interface InputWidgetOptions {
  parent: blessed.Widgets.Screen;
  state: AppState;
  subState?: AppSubState;
  onSubmit: (input: string) => void;
  onStateChange?: () => void;
}

const SUB_STATE_PREFIXES = {
  planning: '📋',
  editing: '✏️',
  generic: '💬',
} as const;

export class InputWidget {
  private widget: blessed.Widgets.TextboxElement;
  private promptWidget: blessed.Widgets.BoxElement;
  private state: AppState = 'ready';
  private subState: AppSubState = 'generic';
  private onSubmit: (input: string) => void;
  private onStateChange?: () => void;

  constructor(options: InputWidgetOptions) {
    this.state = options.state;
    this.subState = options.subState || 'generic';
    this.onSubmit = options.onSubmit;
    this.onStateChange = options.onStateChange;

    // Create prompt indicator
    this.promptWidget = blessed.box({
      parent: options.parent,
      bottom: 3,
      left: 0,
      width: 4,
      height: 3,
      content: this.getPromptPrefix(),
      style: {
        fg: 'cyan',
      },
      border: {
        type: 'line',
      },
    });

    // Create input textbox
    this.widget = blessed.textbox({
      parent: options.parent,
      bottom: 3,
      left: 4,
      right: 0,
      height: 3,
      inputOnFocus: true,
      border: {
        type: 'line',
      },
      style: {
        fg: 'white',
        focus: {
          border: {
            fg: 'cyan',
          },
        },
      },
      padding: {
        left: 1,
        right: 1,
      },
    });

    this.setupEventHandlers();
    this.updateState(this.state, this.subState);
  }

  updateState(state: AppState, subState?: AppSubState): void {
    this.state = state;
    if (subState) this.subState = subState;

    // Update prompt prefix
    this.promptWidget.setContent(this.getPromptPrefix());

    // Update border color
    const borderColor = this.getBorderColor();
    this.widget.style.border = { fg: borderColor };
    this.promptWidget.style.border = { fg: borderColor };

    // Enable/disable input based on state
    if (this.state === 'busy') {
      this.widget.readInput();
      this.widget.setContent('Please wait...');
    } else {
      this.widget.clearValue();
      this.widget.focus();
    }

    this.render();
  }

  focus(): void {
    if (this.state === 'ready') {
      this.widget.focus();
    }
  }

  private setupEventHandlers(): void {
    // Handle input submission
    this.widget.on('submit', (value: string) => {
      if (this.state === 'ready' && value?.trim()) {
        this.onSubmit(value.trim());
        this.widget.clearValue();
      }
    });

    // Handle key events
    this.widget.on('keypress', (_ch: string, key: blessed.Widgets.Events.IKeyEventArg) => {
      // Handle Shift+Tab for state cycling
      if (key.shift && key.name === 'tab' && this.state === 'ready' && this.onStateChange) {
        this.onStateChange();
        return;
      }

      // Handle Ctrl+C for exit
      if (key.ctrl && key.name === 'c') {
        process.exit(0);
      }
    });

    // Handle focus events
    this.widget.on('focus', () => {
      this.widget.style.border = { fg: 'cyan' };
      this.render();
    });

    this.widget.on('blur', () => {
      this.widget.style.border = { fg: this.getBorderColor() };
      this.render();
    });
  }

  private getPromptPrefix(): string {
    if (this.state === 'busy') {
      return '⏳';
    }

    return SUB_STATE_PREFIXES[this.subState] || '💬';
  }

  private getBorderColor(): string {
    return this.state === 'busy' ? 'yellow' : 'green';
  }

  private render(): void {
    this.widget.screen.render();
  }

  getWidget(): blessed.Widgets.TextboxElement {
    return this.widget;
  }

  getPromptWidget(): blessed.Widgets.BoxElement {
    return this.promptWidget;
  }

  destroy(): void {
    this.widget.destroy();
    this.promptWidget.destroy();
  }
}
