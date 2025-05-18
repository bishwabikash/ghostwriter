import * as vscode from 'vscode';
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

  console.log('GhostWriter extension activated');
}

export function deactivate() {
  console.log('GhostWriter extension deactivated');
} 