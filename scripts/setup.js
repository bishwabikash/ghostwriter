// Provide polyfills for web streams if they're missing
console.log('Setting up web stream polyfills...');

// Direct polyfill for ReadableStream
if (typeof global.ReadableStream === 'undefined') {
  console.log('ReadableStream is not defined, adding polyfill');
  
  // Define a minimal ReadableStream implementation
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
  
  // Add to global scope
  global.ReadableStream = SimpleReadableStream;
  
  // Also define other Web Streams API interfaces that might be needed
  if (typeof global.WritableStream === 'undefined') {
    global.WritableStream = class WritableStream {
      constructor() {}
      getWriter() { return { write: () => {}, close: () => {}, abort: () => {} }; }
    };
  }
  
  if (typeof global.TransformStream === 'undefined') {
    global.TransformStream = class TransformStream {
      constructor() {
        this.readable = new global.ReadableStream();
        this.writable = new global.WritableStream();
      }
    };
  }
  
  if (typeof global.ByteLengthQueuingStrategy === 'undefined') {
    global.ByteLengthQueuingStrategy = class ByteLengthQueuingStrategy {
      constructor() {}
    };
  }
  
  if (typeof global.CountQueuingStrategy === 'undefined') {
    global.CountQueuingStrategy = class CountQueuingStrategy {
      constructor() {}
    };
  }
  
  console.log('Web Streams API polyfills added successfully');
}

console.log('Node.js setup complete'); 