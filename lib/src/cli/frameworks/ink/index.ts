/**
 * Ink CLI Framework - DEPRECATED
 *
 * Main application file moved to InkCLI.tsx.deprecated due to design issues.
 * Components may still be useful for future proper CLI implementations.
 */

export { InputBox } from './components/InputBox.js';
// export { InkCLIApplication, createInkCLI } from './InkCLI.js' // DEPRECATED
export { MainLayout } from './components/MainLayout.js';
export {
  createOutputMessage,
  OutputDisplay,
  type OutputMessage,
} from './components/OutputDisplay.js';
export { StateIndicator } from './components/StateIndicator.js';
