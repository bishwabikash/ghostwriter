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
    const vscodeVsce = require('@vscode/vsce');
    console.log('Running vsce package programmatically...');
    
    // Run the package command
    await vscodeVsce.packageCommand({
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
      showProgress: true,
    });
    
    console.log('Extension packaged successfully');
  } catch (error) {
    console.error('Failed to package extension:', error);
    process.exit(1);
  }
}

packageExtension(); 