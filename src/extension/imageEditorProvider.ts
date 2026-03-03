import * as vscode from 'vscode';
import { ImageDocument } from './imageDocument';
import { WebviewToExtMessage } from './protocol';
import { createAIService } from './aiService';

export class ImageEditorProvider implements vscode.CustomEditorProvider<ImageDocument> {
    public static readonly viewType = 'simpleImageEditor.imageEditor';

    private readonly _context: vscode.ExtensionContext;

    private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<ImageDocument>>();
    public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

    /** Maps a document to its active webview panel for request-response communication. */
    private readonly _documentPanelMap = new Map<ImageDocument, vscode.WebviewPanel>();

    /** Pending request-response callbacks keyed by requestId. */
    private readonly _pendingRequests = new Map<string, {
        resolve: (data: Uint8Array) => void;
        reject: (err: Error) => void;
    }>();

    /** Pending ORA data request callbacks. */
    private readonly _pendingOraRequests = new Map<string, {
        resolve: (result: { data: Uint8Array; layerCount: number }) => void;
        reject: (err: Error) => void;
    }>();

    private _nextRequestId = 1;

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
        const doc = new ImageDocument(uri, fileData);

        // Check for ORA sidecar
        const oraUri = vscode.Uri.file(uri.path + '.ora');
        try {
            await vscode.workspace.fs.stat(oraUri);
            const oraData = await vscode.workspace.fs.readFile(oraUri);
            doc.oraData = oraData;
        } catch {
            // No sidecar — that's fine
        }

        return doc;
    }

    public async resolveCustomEditor(
        document: ImageDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        this._documentPanelMap.set(document, webviewPanel);

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
            this._documentPanelMap.delete(document);
        });
    }

    public async saveCustomDocument(
        document: ImageDocument,
        _cancellation: vscode.CancellationToken
    ): Promise<void> {
        const format = this._getFormatFromUri(document.uri);
        const data = await this._requestFileData(document, format);
        await vscode.workspace.fs.writeFile(document.uri, data);

        // ORA sidecar: save or clean up
        await this._saveOrDeleteOraSidecar(document);

        document.clearEdits();
    }

    public async saveCustomDocumentAs(
        document: ImageDocument,
        destination: vscode.Uri,
        _cancellation: vscode.CancellationToken
    ): Promise<void> {
        const format = this._getFormatFromUri(destination);
        const data = await this._requestFileData(document, format);
        await vscode.workspace.fs.writeFile(destination, data);
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
        const format = this._getFormatFromUri(document.uri);
        const data = await this._requestFileData(document, format);
        await vscode.workspace.fs.writeFile(context.destination, data);
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

    /**
     * Request composited file data from the webview.
     * Falls back to the document's original data if the panel is not available.
     */
    private _requestFileData(document: ImageDocument, format: string): Promise<Uint8Array> {
        const panel = this._documentPanelMap.get(document);
        if (!panel) {
            return Promise.resolve(document.getData());
        }

        const requestId = `req-${this._nextRequestId++}`;

        return new Promise<Uint8Array>((resolve, reject) => {
            this._pendingRequests.set(requestId, { resolve, reject });

            panel.webview.postMessage({
                type: 'getFileData',
                body: { requestId, format },
            });

            // Timeout after 30 seconds
            setTimeout(() => {
                if (this._pendingRequests.has(requestId)) {
                    this._pendingRequests.delete(requestId);
                    reject(new Error('Timeout waiting for file data from webview'));
                }
            }, 30000);
        });
    }

    /**
     * Request ORA data from the webview and save or delete the .ora sidecar.
     */
    private async _saveOrDeleteOraSidecar(document: ImageDocument): Promise<void> {
        const panel = this._documentPanelMap.get(document);
        if (!panel) return;

        const requestId = `ora-${this._nextRequestId++}`;
        const result = await new Promise<{ data: Uint8Array; layerCount: number }>((resolve, reject) => {
            this._pendingOraRequests.set(requestId, { resolve, reject });
            panel.webview.postMessage({
                type: 'getOraData',
                body: { requestId },
            });
            setTimeout(() => {
                if (this._pendingOraRequests.has(requestId)) {
                    this._pendingOraRequests.delete(requestId);
                    reject(new Error('Timeout waiting for ORA data'));
                }
            }, 30000);
        });

        const oraUri = vscode.Uri.file(document.uri.path + '.ora');

        if (result.layerCount > 1) {
            await vscode.workspace.fs.writeFile(oraUri, result.data);
        } else {
            // Clean up stale sidecar
            try {
                await vscode.workspace.fs.stat(oraUri);
                await vscode.workspace.fs.delete(oraUri);
            } catch {
                // No sidecar to delete
            }
        }
    }

    /** Extract image format from a URI's file extension. */
    private _getFormatFromUri(uri: vscode.Uri): string {
        const ext = uri.path.split('.').pop()?.toLowerCase() ?? '';
        switch (ext) {
            case 'jpg':
            case 'jpeg':
                return 'jpeg';
            case 'gif':
                return 'gif';
            case 'bmp':
                return 'bmp';
            case 'webp':
                return 'webp';
            case 'png':
            default:
                return 'png';
        }
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
                const initBody: Record<string, unknown> = {
                    data: Array.from(data),
                    fileName,
                    isUntitled: false,
                };
                if (document.oraData) {
                    initBody.oraData = Array.from(document.oraData);
                }
                panel.webview.postMessage({
                    type: 'init',
                    body: initBody,
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
            case 'getFileDataResponse': {
                const { requestId, data, error } = message.body;
                const pending = this._pendingRequests.get(requestId);
                if (pending) {
                    this._pendingRequests.delete(requestId);
                    if (error) {
                        pending.reject(new Error(error));
                    } else {
                        pending.resolve(new Uint8Array(data));
                    }
                }
                break;
            }
            case 'getOraDataResponse': {
                const { requestId: oraReqId, data: oraData, layerCount } = message.body;
                const oraPending = this._pendingOraRequests.get(oraReqId);
                if (oraPending) {
                    this._pendingOraRequests.delete(oraReqId);
                    oraPending.resolve({ data: new Uint8Array(oraData), layerCount });
                }
                break;
            }
            case 'aiGenerate': {
                const { prompt, provider: aiProvider, size } = message.body;
                const service = createAIService(
                    aiProvider as 'openai' | 'google',
                    this._context.secrets,
                );
                service.generateImage(prompt, size).then(
                    (imageData) => {
                        panel.webview.postMessage({
                            type: 'aiGenerateResult',
                            body: { imageData },
                        });
                    },
                    (err: Error) => {
                        panel.webview.postMessage({
                            type: 'aiGenerateResult',
                            body: { error: err.message },
                        });
                    },
                );
                break;
            }
            case 'aiConfigureKey': {
                const { provider: keyProvider, action, key } = message.body;
                const service = createAIService(
                    keyProvider as 'openai' | 'google',
                    this._context.secrets,
                );
                if (action === 'save' && key) {
                    service.setApiKey(key);
                } else if (action === 'remove') {
                    service.deleteApiKey();
                }
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
    <meta property="csp-nonce" content="${nonce}">
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
