import React, { useEffect } from 'react';
import { useEditorStore } from './state/editorStore';
import ViewerMode from './components/ViewerMode';
import EditorMode from './components/EditorMode';
import vscodeApi from './vscode';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
interface InitMessage {
    type: 'init';
    body: { data: number[]; fileName: string; isUntitled: boolean };
}

const App: React.FC = () => {
    const mode = useEditorStore((s) => s.mode);
    const setImageData = useEditorStore((s) => s.setImageData);

    useKeyboardShortcuts();

    useEffect(() => {
        const handler = (event: MessageEvent) => {
            const message = event.data;
            if (message?.type === 'init') {
                const { data, fileName } = (message as InitMessage).body;
                setImageData(new Uint8Array(data), fileName);
            }
        };
        window.addEventListener('message', handler);
        // Signal extension host that the webview is ready to receive data
        vscodeApi.postMessage({ type: 'ready' });
        return () => window.removeEventListener('message', handler);
    }, [setImageData]);

    return mode === 'viewer' ? <ViewerMode /> : <EditorMode />;
};

export default App;
