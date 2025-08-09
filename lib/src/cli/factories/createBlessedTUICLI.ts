/**
 * Factory for creating blessed TUI-enabled CLI
 * 
 * Creates a full TUI (Text User Interface) blessed CLI with multi-panel layout,
 * navigation, and rich interactive features.
 */

import { Ok, Err, create, type Result, type QiError } from '@qi/base';
import { EventDrivenCLI } from '../impl/EventDrivenCLI.js';
import { BlessedInputManager } from '../frameworks/blessed/BlessedInputManager.js';
import { BlessedStreamRenderer } from '../frameworks/blessed/BlessedStreamRenderer.js';
import { BlessedProgressRenderer } from '../frameworks/blessed/BlessedProgressRenderer.js';
import { BlessedModeRenderer } from '../frameworks/blessed/BlessedModeRenderer.js';
import { BlessedTerminal } from '../frameworks/blessed/BlessedTerminal.js';
import type { ICLIFramework } from '../abstractions/ICLIFramework.js';
import type { CLIConfig } from '../abstractions/ICLIFramework.js';

/**
 * Create blessed TUI CLI with multi-panel layout
 */
export async function createBlessedTUICLI(
  eventManager: any,
  commandRouter: any,
  agentConnector: any,
  config: CLIConfig = {}
): Promise<Result<ICLIFramework, QiError>> {
  try {
    // Fix for blessed input duplication: Clean up any persistent stdin listeners
    // from previous CLI frameworks (readline, ink) before initializing blessed TUI
    // This prevents interference that causes "hi" to become "hhii"
    process.stdin.removeAllListeners('data');
    process.stdin.removeAllListeners('keypress');

    // Create terminal (this creates the base screen)
    const terminal = new BlessedTerminal();
    const screen = terminal.getScreen();

    // Create blessed components that share the screen
    const inputManager = new BlessedInputManager(screen); // TUI will be auto-enabled from --blessed-tui arg
    const streamRenderer = new BlessedStreamRenderer(screen);
    const progressRenderer = new BlessedProgressRenderer(screen);
    const modeRenderer = new BlessedModeRenderer(screen);

    // TUI mode is already enabled in the constructor, no need to call enableTUIMode() again
    
    // Get the TUI layout and share it with other components
    const tuiLayout = inputManager.getTUILayout();
    if (tuiLayout) {
      streamRenderer.enableTUIMode(tuiLayout);
    }
    
    // Disable regular renderer widgets since TUI handles everything
    modeRenderer.enableTUIMode();
    progressRenderer.enableTUIMode();

    // Create EventDrivenCLI with blessed components
    const cli = new EventDrivenCLI(
      terminal,
      inputManager,
      progressRenderer,
      modeRenderer,
      streamRenderer,
      eventManager,
      commandRouter,
      agentConnector,
      {
        ...config,
        enableHotkeys: true,
        enableModeIndicator: true,
        enableProgressDisplay: true,
        enableStreaming: true,
        debug: config.debug || false,
      }
    );

    return Ok(cli);
  } catch (error) {
    console.error('Failed to create blessed TUI CLI:', error);
    return Err(
      create('BLESSED_TUI_CREATION_FAILED', 'Failed to create blessed TUI CLI', 'SYSTEM', {
        originalError: error instanceof Error ? error.message : String(error)
      }) as QiError
    );
  }
}

/**
 * Check if neo-blessed is available for TUI features
 */
export function isBlessedTUIAvailable(): boolean {
  try {
    require('neo-blessed');
    return true;
  } catch {
    return false;
  }
}