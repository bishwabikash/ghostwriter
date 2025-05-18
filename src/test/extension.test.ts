import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Starting tests...');

  test('Extension should be present', () => {
    const extension = vscode.extensions.getExtension('ghostwriter');
    assert.ok(extension);
  });

  test('Extension should activate', async () => {
    const extension = vscode.extensions.getExtension('ghostwriter');
    if (extension) {
      await extension.activate();
      assert.strictEqual(extension.isActive, true);
    } else {
      assert.fail('Extension not found');
    }
  });
}); 