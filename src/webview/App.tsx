import React, { useEffect } from 'react';
import { useEditorStore } from './state/editorStore';
import ViewerMode from './components/ViewerMode';
import EditorMode from './components/EditorMode';
import vscodeApi from './vscode';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { initEngine, loadImage, loadOraData, requestRender, compositeToBytes, encodeLayerToPng } from './engine/engineContext';
import { writeOra } from './engine/openraster';
import { useLayerStore } from './state/layerStore';
import { loadWasmModule } from './engine/loadWasm';
import { useHistoryStore } from './state/historyStore';
import { useAIStore } from './state/aiStore';

interface InitMessage {
    type: 'init';
    body: { data: number[]; fileName: string; isUntitled: boolean; oraData?: number[]; isOra?: boolean };
}

interface GetFileDataMessage {
    type: 'getFileData';
    body: { requestId: string; format: string };
}

interface GetOraDataMessage {
    type: 'getOraData';
    body: { requestId: string };
}

const App: React.FC = () => {
    const mode = useEditorStore((s) => s.mode);
    const fileName = useEditorStore((s) => s.fileName);
    const setImageData = useEditorStore((s) => s.setImageData);
    const setCanvasSize = useEditorStore((s) => s.setCanvasSize);

    const isSvg = fileName.toLowerCase().endsWith('.svg');

    useKeyboardShortcuts();

    // Subscribe to historyStore to track dirty state and notify extension
    useEffect(() => {
        const unsubscribe = useHistoryStore.subscribe((state, prevState) => {
            if (state.undoStack.length > prevState.undoStack.length) {
                useEditorStore.getState().setDirty(true);
                const latest = state.undoStack[state.undoStack.length - 1];
                vscodeApi.postMessage({
                    type: 'edit',
                    body: {
                        id: latest.id,
                        kind: latest.label,
                        data: {},
                        timestamp: latest.timestamp,
                    },
                });
            }
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        const handler = async (event: MessageEvent) => {
            const message = event.data;

            if (message?.type === 'init') {
                const { data, fileName: fName, oraData, isOra } = (message as InitMessage).body;
                const imageBytes = new Uint8Array(data);
                setImageData(imageBytes, fName);

                // Skip WASM engine initialization for SVG files
                if (!fName.toLowerCase().endsWith('.svg')) {
                    try {
                        await initEngine(loadWasmModule);

                        if (oraData && oraData.length > 0) {
                            // ORA sidecar or .ora direct open → restore layers
                            const { width, height, layers } = loadOraData(new Uint8Array(oraData));
                            setCanvasSize(width, height);
                            useLayerStore.getState().setLayers(
                                layers.map((l) => ({
                                    id: l.id,
                                    name: l.name,
                                    opacity: l.opacity,
                                    visible: l.visible,
                                    locked: false,
                                    blendMode: 'Normal',
                                    offsetX: 0,
                                    offsetY: 0,
                                })),
                            );
                        } else {
                            // Normal image → single layer
                            const { width, height } = loadImage(imageBytes, 'layer-1');
                            setCanvasSize(width, height);
                        }

                        requestRender();

                        // .ora files enter editor mode automatically
                        if (isOra) {
                            useEditorStore.getState().setMode('editor');
                            useEditorStore.getState().setIsOra(true);
                        }
                    } catch (err) {
                        console.error('Failed to initialize WASM engine:', err);
                    }
                }
            }

            if (message?.type === 'triggerUndo') {
                useHistoryStore.getState().undo();
            }

            if (message?.type === 'triggerRedo') {
                useHistoryStore.getState().redo();
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

            if (message?.type === 'aiGenerateResult') {
                const { imageData, error } = message.body;
                const aiStore = useAIStore.getState();
                aiStore.setGenerating(false);
                if (error) {
                    aiStore.setError(error);
                } else if (imageData) {
                    aiStore.setResult(imageData);
                }
            }

            if (message?.type === 'saved') {
                useEditorStore.getState().setDirty(false);
            }

            if (message?.type === 'getOraData') {
                const { requestId } = (message as GetOraDataMessage).body;
                try {
                    const layers = useLayerStore.getState().layers;
                    const { canvasWidth: cw, canvasHeight: ch } = useEditorStore.getState();
                    const oraLayers = layers.map((l) => ({
                        name: l.name,
                        pngData: encodeLayerToPng(l.id),
                        opacity: l.opacity,
                        visible: l.visible,
                    }));
                    const mergedPng = compositeToBytes('png');
                    const thumbnailPng = mergedPng; // reuse merged as thumbnail
                    const oraBytes = writeOra(oraLayers, mergedPng, thumbnailPng, cw, ch);
                    vscodeApi.postMessage({
                        type: 'getOraDataResponse',
                        body: { requestId, data: Array.from(oraBytes), layerCount: layers.length },
                    });
                } catch (err) {
                    console.error('Failed to build ORA data:', err);
                    vscodeApi.postMessage({
                        type: 'getOraDataResponse',
                        body: { requestId, data: [], layerCount: 0 },
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
