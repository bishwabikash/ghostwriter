#!/usr/bin/env node

// IMPORTANT: Load polyfill before anything else
const { ReadableStream, WritableStream, TransformStream } = require('web-streams-polyfill');

// Add to global scope first thing
global.ReadableStream = ReadableStream;
global.WritableStream = WritableStream;
global.TransformStream = TransformStream;

console.log('Web Streams polyfills loaded. ReadableStream available:', typeof global.ReadableStream !== 'undefined');

// Now run vsce programmatically
async function packageExtension() {
  try {
    // Dynamically import vsce to ensure polyfills are loaded first
    const vsce = require('@vscode/vsce');
    console.log('Running vsce package programmatically...');
    
    // Check available commands
    console.log('Available commands:', Object.keys(vsce));
    
    if (typeof vsce.createVSIX === 'function') {
      await vsce.createVSIX({
        cwd: process.cwd(),
        packagePath: undefined, // Use default
        baseContentUrl: undefined,
        baseImagesUrl: undefined,
        useYarn: false,
        ignoreFile: undefined,
        expandGitHubIssueLinks: false,
        preRelease: false,
        allowMissingRepository: false,
        allowStarActivation: false,
      });
    } else {
      // Fallback to command line
      const { spawnSync } = require('child_process');
      console.log('Falling back to command-line vsce...');
      const result = spawnSync('vsce', ['package'], { 
        stdio: 'inherit', 
        shell: true,
        env: { ...process.env, NODE_OPTIONS: '--require=web-streams-polyfill' }
      });
      
      if (result.status !== 0) {
        throw new Error(`vsce package failed with code ${result.status}`);
      }
    }
    
    console.log('Extension packaged successfully');
  } catch (error) {
    console.error('Failed to package extension:', error);
    process.exit(1);
  }
}

packageExtension(); 