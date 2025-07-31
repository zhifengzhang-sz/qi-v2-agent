/**
 * Neo-blessed CLI Framework - DEPRECATED
 * 
 * Main application file moved to NeoBlessedCLI.ts.deprecated due to design issues.
 * Widgets may still be useful for future proper CLI implementations.
 */

// export { NeoBlessedCLIApplication, createNeoBlessedCLI } from './NeoBlessedCLI.js' // DEPRECATED
export { StateWidget } from './widgets/StateWidget.js'
export { InputWidget } from './widgets/InputWidget.js'
export { OutputWidget, createOutputMessage, type OutputMessage } from './widgets/OutputWidget.js'