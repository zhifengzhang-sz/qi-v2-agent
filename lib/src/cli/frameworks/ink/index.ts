/**
 * Ink CLI Framework
 *
 * React-based CLI implementation using Ink framework
 */

// Main Ink CLI Framework
export { InkCLIFramework, createInkCLIImpl } from './InkCLIFramework.js';

// React Components
export { InputBox } from './components/InputBox.js';
export { MainLayout } from './components/MainLayout.js';
export {
  createOutputMessage,
  OutputDisplay,
  type OutputMessage,
} from './components/OutputDisplay.js';
export { StateIndicator } from './components/StateIndicator.js';

// Legacy components (deprecated)
// export { InkCLIApplication, createInkCLI } from './InkCLI.js' // DEPRECATED
