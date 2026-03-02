import * as vscode from 'vscode';
import { ImageEditorProvider } from './imageEditorProvider';
import { registerCommands } from './commands';

export function activate(context: vscode.ExtensionContext): void {
    const provider = ImageEditorProvider.register(context);
    context.subscriptions.push(provider);
    registerCommands(context);
}

export function deactivate(): void {}
