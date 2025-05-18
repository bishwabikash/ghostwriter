import * as vscode from 'vscode';
import { marked } from 'marked';
import { Message, OllamaService } from '../api/ollamaService';
import { ConfigManager } from '../config/configManager';

export class ChatProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private messages: Message[] = [];

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly ollamaService: OllamaService,
    private readonly configManager: ConfigManager
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    this._setWebviewMessageListener(webviewView.webview);
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // Get the local path to static assets
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'src', 'chat', 'assets', 'chat.js')
    );

    // Use a nonce to only allow a specific script to be run
    const nonce = getNonce();

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https:;">
        <title>GhostWriter Chat</title>
        <style>
          body {
            padding: 0;
            margin: 0;
            color: var(--vscode-editor-foreground);
            font-family: var(--vscode-font-family);
            background-color: var(--vscode-editor-background);
          }
          .chat-container {
            display: flex;
            flex-direction: column;
            height: 100vh;
            max-height: 100vh;
            overflow: hidden;
          }
          .header {
            padding: 8px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1px solid var(--vscode-panel-border);
            background-color: var(--vscode-sideBar-background);
          }
          .model-selector {
            display: flex;
            align-items: center;
          }
          .model-select {
            margin-left: 8px;
            padding: 4px;
            border: 1px solid var(--vscode-dropdown-border);
            background-color: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            min-width: 120px;
          }
          .status-indicator {
            display: flex;
            align-items: center;
            font-size: 12px;
          }
          .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-right: 6px;
          }
          .status-online {
            background-color: #3fb950;
          }
          .status-offline {
            background-color: #f85149;
          }
          .chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 10px;
          }
          .message {
            margin-bottom: 10px;
            padding: 8px 12px;
            border-radius: 4px;
          }
          .user {
            background-color: var(--vscode-editor-selectionBackground);
            align-self: flex-end;
          }
          .assistant {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
          }
          .footer {
            border-top: 1px solid var(--vscode-panel-border);
          }
          .controls {
            display: flex;
            justify-content: space-between;
            padding: 8px;
            background-color: var(--vscode-sideBar-background);
          }
          .control-button {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            padding: 4px 8px;
            font-size: 12px;
            border-radius: 2px;
            cursor: pointer;
            margin-right: 4px;
          }
          .control-button:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
          }
          .primary-button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
          }
          .primary-button:hover {
            background-color: var(--vscode-button-hoverBackground);
          }
          .dropdown {
            position: relative;
            display: inline-block;
          }
          .dropdown-content {
            display: none;
            position: absolute;
            bottom: 30px;
            right: 0;
            min-width: 200px;
            z-index: 1;
            background-color: var(--vscode-dropdown-background);
            border: 1px solid var(--vscode-dropdown-border);
            border-radius: 3px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          }
          .dropdown-content.show {
            display: block;
          }
          .dropdown-item {
            padding: 8px 12px;
            cursor: pointer;
            font-size: 13px;
          }
          .dropdown-item:hover {
            background-color: var(--vscode-list-hoverBackground);
          }
          .input-container {
            padding: 10px;
          }
          .input-box {
            width: 100%;
            height: 60px;
            padding: 8px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            resize: none;
            font-family: var(--vscode-font-family);
          }
          #statusBar {
            padding: 4px 10px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
          }
          .code-block {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 8px;
            border-radius: 4px;
            margin: 8px 0;
            overflow-x: auto;
          }
          .insert-button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 4px 8px;
            border-radius: 2px;
            cursor: pointer;
            margin-top: 4px;
          }
          .insert-button:hover {
            background-color: var(--vscode-button-hoverBackground);
          }
          .code-actions {
            display: flex;
            justify-content: flex-end;
            margin-top: 4px;
          }
          .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 1000;
            justify-content: center;
            align-items: center;
          }
          .modal.visible {
            display: flex;
          }
          .modal-content {
            background-color: var(--vscode-editor-background);
            padding: 16px;
            border-radius: 6px;
            min-width: 300px;
            max-width: 500px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
          }
          .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
          }
          .modal-title {
            font-size: 16px;
            font-weight: bold;
          }
          .close-button {
            background: none;
            border: none;
            font-size: 16px;
            cursor: pointer;
            color: var(--vscode-editor-foreground);
          }
          .model-list {
            max-height: 300px;
            overflow-y: auto;
            margin-bottom: 16px;
          }
          .model-item {
            padding: 8px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            margin-bottom: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .model-name {
            font-weight: bold;
          }
          .model-action {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 4px 8px;
            border-radius: 2px;
            cursor: pointer;
          }
          .model-action:hover {
            background-color: var(--vscode-button-hoverBackground);
          }
          .progress-container {
            margin-top: 16px;
          }
          .progress-title {
            margin-bottom: 8px;
            font-size: 14px;
          }
          .progress-bar {
            width: 100%;
            height: 12px;
            background-color: var(--vscode-progressBar-background);
            border-radius: 6px;
            overflow: hidden;
          }
          .progress-value {
            height: 100%;
            background-color: var(--vscode-progressBar-foreground);
            width: 0%;
            transition: width 0.3s;
          }
          .progress-status {
            margin-top: 6px;
            font-size: 12px;
            font-style: italic;
          }
          .tab-container {
            margin-bottom: 16px;
          }
          .tab-buttons {
            display: flex;
            border-bottom: 1px solid var(--vscode-panel-border);
          }
          .tab-button {
            padding: 8px 12px;
            border: none;
            background: none;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            color: var(--vscode-descriptionForeground);
          }
          .tab-button.active {
            border-bottom: 2px solid var(--vscode-focusBorder);
            color: var(--vscode-editor-foreground);
          }
          .tab-content {
            display: none;
            padding: 12px 0;
          }
          .tab-content.active {
            display: block;
          }
        </style>
    </head>
    <body>
        <div class="chat-container">
            <div class="header">
                <div class="model-selector">
                    <label for="model-select">Model:</label>
                    <select id="model-select" class="model-select">
                        <!-- Will be populated dynamically -->
                    </select>
                </div>
                <div class="status-indicator">
                    <div id="status-dot" class="status-dot status-offline"></div>
                    <span id="status-text">Checking Ollama...</span>
                </div>
            </div>
            
            <div class="chat-messages" id="chatMessages"></div>
            
            <div class="footer">
                <div id="statusBar"></div>
                <div class="controls">
                    <div>
                        <button id="clearChat" class="control-button">Clear Chat</button>
                        <button id="refreshModels" class="control-button">Refresh Models</button>
                    </div>
                    <div class="dropdown">
                        <button id="moreOptions" class="control-button">Options</button>
                        <div id="optionsDropdown" class="dropdown-content">
                            <div class="dropdown-item" id="startOllama">Start Ollama</div>
                            <div class="dropdown-item" id="checkConnection">Check Connection</div>
                            <div class="dropdown-item" id="downloadModels">Download Models</div>
                            <div class="dropdown-item" id="setSystemPrompt">Set System Prompt</div>
                        </div>
                    </div>
                </div>
                <div class="input-container">
                    <textarea class="input-box" id="userInput" placeholder="Type your message here..." rows="3"></textarea>
                </div>
            </div>
        </div>
        
        <!-- Models Modal -->
        <div id="modelsModal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <div class="modal-title">Manage Models</div>
                    <button class="close-button" id="closeModelsModal">×</button>
                </div>
                
                <div class="tab-container">
                    <div class="tab-buttons">
                        <button class="tab-button active" data-tab="installed">Installed Models</button>
                        <button class="tab-button" data-tab="available">Available Models</button>
                    </div>
                    
                    <div id="installed-tab" class="tab-content active">
                        <div id="installed-models" class="model-list">
                            <!-- Will be populated dynamically -->
                            <div class="loading">Loading installed models...</div>
                        </div>
                    </div>
                    
                    <div id="available-tab" class="tab-content">
                        <div id="available-models" class="model-list">
                            <!-- Will be populated dynamically -->
                            <div class="loading">Loading available models...</div>
                        </div>
                    </div>
                </div>
                
                <div id="model-progress" class="progress-container" style="display: none;">
                    <div class="progress-title">Downloading: <span id="progress-model-name"></span></div>
                    <div class="progress-bar">
                        <div id="progress-value" class="progress-value"></div>
                    </div>
                    <div id="progress-status" class="progress-status">Initializing download...</div>
                </div>
            </div>
        </div>

        <script nonce="${nonce}">
          const vscode = acquireVsCodeApi();
          let statusBar = document.getElementById('statusBar');
          let chatMessages = document.getElementById('chatMessages');
          let userInput = document.getElementById('userInput');
          
          // Model selection
          const modelSelect = document.getElementById('model-select');
          
          // Status indicator
          const statusDot = document.getElementById('status-dot');
          const statusText = document.getElementById('status-text');
          
          // Controls
          const clearChatButton = document.getElementById('clearChat');
          const refreshModelsButton = document.getElementById('refreshModels');
          const moreOptionsButton = document.getElementById('moreOptions');
          const optionsDropdown = document.getElementById('optionsDropdown');
          
          // Modal elements
          const modelsModal = document.getElementById('modelsModal');
          const closeModelsModal = document.getElementById('closeModelsModal');
          const installedModelsContainer = document.getElementById('installed-models');
          const availableModelsContainer = document.getElementById('available-models');
          
          // Modal tabs
          const tabButtons = document.querySelectorAll('.tab-button');
          const tabContents = document.querySelectorAll('.tab-content');
          
          // Dropdown items
          const startOllamaButton = document.getElementById('startOllama');
          const checkConnectionButton = document.getElementById('checkConnection');
          const downloadModelsButton = document.getElementById('downloadModels');
          const setSystemPromptButton = document.getElementById('setSystemPrompt');
          
          // Progress elements
          const modelProgress = document.getElementById('model-progress');
          const progressModelName = document.getElementById('progress-model-name');
          const progressValue = document.getElementById('progress-value');
          const progressStatus = document.getElementById('progress-status');
          
          // Initialize UI
          initUI();
          
          function initUI() {
            // Initialize with the current model and status
            vscode.postMessage({ type: 'getModelInfo' });
            vscode.postMessage({ type: 'checkOllamaStatus' });
            
            // Add event listeners for UI elements
            modelSelect.addEventListener('change', () => {
              vscode.postMessage({
                type: 'setModel',
                model: modelSelect.value
              });
            });
            
            clearChatButton.addEventListener('click', () => {
              vscode.postMessage({ type: 'clearChat' });
            });
            
            refreshModelsButton.addEventListener('click', () => {
              vscode.postMessage({ type: 'refreshModels' });
            });
            
            moreOptionsButton.addEventListener('click', () => {
              optionsDropdown.classList.toggle('show');
            });
            
            // Close dropdown when clicking outside
            window.addEventListener('click', (event) => {
              if (!event.target.matches('#moreOptions')) {
                optionsDropdown.classList.remove('show');
              }
            });
            
            // Dropdown options
            startOllamaButton.addEventListener('click', () => {
              vscode.postMessage({ type: 'startOllama' });
              optionsDropdown.classList.remove('show');
            });
            
            checkConnectionButton.addEventListener('click', () => {
              vscode.postMessage({ type: 'checkOllamaStatus' });
              optionsDropdown.classList.remove('show');
            });
            
            downloadModelsButton.addEventListener('click', () => {
              optionsDropdown.classList.remove('show');
              showModelsModal();
            });
            
            setSystemPromptButton.addEventListener('click', () => {
              vscode.postMessage({ type: 'setSystemPrompt' });
              optionsDropdown.classList.remove('show');
            });
            
            // Modal events
            closeModelsModal.addEventListener('click', () => {
              modelsModal.classList.remove('visible');
            });
            
            // Tab navigation
            tabButtons.forEach(button => {
              button.addEventListener('click', () => {
                const tabId = button.getAttribute('data-tab');
                
                // Deactivate all tabs
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                
                // Activate selected tab
                button.classList.add('active');
                document.getElementById(tabId + '-tab').classList.add('active');
              });
            });
          }
          
          function showModelsModal() {
            modelsModal.classList.add('visible');
            vscode.postMessage({ type: 'getAvailableModels' });
            vscode.postMessage({ type: 'getInstalledModels' });
          }
          
          // Add event listener for the input field
          userInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              const message = userInput.value.trim();
              if (message) {
                vscode.postMessage({
                  type: 'sendMessage',
                  message
                });
                userInput.value = '';
              }
            }
          });
          
          // Handle messages from the extension
          window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
              case 'addMessage':
                addMessage(message.role, message.content);
                break;
              case 'updateStatus':
                updateStatus(message.text);
                break;
              case 'modelInfo':
                updateModelInfo(message.model, message.availableModels);
                break;
              case 'appendAssistantMessage':
                appendToLastAssistantMessage(message.content);
                break;
              case 'clearChat':
                clearChat();
                break;
              case 'ollamaStatus':
                updateOllamaStatus(message.isRunning, message.version);
                break;
              case 'availableModels':
                updateAvailableModels(message.models);
                break;
              case 'installedModels':
                updateInstalledModels(message.models);
                break;
              case 'modelDownloadProgress':
                updateModelDownloadProgress(message.model, message.status, message.progress);
                break;
            }
          });
          
          function updateModelInfo(currentModel, availableModels) {
            // Clear current options
            modelSelect.innerHTML = '';
            
            // Add available models
            if (availableModels && availableModels.length > 0) {
              availableModels.forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                option.selected = (model === currentModel);
                modelSelect.appendChild(option);
              });
            } else {
              // Add just the current model if no list available
              const option = document.createElement('option');
              option.value = currentModel;
              option.textContent = currentModel;
              option.selected = true;
              modelSelect.appendChild(option);
            }
            
            updateStatus('Model: ' + currentModel);
          }
          
          function updateOllamaStatus(isRunning, version) {
            if (isRunning) {
              statusDot.className = 'status-dot status-online';
              statusText.textContent = 'Ollama ' + (version || 'connected');
            } else {
              statusDot.className = 'status-dot status-offline';
              statusText.textContent = 'Ollama offline';
            }
          }
          
          function updateAvailableModels(models) {
            availableModelsContainer.innerHTML = '';
            
            if (!models || models.length === 0) {
              availableModelsContainer.innerHTML = '<div class="model-item">No models available</div>';
              return;
            }
            
            models.forEach(model => {
              const modelItem = document.createElement('div');
              modelItem.className = 'model-item';
              
              const modelName = document.createElement('div');
              modelName.className = 'model-name';
              modelName.textContent = model;
              
              const downloadButton = document.createElement('button');
              downloadButton.className = 'model-action';
              downloadButton.textContent = 'Download';
              downloadButton.addEventListener('click', () => {
                vscode.postMessage({
                  type: 'pullModel',
                  model: model
                });
                
                // Show progress UI
                modelProgress.style.display = 'block';
                progressModelName.textContent = model;
                progressValue.style.width = '0%';
                progressStatus.textContent = 'Preparing download...';
              });
              
              modelItem.appendChild(modelName);
              modelItem.appendChild(downloadButton);
              availableModelsContainer.appendChild(modelItem);
            });
          }
          
          function updateInstalledModels(models) {
            installedModelsContainer.innerHTML = '';
            
            if (!models || models.length === 0) {
              installedModelsContainer.innerHTML = '<div class="model-item">No models installed</div>';
              return;
            }
            
            models.forEach(model => {
              const modelItem = document.createElement('div');
              modelItem.className = 'model-item';
              
              const modelName = document.createElement('div');
              modelName.className = 'model-name';
              modelName.textContent = model;
              
              const useButton = document.createElement('button');
              useButton.className = 'model-action';
              useButton.textContent = 'Use';
              useButton.addEventListener('click', () => {
                vscode.postMessage({
                  type: 'setModel',
                  model: model
                });
                modelsModal.classList.remove('visible');
              });
              
              modelItem.appendChild(modelName);
              modelItem.appendChild(useButton);
              installedModelsContainer.appendChild(modelItem);
            });
          }
          
          function updateModelDownloadProgress(model, status, progress) {
            if (!status && !progress) {
              // Download complete or failed
              modelProgress.style.display = 'none';
              return;
            }
            
            modelProgress.style.display = 'block';
            progressModelName.textContent = model;
            
            if (progress !== undefined) {
              progressValue.style.width = progress + '%';
            }
            
            if (status) {
              progressStatus.textContent = status;
            }
          }
          
          function addMessage(role, content) {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message ' + role;
            
            // Format code blocks
            const formattedContent = formatMessageContent(content);
            messageDiv.innerHTML = formattedContent;
            
            chatMessages.appendChild(messageDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
            // Add insert buttons to code blocks
            messageDiv.querySelectorAll('pre code').forEach((codeBlock) => {
              // Create a div for code actions
              const actionsDiv = document.createElement('div');
              actionsDiv.className = 'code-actions';
              
              // Create insert button
              const insertButton = document.createElement('button');
              insertButton.className = 'insert-button';
              insertButton.innerText = 'Insert Code';
              insertButton.addEventListener('click', () => {
                vscode.postMessage({
                  type: 'insertCode',
                  code: codeBlock.innerText
                });
              });
              
              actionsDiv.appendChild(insertButton);
              
              // Add to parent pre element
              codeBlock.parentElement.appendChild(actionsDiv);
            });
          }
          
          function appendToLastAssistantMessage(content) {
            const messages = document.getElementsByClassName('message assistant');
            if (messages.length > 0) {
              const lastMessage = messages[messages.length - 1];
              
              // Get all text content except for code blocks
              const textNodes = Array.from(lastMessage.childNodes)
                .filter(node => node.nodeType === Node.TEXT_NODE);
              
              // Append the new content
              if (textNodes.length > 0) {
                textNodes[textNodes.length - 1].textContent += content;
              } else {
                lastMessage.appendChild(document.createTextNode(content));
              }
              
              // Scroll to bottom
              chatMessages.scrollTop = chatMessages.scrollHeight;
            }
          }
          
          function formatMessageContent(content) {
            // Use marked library to convert markdown to HTML
            return marked.parse(content);
          }
          
          function updateStatus(text) {
            statusBar.innerText = text;
          }
          
          function clearChat() {
            chatMessages.innerHTML = '';
          }
        </script>
    </body>
    </html>`;
  }

  private _setWebviewMessageListener(webview: vscode.Webview) {
    webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case 'sendMessage':
            this._sendMessage(message.message);
            break;
          case 'getModelInfo':
            this._sendModelInfo();
            break;
          case 'insertCode':
            this._insertCodeToEditor(message.code);
            break;
        }
      },
      undefined,
      []
    );
  }

  private async _sendMessage(content: string) {
    if (!this._view) {
      return;
    }

    // Add user message to the chat
    const userMessage: Message = { role: 'user', content };
    this.messages.push(userMessage);
    this._view.webview.postMessage({
      type: 'addMessage',
      role: 'user',
      content,
    });

    // Add system message if this is the first message
    if (this.messages.length === 1) {
      const systemMessage: Message = {
        role: 'system',
        content: this.configManager.getSystemPrompt()
      };
      this.messages.unshift(systemMessage);
    }

    // Show loading state
    this._view.webview.postMessage({
      type: 'updateStatus',
      text: 'Generating response...',
    });

    // Create a placeholder for the assistant's message
    const assistantMessage: Message = { role: 'assistant', content: '' };
    this.messages.push(assistantMessage);
    this._view.webview.postMessage({
      type: 'addMessage',
      role: 'assistant',
      content: '',
    });

    try {
      // Stream the response
      let responseContent = '';

      await this.ollamaService.generateCompletion(
        this.messages,
        (chunk) => {
          responseContent += chunk;
          assistantMessage.content = responseContent;
          
          if (this._view) {
            this._view.webview.postMessage({
              type: 'appendAssistantMessage',
              content: chunk,
            });
          }
        }
      );

      // Update the assistant message with complete content
      assistantMessage.content = responseContent;

      // Update status
      this._view.webview.postMessage({
        type: 'updateStatus',
        text: `Model: ${this.configManager.getModel()}`,
      });
    } catch (error) {
      console.error('Error generating response:', error);
      
      // Display a detailed error message
      let errorMessage = 'Error: Could not generate response. Make sure Ollama is running.';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      // Update status with error message
      this._view.webview.postMessage({
        type: 'updateStatus',
        text: 'Error: Connection to Ollama failed',
      });
      
      // Add error message as new assistant message for better visibility
      this._view.webview.postMessage({
        type: 'addMessage',
        role: 'assistant',
        content: `⚠️ **Error**\n\n${errorMessage}`,
      });
    }
  }

  private _sendModelInfo() {
    if (this._view) {
      this._view.webview.postMessage({
        type: 'modelInfo',
        model: this.configManager.getModel(),
      });
    }
  }

  private _insertCodeToEditor(code: string) {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      editor.edit((editBuilder) => {
        editBuilder.insert(editor.selection.active, code);
      });
    } else {
      vscode.window.showErrorMessage('No active editor found to insert code.');
    }
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
} 