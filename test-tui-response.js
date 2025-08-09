#!/usr/bin/env node

// Simple test to validate TUI response display
const blessed = require('neo-blessed');

// Create screen
const screen = blessed.screen({
  smartCSR: true,
  title: 'TUI Response Test'
});

// Create main panel
const mainPanel = blessed.box({
  parent: screen,
  label: ' 🤖 AI Response ',
  top: 3,
  left: 0,
  width: '70%',
  bottom: 5,
  border: {
    type: 'line',
    fg: 'green'
  },
  style: {
    fg: 'white',
    bg: 'black'
  },
  scrollable: true,
  tags: true,
  content: '{center}{grey-fg}AI responses will appear here...{/grey-fg}{/center}'
});

// Test adding content
setTimeout(() => {
  const current = mainPanel.getContent();
  const newContent = current + '\n' + '{cyan-fg}Test response message!{/cyan-fg}';
  mainPanel.setContent(newContent);
  screen.render();
  
  setTimeout(() => {
    const current2 = mainPanel.getContent();
    const newContent2 = current2 + '\n' + 'More content added...';
    mainPanel.setContent(newContent2);
    mainPanel.setScrollPerc(100);
    screen.render();
  }, 1000);
}, 1000);

// Quit on Ctrl+C
screen.key(['C-c'], () => {
  process.exit(0);
});

screen.render();