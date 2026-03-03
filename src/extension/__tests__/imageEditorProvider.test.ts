import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so mocks are available when vi.mock factory runs (hoisted to top)
const {
    mockReadFile,
    mockWriteFile,
    mockStat,
    mockDelete,
    mockRegisterCustomEditorProvider,
    mockOnDidReceiveMessage,
    mockPostMessage,
    mockGenerateImage,
    mockSetApiKey,
    mockDeleteApiKey,
    mockCreateAIService,
} = vi.hoisted(() => {
    const mockGenerateImage = vi.fn();
    const mockSetApiKey = vi.fn();
    const mockDeleteApiKey = vi.fn();
    const mockCreateAIService = vi.fn(() => ({
        generateImage: mockGenerateImage,
        setApiKey: mockSetApiKey,
        getApiKey: vi.fn(),
        deleteApiKey: mockDeleteApiKey,
    }));
    return {
        mockReadFile: vi.fn(),
        mockWriteFile: vi.fn(),
        mockStat: vi.fn(),
        mockDelete: vi.fn(),
        mockRegisterCustomEditorProvider: vi.fn(),
        mockOnDidReceiveMessage: vi.fn(),
        mockPostMessage: vi.fn(),
        mockGenerateImage,
        mockSetApiKey,
        mockDeleteApiKey,
        mockCreateAIService,
    };
});

vi.mock('vscode', () => ({
    Uri: {
        parse: (str: string) => ({ scheme: 'file', path: str, toString: () => str }),
        file: (path: string) => ({ scheme: 'file', path, toString: () => `file://${path}` }),
        joinPath: (...args: any[]) => ({ scheme: 'file', path: args.map(String).join('/'), toString: () => args.map(String).join('/') }),
    },
    workspace: {
        fs: {
            readFile: mockReadFile,
            writeFile: mockWriteFile,
            stat: mockStat,
            delete: mockDelete,
        },
    },
    window: {
        registerCustomEditorProvider: mockRegisterCustomEditorProvider,
    },
    Disposable: {
        from: (...disposables: any[]) => ({ dispose: vi.fn() }),
    },
    CancellationTokenSource: vi.fn().mockImplementation(() => ({
        token: { isCancellationRequested: false },
        cancel: vi.fn(),
        dispose: vi.fn(),
    })),
    EventEmitter: vi.fn().mockImplementation(() => ({
        event: vi.fn(),
        fire: vi.fn(),
        dispose: vi.fn(),
    })),
}));

vi.mock('../aiService', () => ({
    createAIService: mockCreateAIService,
}));

import { ImageEditorProvider } from '../imageEditorProvider';
import { ImageDocument } from '../imageDocument';

describe('ImageEditorProvider', () => {
    let provider: ImageEditorProvider;
    const mockSecrets = {
        get: vi.fn(),
        store: vi.fn(),
        delete: vi.fn(),
        onDidChange: vi.fn(),
    };
    const mockContext = {
        subscriptions: [],
        extensionUri: { scheme: 'file', path: '/ext', toString: () => 'file:///ext' },
        extensionPath: '/ext',
        secrets: mockSecrets,
    } as any;

    beforeEach(() => {
        vi.clearAllMocks();
        provider = new ImageEditorProvider(mockContext);
    });

    it('should have correct viewType', () => {
        expect(ImageEditorProvider.viewType).toBe('simpleImageEditor.imageEditor');
    });

    describe('register', () => {
        it('should register the provider and return a disposable', () => {
            mockRegisterCustomEditorProvider.mockReturnValue({ dispose: vi.fn() });
            const disposable = ImageEditorProvider.register(mockContext);
            expect(mockRegisterCustomEditorProvider).toHaveBeenCalledWith(
                ImageEditorProvider.viewType,
                expect.any(ImageEditorProvider),
                expect.objectContaining({
                    webviewOptions: { retainContextWhenHidden: true },
                })
            );
        });
    });

    describe('openCustomDocument', () => {
        it('should create an ImageDocument with file data', async () => {
            const mockUri = { scheme: 'file', path: '/test/image.png', toString: () => 'file:///test/image.png' } as any;
            const fileData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
            mockReadFile.mockResolvedValue(fileData);

            const doc = await provider.openCustomDocument(
                mockUri,
                { backupId: undefined, untitledDocumentData: undefined } as any,
                { isCancellationRequested: false } as any
            );

            expect(doc).toBeInstanceOf(ImageDocument);
            expect(doc.uri).toBe(mockUri);
            expect(mockReadFile).toHaveBeenCalledWith(mockUri);
        });
    });

    describe('resolveCustomEditor', () => {
        it('should set up webview with correct options', async () => {
            const mockDocument = new ImageDocument(
                { scheme: 'file', path: '/test/image.png', toString: () => 'file:///test/image.png' } as any,
                new Uint8Array([0x89, 0x50, 0x4e, 0x47])
            );

            const mockWebviewPanel = {
                webview: {
                    options: {},
                    html: '',
                    onDidReceiveMessage: mockOnDidReceiveMessage,
                    postMessage: mockPostMessage,
                    asWebviewUri: (uri: any) => uri,
                    cspSource: 'https://test.vscode-resource.com',
                },
                onDidDispose: vi.fn(),
            } as any;

            mockOnDidReceiveMessage.mockReturnValue({ dispose: vi.fn() });
            mockWebviewPanel.onDidDispose.mockReturnValue({ dispose: vi.fn() });

            await provider.resolveCustomEditor(
                mockDocument,
                mockWebviewPanel,
                { isCancellationRequested: false } as any
            );

            // Verify webview options are set
            expect(mockWebviewPanel.webview.options).toEqual(
                expect.objectContaining({
                    enableScripts: true,
                })
            );

            // Verify HTML is set with CSP including wasm-unsafe-eval
            expect(mockWebviewPanel.webview.html).toContain('wasm-unsafe-eval');
            expect(mockWebviewPanel.webview.html).toContain('<!DOCTYPE html>');
        });

        it('should include nonce in webview HTML', async () => {
            const mockDocument = new ImageDocument(
                { scheme: 'file', path: '/test/image.png', toString: () => 'file:///test/image.png' } as any,
                new Uint8Array([0x89, 0x50, 0x4e, 0x47])
            );

            const mockWebviewPanel = {
                webview: {
                    options: {},
                    html: '',
                    onDidReceiveMessage: mockOnDidReceiveMessage,
                    postMessage: mockPostMessage,
                    asWebviewUri: (uri: any) => uri,
                    cspSource: 'https://test.vscode-resource.com',
                },
                onDidDispose: vi.fn(),
            } as any;

            mockOnDidReceiveMessage.mockReturnValue({ dispose: vi.fn() });
            mockWebviewPanel.onDidDispose.mockReturnValue({ dispose: vi.fn() });

            await provider.resolveCustomEditor(
                mockDocument,
                mockWebviewPanel,
                { isCancellationRequested: false } as any
            );

            // Verify nonce is present
            expect(mockWebviewPanel.webview.html).toMatch(/nonce="[a-zA-Z0-9]+"/);
        });
    });

    describe('saveCustomDocument', () => {
        function createPanelWithHandler() {
            let messageHandler: (msg: any) => void = () => {};
            mockOnDidReceiveMessage.mockImplementation((handler: any) => {
                messageHandler = handler;
                return { dispose: vi.fn() };
            });
            const panel = {
                webview: {
                    options: {},
                    html: '',
                    onDidReceiveMessage: mockOnDidReceiveMessage,
                    postMessage: mockPostMessage,
                    asWebviewUri: (uri: any) => uri,
                    cspSource: 'https://test.vscode-resource.com',
                },
                onDidDispose: vi.fn().mockReturnValue({ dispose: vi.fn() }),
            } as any;
            return { panel, getHandler: () => messageHandler };
        }

        function mockPostMessageWithResponse(handler: () => (msg: any) => void, responseData: number[]) {
            mockPostMessage.mockImplementation((msg: any) => {
                if (msg.type === 'getFileData') {
                    setTimeout(() => {
                        handler()({
                            type: 'getFileDataResponse',
                            body: { requestId: msg.body.requestId, data: responseData },
                        });
                    }, 0);
                } else if (msg.type === 'getOraData') {
                    setTimeout(() => {
                        handler()({
                            type: 'getOraDataResponse',
                            body: { requestId: msg.body.requestId, data: [], layerCount: 1 },
                        });
                    }, 0);
                }
                return Promise.resolve(true);
            });
        }

        it('should request composited data from webview and write to file', async () => {
            const mockUri = { scheme: 'file', path: '/test/image.png', toString: () => 'file:///test/image.png' } as any;
            const mockDocument = new ImageDocument(mockUri, new Uint8Array([0x89, 0x50]));
            const { panel, getHandler } = createPanelWithHandler();

            await provider.resolveCustomEditor(
                mockDocument, panel, { isCancellationRequested: false } as any
            );

            const compositedBytes = [0xAA, 0xBB, 0xCC];
            mockPostMessageWithResponse(getHandler, compositedBytes);
            mockWriteFile.mockResolvedValue(undefined);

            await provider.saveCustomDocument(
                mockDocument, { isCancellationRequested: false } as any
            );

            expect(mockPostMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'getFileData',
                    body: expect.objectContaining({ format: 'png' }),
                })
            );
            expect(mockWriteFile).toHaveBeenCalledWith(mockUri, new Uint8Array(compositedBytes));
        });

        it('should clear edits after successful save', async () => {
            const mockUri = { scheme: 'file', path: '/test/image.png', toString: () => 'file:///test/image.png' } as any;
            const mockDocument = new ImageDocument(mockUri, new Uint8Array([1]));
            mockDocument.applyEdit({ id: 'e1', kind: 'brush', data: {}, timestamp: 1 });

            const { panel, getHandler } = createPanelWithHandler();
            await provider.resolveCustomEditor(
                mockDocument, panel, { isCancellationRequested: false } as any
            );

            mockPostMessageWithResponse(getHandler, [0x50]);
            mockWriteFile.mockResolvedValue(undefined);

            expect(mockDocument.isDirty).toBe(true);
            await provider.saveCustomDocument(
                mockDocument, { isCancellationRequested: false } as any
            );
            expect(mockDocument.isDirty).toBe(false);
        });

        it('should fall back to original data when no panel is available', async () => {
            const mockUri = { scheme: 'file', path: '/test/image.png', toString: () => 'file:///test/image.png' } as any;
            const originalData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
            const mockDocument = new ImageDocument(mockUri, originalData);

            mockWriteFile.mockResolvedValue(undefined);

            await provider.saveCustomDocument(
                mockDocument, { isCancellationRequested: false } as any
            );
            expect(mockWriteFile).toHaveBeenCalledWith(mockUri, originalData);
        });

        it('should detect jpeg format from .jpg extension', async () => {
            const mockUri = { scheme: 'file', path: '/test/photo.jpg', toString: () => 'file:///test/photo.jpg' } as any;
            const mockDocument = new ImageDocument(mockUri, new Uint8Array([1]));

            const { panel, getHandler } = createPanelWithHandler();
            await provider.resolveCustomEditor(
                mockDocument, panel, { isCancellationRequested: false } as any
            );

            mockPostMessageWithResponse(getHandler, [0xFF]);
            mockWriteFile.mockResolvedValue(undefined);

            await provider.saveCustomDocument(
                mockDocument, { isCancellationRequested: false } as any
            );

            expect(mockPostMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'getFileData',
                    body: expect.objectContaining({ format: 'jpeg' }),
                })
            );
        });

        it('should request ORA sidecar data and write .ora file when layerCount > 1', async () => {
            const mockUri = { scheme: 'file', path: '/test/image.png', toString: () => 'file:///test/image.png' } as any;
            const mockDocument = new ImageDocument(mockUri, new Uint8Array([1]));

            const { panel, getHandler } = createPanelWithHandler();
            await provider.resolveCustomEditor(
                mockDocument, panel, { isCancellationRequested: false } as any
            );

            // ORA data response (fake ZIP bytes)
            const oraBytes = [0x50, 0x4B, 0x03, 0x04];

            mockPostMessage.mockImplementation((msg: any) => {
                if (msg.type === 'getOraData') {
                    setTimeout(() => {
                        getHandler()({
                            type: 'getOraDataResponse',
                            body: { requestId: msg.body.requestId, data: oraBytes, layerCount: 2 },
                        });
                    }, 0);
                }
                return Promise.resolve(true);
            });
            mockWriteFile.mockResolvedValue(undefined);

            await provider.saveCustomDocument(
                mockDocument, { isCancellationRequested: false } as any
            );

            // Original file should NOT be written when layerCount > 1
            expect(mockWriteFile).toHaveBeenCalledTimes(1);
            // Only ORA sidecar written
            expect(mockWriteFile).toHaveBeenCalledWith(
                expect.objectContaining({ path: '/test/image.png.ora' }),
                new Uint8Array(oraBytes),
            );
        });

        it('should delete .ora sidecar when layerCount <= 1', async () => {
            const mockUri = { scheme: 'file', path: '/test/image.png', toString: () => 'file:///test/image.png' } as any;
            const mockDocument = new ImageDocument(mockUri, new Uint8Array([1]));

            const { panel, getHandler } = createPanelWithHandler();
            await provider.resolveCustomEditor(
                mockDocument, panel, { isCancellationRequested: false } as any
            );

            mockPostMessage.mockImplementation((msg: any) => {
                if (msg.type === 'getFileData') {
                    setTimeout(() => {
                        getHandler()({
                            type: 'getFileDataResponse',
                            body: { requestId: msg.body.requestId, data: [0xAA] },
                        });
                    }, 0);
                } else if (msg.type === 'getOraData') {
                    setTimeout(() => {
                        getHandler()({
                            type: 'getOraDataResponse',
                            body: { requestId: msg.body.requestId, data: [], layerCount: 1 },
                        });
                    }, 0);
                }
                return Promise.resolve(true);
            });
            mockWriteFile.mockResolvedValue(undefined);
            mockStat.mockResolvedValue({ type: 1 }); // file exists
            mockDelete.mockResolvedValue(undefined);

            await provider.saveCustomDocument(
                mockDocument, { isCancellationRequested: false } as any
            );

            // ORA sidecar should be deleted
            expect(mockDelete).toHaveBeenCalledWith(
                expect.objectContaining({ path: '/test/image.png.ora' }),
            );
        });
    });

    describe('AI message handlers', () => {
        function createPanelWithMessageHandler() {
            let messageHandler: (msg: any) => void = () => {};
            mockOnDidReceiveMessage.mockImplementation((handler: any) => {
                messageHandler = handler;
                return { dispose: vi.fn() };
            });
            const panel = {
                webview: {
                    options: {},
                    html: '',
                    onDidReceiveMessage: mockOnDidReceiveMessage,
                    postMessage: mockPostMessage,
                    asWebviewUri: (uri: any) => uri,
                    cspSource: 'https://test.vscode-resource.com',
                },
                onDidDispose: vi.fn().mockReturnValue({ dispose: vi.fn() }),
            } as any;
            return { panel, getHandler: () => messageHandler };
        }

        it('should call AI service and send aiGenerateResult on success', async () => {
            const mockUri = { scheme: 'file', path: '/test/image.png', toString: () => 'file:///test/image.png' } as any;
            const mockDocument = new ImageDocument(mockUri, new Uint8Array([1]));
            const { panel, getHandler } = createPanelWithMessageHandler();

            await provider.resolveCustomEditor(
                mockDocument, panel, { isCancellationRequested: false } as any
            );

            const fakeBase64 = 'iVBORw0KGgoAAAANS';
            mockGenerateImage.mockResolvedValue(fakeBase64);

            const handler = getHandler();
            handler({
                type: 'aiGenerate',
                body: { prompt: 'a cat', provider: 'openai', size: '1024x1024' },
            });

            // Wait for async handler
            await vi.waitFor(() => {
                expect(mockPostMessage).toHaveBeenCalledWith(
                    expect.objectContaining({
                        type: 'aiGenerateResult',
                        body: expect.objectContaining({ imageData: fakeBase64 }),
                    }),
                );
            });

            expect(mockCreateAIService).toHaveBeenCalledWith('openai', mockSecrets);
            expect(mockGenerateImage).toHaveBeenCalledWith('a cat', '1024x1024');
        });

        it('should send aiGenerateResult with error on failure', async () => {
            const mockUri = { scheme: 'file', path: '/test/image.png', toString: () => 'file:///test/image.png' } as any;
            const mockDocument = new ImageDocument(mockUri, new Uint8Array([1]));
            const { panel, getHandler } = createPanelWithMessageHandler();

            await provider.resolveCustomEditor(
                mockDocument, panel, { isCancellationRequested: false } as any
            );

            mockGenerateImage.mockRejectedValue(new Error('No API key configured for openai'));

            const handler = getHandler();
            handler({
                type: 'aiGenerate',
                body: { prompt: 'a cat', provider: 'openai', size: '1024x1024' },
            });

            await vi.waitFor(() => {
                expect(mockPostMessage).toHaveBeenCalledWith(
                    expect.objectContaining({
                        type: 'aiGenerateResult',
                        body: expect.objectContaining({ error: 'No API key configured for openai' }),
                    }),
                );
            });
        });

        it('should save API key via aiConfigureKey with action save', async () => {
            const mockUri = { scheme: 'file', path: '/test/image.png', toString: () => 'file:///test/image.png' } as any;
            const mockDocument = new ImageDocument(mockUri, new Uint8Array([1]));
            const { panel, getHandler } = createPanelWithMessageHandler();

            await provider.resolveCustomEditor(
                mockDocument, panel, { isCancellationRequested: false } as any
            );

            mockSetApiKey.mockResolvedValue(undefined);

            const handler = getHandler();
            handler({
                type: 'aiConfigureKey',
                body: { provider: 'openai', action: 'save', key: 'sk-test-key-123' },
            });

            await vi.waitFor(() => {
                expect(mockCreateAIService).toHaveBeenCalledWith('openai', mockSecrets);
                expect(mockSetApiKey).toHaveBeenCalledWith('sk-test-key-123');
            });
        });

        it('should delete API key via aiConfigureKey with action remove', async () => {
            const mockUri = { scheme: 'file', path: '/test/image.png', toString: () => 'file:///test/image.png' } as any;
            const mockDocument = new ImageDocument(mockUri, new Uint8Array([1]));
            const { panel, getHandler } = createPanelWithMessageHandler();

            await provider.resolveCustomEditor(
                mockDocument, panel, { isCancellationRequested: false } as any
            );

            mockDeleteApiKey.mockResolvedValue(undefined);

            const handler = getHandler();
            handler({
                type: 'aiConfigureKey',
                body: { provider: 'google', action: 'remove' },
            });

            await vi.waitFor(() => {
                expect(mockCreateAIService).toHaveBeenCalledWith('google', mockSecrets);
                expect(mockDeleteApiKey).toHaveBeenCalled();
            });
        });
    });

    describe('openCustomDocument with ORA sidecar', () => {
        it('should include oraData in init when .ora sidecar exists', async () => {
            const mockUri = { scheme: 'file', path: '/test/image.png', toString: () => 'file:///test/image.png' } as any;
            const fileData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
            const oraData = new Uint8Array([0x50, 0x4B, 0x03, 0x04]);

            mockReadFile.mockImplementation((uri: any) => {
                if (uri.path.endsWith('.ora')) return Promise.resolve(oraData);
                return Promise.resolve(fileData);
            });
            mockStat.mockResolvedValue({ type: 1 }); // .ora exists

            const doc = await provider.openCustomDocument(
                mockUri,
                { backupId: undefined, untitledDocumentData: undefined } as any,
                { isCancellationRequested: false } as any
            );

            // Set up panel so we can verify the init message
            const mockWebviewPanel = {
                webview: {
                    options: {},
                    html: '',
                    onDidReceiveMessage: mockOnDidReceiveMessage,
                    postMessage: mockPostMessage,
                    asWebviewUri: (uri: any) => uri,
                    cspSource: 'https://test.vscode-resource.com',
                },
                onDidDispose: vi.fn(),
            } as any;
            mockOnDidReceiveMessage.mockReturnValue({ dispose: vi.fn() });
            mockWebviewPanel.onDidDispose.mockReturnValue({ dispose: vi.fn() });
            mockPostMessage.mockResolvedValue(true);

            await provider.resolveCustomEditor(
                doc, mockWebviewPanel, { isCancellationRequested: false } as any
            );

            // Simulate 'ready' message to trigger init
            const handler = mockOnDidReceiveMessage.mock.calls[0][0];
            handler({ type: 'ready' });

            expect(mockPostMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'init',
                    body: expect.objectContaining({
                        oraData: Array.from(oraData),
                    }),
                }),
            );
        });
    });
});
