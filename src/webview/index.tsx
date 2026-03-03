// Set webpack nonce for CSP-compliant dynamic script loading.
// Must be set before any dynamic import() calls.
declare let __webpack_nonce__: string;
const nonceMeta = document.querySelector('meta[property="csp-nonce"]');
if (nonceMeta) {
    __webpack_nonce__ = nonceMeta.getAttribute('content') || '';
}

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/editor.css';

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
}
