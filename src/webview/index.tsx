import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import vscodeApi from './vscode';
import './styles/editor.css';

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
    vscodeApi.postMessage({ type: 'ready' });
}
