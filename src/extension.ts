import * as vscode from 'vscode';
import axios from 'axios';
import { ChatProvider } from './chat/chatProvider';
import { ConfigManager } from './config/configManager';
import { OllamaService } from './api/ollamaService';

export function activate(context: vscode.ExtensionContext) {
  const configManager = new ConfigManager();
  const ollamaService = new OllamaService(configManager);
  
  // Create a chat webview provider
  const chatProvider = new ChatProvider(context.extensionUri, ollamaService, configManager);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('ghostwriter.chatView', chatProvider)
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('ghostwriter.startChat', () => {
      vscode.commands.executeCommand('ghostwriter.chatView.focus');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ghostwriter.setModel', async () => {
      const models = await ollamaService.getAvailableModels();
      
      if (!models.length) {
        vscode.window.showErrorMessage('No models found. Make sure Ollama is running.');
        return;
      }

      const selectedModel = await vscode.window.showQuickPick(models, {
        placeHolder: 'Select a model to use'
      });

      if (selectedModel) {
        configManager.setModel(selectedModel);
        vscode.window.showInformationMessage(`Model set to ${selectedModel}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ghostwriter.setSystemPrompt', async () => {
      const currentPrompt = configManager.getSystemPrompt();
      
      const newPrompt = await vscode.window.showInputBox({
        prompt: 'Enter a new system prompt',
        value: currentPrompt,
        placeHolder: 'You are an expert programmer...'
      });

      if (newPrompt !== undefined) {
        configManager.setSystemPrompt(newPrompt);
        vscode.window.showInformationMessage('System prompt updated');
      }
    })
  );
  
  // Register a command to check Ollama connection status
  context.subscriptions.push(
    vscode.commands.registerCommand('ghostwriter.checkOllamaStatus', async () => {
      try {
        vscode.window.showInformationMessage('Checking Ollama connection...');
        
        const ollamaUrl = configManager.getOllamaUrl();
        const model = configManager.getModel();
        
        try {
          // Try to get version info
          await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Checking Ollama connection...',
            cancellable: false
          }, async (progress) => {
            progress.report({ message: 'Connecting to Ollama' });
            
            try {
              const response = await axios.get(`${ollamaUrl}/api/version`);
              if (response.status === 200) {
                const version = response.data.version;
                vscode.window.showInformationMessage(`Connected to Ollama (version ${version})`);
              }
            } catch (error) {
              vscode.window.showErrorMessage(`Could not connect to Ollama at ${ollamaUrl}. Make sure Ollama is installed and running.`);
              return;
            }
            
            // Check for available models
            progress.report({ message: 'Checking available models' });
            try {
              const modelsResponse = await ollamaService.getAvailableModels();
              const models = modelsResponse.join(', ');
              
              if (modelsResponse.includes(model)) {
                vscode.window.showInformationMessage(`Selected model "${model}" is available. All models: ${models}`);
              } else {
                vscode.window.showWarningMessage(`Selected model "${model}" is not available. Available models: ${models}`);
              }
            } catch (error) {
              vscode.window.showErrorMessage(`Error checking models: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          });
        } catch (error) {
          vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Error checking Ollama status: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    })
  );

  console.log('GhostWriter extension activated');
}

export function deactivate() {
  console.log('GhostWriter extension deactivated');
} 