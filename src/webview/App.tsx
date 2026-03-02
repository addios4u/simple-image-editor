import React, { useEffect } from 'react';
import { useEditorStore } from './state/editorStore';
import ViewerMode from './components/ViewerMode';
import EditorMode from './components/EditorMode';
interface InitMessage {
    type: 'init';
    body: { data: number[]; fileName: string; isUntitled: boolean };
}

const App: React.FC = () => {
    const mode = useEditorStore((s) => s.mode);
    const setImageData = useEditorStore((s) => s.setImageData);

    useEffect(() => {
        const handler = (event: MessageEvent) => {
            const message = event.data;
            if (message?.type === 'init') {
                const { data, fileName } = (message as InitMessage).body;
                setImageData(new Uint8Array(data), fileName);
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, [setImageData]);

    return mode === 'viewer' ? <ViewerMode /> : <EditorMode />;
};

export default App;
