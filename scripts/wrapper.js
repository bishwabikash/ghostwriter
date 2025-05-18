// Load web streams polyfill
require('web-streams-polyfill/dist/ponyfill.js');

// Ensure ReadableStream is available
if (typeof global.ReadableStream === 'undefined') {
  const { ReadableStream } = require('web-streams-polyfill/dist/ponyfill.js');
  global.ReadableStream = ReadableStream;
  console.log('Added ReadableStream polyfill');
} else {
  console.log('ReadableStream is already available');
}

// Execute the original command
const { spawnSync } = require('child_process');
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('No command specified');
  process.exit(1);
}

console.log(`Running: ${args.join(' ')}`);
const result = spawnSync(args[0], args.slice(1), { 
  stdio: 'inherit',
  shell: process.platform === 'win32'
});
process.exit(result.status || 0); 