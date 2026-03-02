import React from 'react';
import { useEditorStore } from './state/editorStore';
import ViewerMode from './components/ViewerMode';
import EditorMode from './components/EditorMode';

const App: React.FC = () => {
    const mode = useEditorStore((s) => s.mode);

    return mode === 'viewer' ? <ViewerMode /> : <EditorMode />;
};

export default App;
