import React from 'react';
import { useEditorStore } from '../state/editorStore';

const ZoomControls: React.FC = () => {
  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);

  const zoomIn = () => setZoom(Math.min(zoom * 1.25, 32));
  const zoomOut = () => setZoom(Math.max(zoom / 1.25, 0.01));

  return (
    <div className="zoom-controls">
      <button className="zoom-btn" onClick={zoomOut} title="Zoom Out">
        -
      </button>
      <span className="zoom-label">{Math.round(zoom * 100)}%</span>
      <button className="zoom-btn" onClick={zoomIn} title="Zoom In">
        +
      </button>
    </div>
  );
};

export default ZoomControls;
