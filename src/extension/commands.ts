import * as vscode from 'vscode';

export function registerCommands(context: vscode.ExtensionContext): void {
    const newImageCmd = vscode.commands.registerCommand(
        'simpleImageEditor.newImage',
        async () => {
            // Open an untitled image editor
            await vscode.commands.executeCommand(
                'vscode.openWith',
                vscode.Uri.parse('untitled:new-image.png'),
                'simpleImageEditor.imageEditor'
            );
        }
    );

    const configureAICmd = vscode.commands.registerCommand(
        'simpleImageEditor.configureAI',
        async () => {
            const provider = await vscode.window.showInputBox({
                prompt: 'Select AI provider',
                placeHolder: 'openai or google',
                validateInput: (value) => {
                    if (value !== 'openai' && value !== 'google') {
                        return 'Please enter "openai" or "google"';
                    }
                    return null;
                },
            });

            if (provider) {
                vscode.window.showInformationMessage(
                    `AI provider set to: ${provider}`
                );
            }
        }
    );

    context.subscriptions.push(newImageCmd);
    context.subscriptions.push(configureAICmd);
}
