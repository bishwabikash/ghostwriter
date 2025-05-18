import * as vscode from 'vscode';

export class ConfigManager {
  private config: vscode.WorkspaceConfiguration;

  constructor() {
    this.config = vscode.workspace.getConfiguration('ghostwriter');
  }

  private refreshConfig() {
    this.config = vscode.workspace.getConfiguration('ghostwriter');
  }

  public getOllamaUrl(): string {
    this.refreshConfig();
    return this.config.get<string>('ollamaUrl', 'http://localhost:11434');
  }

  public getModel(): string {
    this.refreshConfig();
    return this.config.get<string>('model', 'llama3');
  }

  public setModel(model: string): Thenable<void> {
    return this.config.update('model', model, vscode.ConfigurationTarget.Global);
  }

  public getSystemPrompt(): string {
    this.refreshConfig();
    return this.config.get<string>('systemPrompt', 'You are an expert programmer. Help the user write high-quality code. Keep your responses concise and focused on the code.');
  }

  public setSystemPrompt(prompt: string): Thenable<void> {
    return this.config.update('systemPrompt', prompt, vscode.ConfigurationTarget.Global);
  }
} 