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
} 