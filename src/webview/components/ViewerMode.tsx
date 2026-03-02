import React from 'react';
import { useEditorStore } from '../state/editorStore';

const ViewerMode: React.FC = () => {
  const zoom = useEditorStore((s) => s.zoom);
  const panX = useEditorStore((s) => s.panX);
  const panY = useEditorStore((s) => s.panY);
  const canvasWidth = useEditorStore((s) => s.canvasWidth);
  const canvasHeight = useEditorStore((s) => s.canvasHeight);
  const setMode = useEditorStore((s) => s.setMode);

  return (
    <div className="editor-canvas-area">
      <div
        className="canvas-container"
        style={{
          transform: `scale(${zoom}) translate(${panX}px, ${panY}px)`,
        }}
      >
        <canvas
          data-testid="viewer-canvas"
          width={canvasWidth}
          height={canvasHeight}
        />
      </div>
      <button
        className="toolbar-btn"
        style={{ position: 'absolute', top: 8, right: 8 }}
        onClick={() => setMode('editor')}
      >
        Edit
      </button>
    </div>
  );
};

export default ViewerMode;
