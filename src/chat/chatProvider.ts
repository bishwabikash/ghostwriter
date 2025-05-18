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
          .input-container {
            padding: 10px;
            border-top: 1px solid var(--vscode-panel-border);
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
            border-top: 1px solid var(--vscode-panel-border);
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
        </style>
    </head>
    <body>
        <div class="chat-container">
            <div class="chat-messages" id="chatMessages"></div>
            <div id="statusBar"></div>
            <div class="input-container">
                <textarea class="input-box" id="userInput" placeholder="Type your message here..." rows="3"></textarea>
            </div>
        </div>

        <script nonce="${nonce}">
          const vscode = acquireVsCodeApi();
          let statusBar = document.getElementById('statusBar');
          let chatMessages = document.getElementById('chatMessages');
          let userInput = document.getElementById('userInput');
          
          // Initialize with the current model
          vscode.postMessage({ type: 'getModelInfo' });
          
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
                updateStatus('Model: ' + message.model);
                break;
              case 'appendAssistantMessage':
                appendToLastAssistantMessage(message.content);
                break;
              case 'clearChat':
                clearChat();
                break;
            }
          });
          
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
      this._view.webview.postMessage({
        type: 'updateStatus',
        text: 'Error: Could not generate response. Make sure Ollama is running.',
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