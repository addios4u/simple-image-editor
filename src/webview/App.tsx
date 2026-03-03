import React, { useEffect } from 'react';
import { useEditorStore } from './state/editorStore';
import ViewerMode from './components/ViewerMode';
import EditorMode from './components/EditorMode';
import vscodeApi from './vscode';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { initEngine, loadImage, requestRender, compositeToBytes } from './engine/engineContext';
import { loadWasmModule } from './engine/loadWasm';

interface InitMessage {
    type: 'init';
    body: { data: number[]; fileName: string; isUntitled: boolean };
}

interface GetFileDataMessage {
    type: 'getFileData';
    body: { requestId: string; format: string };
}

const App: React.FC = () => {
    const mode = useEditorStore((s) => s.mode);
    const fileName = useEditorStore((s) => s.fileName);
    const setImageData = useEditorStore((s) => s.setImageData);
    const setCanvasSize = useEditorStore((s) => s.setCanvasSize);

    const isSvg = fileName.toLowerCase().endsWith('.svg');

    useKeyboardShortcuts();

    useEffect(() => {
        const handler = async (event: MessageEvent) => {
            const message = event.data;

            if (message?.type === 'init') {
                const { data, fileName: fName } = (message as InitMessage).body;
                const imageBytes = new Uint8Array(data);
                setImageData(imageBytes, fName);

                // Skip WASM engine initialization for SVG files
                if (!fName.toLowerCase().endsWith('.svg')) {
                    try {
                        await initEngine(loadWasmModule);
                        const { width, height } = loadImage(imageBytes, 'layer-1');
                        setCanvasSize(width, height);
                        requestRender();
                    } catch (err) {
                        console.error('Failed to initialize WASM engine:', err);
                    }
                }
            }

            if (message?.type === 'getFileData') {
                const { requestId, format } = (message as GetFileDataMessage).body;
                try {
                    const bytes = compositeToBytes(format);
                    vscodeApi.postMessage({
                        type: 'getFileDataResponse',
                        body: { requestId, data: Array.from(bytes) },
                    });
                } catch (err) {
                    console.error('Failed to composite image:', err);
                    vscodeApi.postMessage({
                        type: 'getFileDataResponse',
                        body: { requestId, data: [], error: String(err) },
                    });
                }
            }
        };
        window.addEventListener('message', handler);
        // Signal extension host that the webview is ready to receive data
        vscodeApi.postMessage({ type: 'ready' });
        return () => window.removeEventListener('message', handler);
    }, [setImageData, setCanvasSize]);

    return (mode === 'viewer' || isSvg) ? <ViewerMode /> : <EditorMode />;
};

export default App;
