#!/usr/bin/env node

const blessed = require('neo-blessed');

const screen = blessed.screen({
  smartCSR: true,
  debug: true // Enable debug mode
});

const box = blessed.box({
  parent: screen,
  top: 'center',
  left: 'center',
  width: 50,
  height: 10,
  content: 'Hello blessed!',
  border: {
    type: 'line'
  }
});

screen.key(['q', 'C-c'], () => {
  process.exit(0);
});

screen.render();