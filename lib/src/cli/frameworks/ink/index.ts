/**
 * Ink CLI Framework
 *
 * React-based CLI implementation using Ink framework
 */

// React Components
export { InputBox } from './components/InputBox.js';
export { MainLayout } from './components/MainLayout.js';
export {
  createOutputMessage,
  OutputDisplay,
  type OutputMessage,
} from './components/OutputDisplay.js';
export { StateIndicator } from './components/StateIndicator.js';
// Main Ink CLI Framework
export { createInkCLIImpl, InkCLIFramework } from './InkCLIFramework';

// Legacy components (deprecated)
// export { InkCLIApplication, createInkCLI } from './InkCLI.js' // DEPRECATED
