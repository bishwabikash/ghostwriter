// Provide polyfills for web streams if they're missing
if (typeof global.ReadableStream === 'undefined') {
  try {
    const { Readable } = require('stream');
    const { ReadableStream: NodeReadableStream } = require('stream/web');
    
    if (!global.ReadableStream) {
      global.ReadableStream = NodeReadableStream;
      
      // If still missing, create a basic polyfill
      if (!global.ReadableStream) {
        console.log('Adding ReadableStream polyfill for compatibility');
        class SimpleReadableStream {
          constructor(underlyingSource) {
            this._source = underlyingSource;
            this._controller = {
              enqueue: (chunk) => {},
              close: () => {},
              error: (e) => {}
            };
            if (underlyingSource && typeof underlyingSource.start === 'function') {
              underlyingSource.start(this._controller);
            }
          }
          
          getReader() {
            return {
              read: async () => ({ done: true, value: undefined }),
              releaseLock: () => {}
            };
          }
        }
        
        global.ReadableStream = SimpleReadableStream;
      }
    }
  } catch (e) {
    console.error('Failed to polyfill ReadableStream:', e);
  }
}

console.log('Node.js setup complete'); 