#!/usr/bin/env node

// Simple standalone test for blessed TUI layout
const blessed = require('neo-blessed');

console.log('Creating simple TUI test...');

// Create screen
const screen = blessed.screen({
  smartCSR: true,
  title: 'Simple TUI Test',
  debug: false
});

// Create header
const header = blessed.box({
  parent: screen,
  top: 0,
  left: 0,
  right: 0,
  height: 3,
  label: ' Test Header ',
  border: { type: 'line', fg: 'blue' },
  content: 'Header content here',
  tags: true
});

// Create main panel
const mainPanel = blessed.box({
  parent: screen,
  top: 3,
  left: 0,
  width: '70%',
  bottom: 5,
  label: ' Main Panel ',
  border: { type: 'line', fg: 'green' },
  content: 'Main content here\nSecond line\nThird line',
  scrollable: true,
  tags: true
});

// Create input
const input = blessed.textbox({
  parent: screen,
  bottom: 2,
  left: 0,
  right: 0,
  height: 3,
  label: ' Input ',
  border: { type: 'line', fg: 'magenta' },
  inputOnFocus: true
});

// Test adding content
setTimeout(() => {
  mainPanel.setContent('Updated content!\nThis should show...');
  screen.render();
}, 1000);

// Exit on q or Ctrl+C
screen.key(['q', 'C-c'], () => {
  process.exit(0);
});

input.focus();
screen.render();

console.log('Simple TUI should be visible now.');