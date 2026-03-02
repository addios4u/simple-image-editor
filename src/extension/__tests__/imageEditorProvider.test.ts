import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so mocks are available when vi.mock factory runs (hoisted to top)
const {
    mockReadFile,
    mockWriteFile,
    mockRegisterCustomEditorProvider,
    mockOnDidReceiveMessage,
    mockPostMessage,
} = vi.hoisted(() => ({
    mockReadFile: vi.fn(),
    mockWriteFile: vi.fn(),
    mockRegisterCustomEditorProvider: vi.fn(),
    mockOnDidReceiveMessage: vi.fn(),
    mockPostMessage: vi.fn(),
}));

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

import { ImageEditorProvider } from '../imageEditorProvider';
import { ImageDocument } from '../imageDocument';

describe('ImageEditorProvider', () => {
    let provider: ImageEditorProvider;
    const mockContext = {
        subscriptions: [],
        extensionUri: { scheme: 'file', path: '/ext', toString: () => 'file:///ext' },
        extensionPath: '/ext',
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
        it('should write document data to file', async () => {
            const mockUri = { scheme: 'file', path: '/test/image.png', toString: () => 'file:///test/image.png' } as any;
            const data = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
            const mockDocument = new ImageDocument(mockUri, data);

            mockWriteFile.mockResolvedValue(undefined);

            await provider.saveCustomDocument(
                mockDocument,
                { isCancellationRequested: false } as any
            );

            expect(mockWriteFile).toHaveBeenCalledWith(mockUri, data);
        });
    });
});
