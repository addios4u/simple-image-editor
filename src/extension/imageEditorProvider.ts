import * as vscode from 'vscode';
import { ImageDocument } from './imageDocument';
import { WebviewToExtMessage } from './protocol';

export class ImageEditorProvider implements vscode.CustomEditorProvider<ImageDocument> {
    public static readonly viewType = 'simpleImageEditor.imageEditor';

    private readonly _context: vscode.ExtensionContext;

    private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<ImageDocument>>();
    public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

    constructor(context: vscode.ExtensionContext) {
        this._context = context;
    }

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new ImageEditorProvider(context);
        const registration = vscode.window.registerCustomEditorProvider(
            ImageEditorProvider.viewType,
            provider,
            {
                webviewOptions: { retainContextWhenHidden: true },
                supportsMultipleEditorsPerDocument: false,
            }
        );
        return registration;
    }

    public async openCustomDocument(
        uri: vscode.Uri,
        _openContext: vscode.CustomDocumentOpenContext,
        _token: vscode.CancellationToken
    ): Promise<ImageDocument> {
        const fileData = await vscode.workspace.fs.readFile(uri);
        return new ImageDocument(uri, fileData);
    }

    public async resolveCustomEditor(
        document: ImageDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._context.extensionUri],
        };

        webviewPanel.webview.html = this._getHtmlForWebview(webviewPanel.webview);

        // Handle messages from webview
        const messageDisposable = webviewPanel.webview.onDidReceiveMessage(
            (message: WebviewToExtMessage) => {
                this._handleMessage(document, webviewPanel, message);
            }
        );

        webviewPanel.onDidDispose(() => {
            messageDisposable.dispose();
        });
    }

    public async saveCustomDocument(
        document: ImageDocument,
        _cancellation: vscode.CancellationToken
    ): Promise<void> {
        await vscode.workspace.fs.writeFile(document.uri, document.getData());
    }

    public async saveCustomDocumentAs(
        document: ImageDocument,
        destination: vscode.Uri,
        _cancellation: vscode.CancellationToken
    ): Promise<void> {
        await vscode.workspace.fs.writeFile(destination, document.getData());
    }

    public async revertCustomDocument(
        document: ImageDocument,
        _cancellation: vscode.CancellationToken
    ): Promise<void> {
        const fileData = await vscode.workspace.fs.readFile(document.uri);
        document.setData(fileData);
    }

    public async backupCustomDocument(
        document: ImageDocument,
        context: vscode.CustomDocumentBackupContext,
        _cancellation: vscode.CancellationToken
    ): Promise<vscode.CustomDocumentBackup> {
        await vscode.workspace.fs.writeFile(context.destination, document.getData());
        return {
            id: context.destination.toString(),
            delete: async () => {
                try {
                    await vscode.workspace.fs.delete(context.destination);
                } catch {
                    // Ignore delete errors for backups
                }
            },
        };
    }

    private _handleMessage(
        document: ImageDocument,
        panel: vscode.WebviewPanel,
        message: WebviewToExtMessage
    ): void {
        switch (message.type) {
            case 'ready': {
                const data = document.getData();
                const fileName = document.uri.path.split('/').pop() ?? 'untitled';
                panel.webview.postMessage({
                    type: 'init',
                    body: {
                        data: Array.from(data),
                        fileName,
                        isUntitled: false,
                    },
                });
                break;
            }
            case 'edit': {
                document.applyEdit(message.body);
                this._onDidChangeCustomDocument.fire({
                    document,
                    undo: async () => { /* handled by webview */ },
                    redo: async () => { /* handled by webview */ },
                });
                break;
            }
            case 'getFileData': {
                const data = document.getData();
                panel.webview.postMessage({
                    type: 'getFileDataResponse',
                    requestId: message.requestId,
                    body: Array.from(data),
                });
                break;
            }
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._context.extensionUri, 'dist', 'webview', 'webview.js')
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._context.extensionUri, 'dist', 'webview', 'webview.css')
        );

        const nonce = getNonce();
        const cspSource = webview.cspSource;

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}' 'wasm-unsafe-eval'; img-src ${cspSource} data: blob:; font-src ${cspSource};">
    <link href="${styleUri}" rel="stylesheet">
    <title>Simple Image Editor</title>
</head>
<body>
    <div id="root"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }
}

function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
