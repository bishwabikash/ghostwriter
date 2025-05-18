import axios from 'axios';
import { ConfigManager } from '../config/configManager';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

export interface ModelsResponse {
  models: {
    name: string;
    modified_at: string;
    size: number;
  }[];
}

export class OllamaService {
  private configManager: ConfigManager;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
  }

  public async generateCompletion(messages: Message[], onChunk: (text: string) => void): Promise<void> {
    const ollamaUrl = this.configManager.getOllamaUrl();
    const model = this.configManager.getModel();

    try {
      // First check if Ollama is running
      try {
        await axios.get(`${ollamaUrl}/api/version`);
      } catch (connectionError) {
        throw new Error(
          'Could not connect to Ollama. Please ensure that:\n\n' +
          '1. Ollama is installed (visit https://ollama.ai to download)\n' +
          '2. Ollama is running (check your terminal or task manager)\n' +
          '3. The Ollama URL is correct: ' + ollamaUrl + '\n\n' +
          'To start Ollama, open a terminal and run: ollama serve'
        );
      }

      // Now check if the model exists
      try {
        const modelsResponse = await axios.get<ModelsResponse>(`${ollamaUrl}/api/tags`);
        const availableModels = modelsResponse.data.models.map(m => m.name);
        
        if (!availableModels.includes(model)) {
          throw new Error(
            `The model "${model}" is not available in Ollama.\n\n` +
            `Available models: ${availableModels.join(', ')}\n\n` +
            `To pull the model, open a terminal and run: ollama pull ${model}`
          );
        }
      } catch (modelError) {
        if (modelError instanceof Error && modelError.message.includes('not available')) {
          throw modelError;
        }
        // If we can't check models, just proceed and let the chat API handle errors
      }

      const response = await axios.post(
        `${ollamaUrl}/api/chat`,
        {
          model,
          messages,
          stream: true
        },
        {
          responseType: 'stream'
        }
      );

      return new Promise<void>((resolve, reject) => {
        let buffer = '';
        
        response.data.on('data', (chunk: Buffer) => {
          const text = chunk.toString();
          buffer += text;
          
          // Try to parse complete JSON objects from the buffer
          try {
            // Split by newlines to handle potential multiple JSON objects
            const parts = buffer.split('\n');
            // Process all complete parts except potentially the last one
            for (let i = 0; i < parts.length - 1; i++) {
              if (parts[i].trim()) {
                const data = JSON.parse(parts[i]) as CompletionResponse;
                onChunk(data.response);
              }
            }
            // Keep the last part which might be incomplete
            buffer = parts[parts.length - 1];
          } catch (e) {
            // If we can't parse, it's likely an incomplete JSON object
            // Just keep adding to the buffer
          }
        });

        response.data.on('end', () => {
          resolve();
        });

        response.data.on('error', (err: Error) => {
          reject(err);
        });
      });
    } catch (error) {
      console.error('Error generating completion:', error);
      if (error instanceof Error) {
        throw new Error(error.message);
      } else {
        throw new Error('Error generating response. Make sure Ollama is running with the correct model.');
      }
    }
  }

  public async getAvailableModels(): Promise<string[]> {
    try {
      const ollamaUrl = this.configManager.getOllamaUrl();
      const response = await axios.get<ModelsResponse>(`${ollamaUrl}/api/tags`);
      
      return response.data.models.map(model => model.name);
    } catch (error) {
      console.error('Error fetching models:', error);
      return [];
    }
  }
  
  // Check if Ollama is running
  public async isOllamaRunning(): Promise<boolean> {
    try {
      const ollamaUrl = this.configManager.getOllamaUrl();
      await axios.get(`${ollamaUrl}/api/version`, { timeout: 3000 });
      return true;
    } catch (error) {
      return false;
    }
  }
  
  // Get Ollama version
  public async getOllamaVersion(): Promise<string> {
    try {
      const ollamaUrl = this.configManager.getOllamaUrl();
      const response = await axios.get(`${ollamaUrl}/api/version`);
      return response.data.version || 'unknown';
    } catch (error) {
      throw new Error('Could not connect to Ollama server');
    }
  }
  
  // Pull a model from Ollama
  public async pullModel(modelName: string, onProgress?: (progress: string) => void): Promise<boolean> {
    try {
      const ollamaUrl = this.configManager.getOllamaUrl();
      
      // Ollama API requires POST to /api/pull with model name
      const response = await axios.post(
        `${ollamaUrl}/api/pull`,
        { name: modelName },
        { 
          responseType: 'stream',
          timeout: 0 // No timeout for long downloads
        }
      );
      
      return new Promise<boolean>((resolve, reject) => {
        let buffer = '';
        
        response.data.on('data', (chunk: Buffer) => {
          const text = chunk.toString();
          buffer += text;
          
          // Try to parse progress
          try {
            const lines = buffer.split('\n');
            for (let i = 0; i < lines.length - 1; i++) {
              if (lines[i].trim()) {
                const data = JSON.parse(lines[i]);
                if (data.status && onProgress) {
                  onProgress(data.status);
                }
              }
            }
            buffer = lines[lines.length - 1];
          } catch (e) {
            // If we can't parse, just continue
          }
        });
        
        response.data.on('end', () => {
          resolve(true);
        });
        
        response.data.on('error', (err: Error) => {
          reject(err);
        });
      });
    } catch (error) {
      console.error('Error pulling model:', error);
      throw new Error(`Failed to pull model ${modelName}`);
    }
  }
  
  // Get a list of available models from Ollama library
  public async getLibraryModels(): Promise<string[]> {
    // This is a simplified list - in a production app, you might want to fetch from Ollama's registry
    // or maintain your own list of recommended models
    return [
      'llama3',
      'llama3:8b',
      'llama3:70b', 
      'codellama',
      'codellama:7b',
      'codellama:13b',
      'codellama:34b',
      'mistral',
      'mistral:7b',
      'mixtral',
      'mixtral:8x7b',
      'gemma',
      'gemma:2b',
      'gemma:7b',
      'phi',
      'phi:2.7b'
    ];
  }
  
  // Try to start Ollama (this is system-dependent and may not work in all environments)
  public async tryStartOllama(): Promise<boolean> {
    try {
      // On most systems, we can't reliably start Ollama from within VS Code
      // Instead, we'll return instructions for the user
      return false;
    } catch (error) {
      console.error('Error starting Ollama:', error);
      return false;
    }
  }
} 