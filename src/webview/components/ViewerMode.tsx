import React, { useRef, useEffect } from 'react';
import { useEditorStore } from '../state/editorStore';

const ViewerMode: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zoom = useEditorStore((s) => s.zoom);
  const panX = useEditorStore((s) => s.panX);
  const panY = useEditorStore((s) => s.panY);
  const imageData = useEditorStore((s) => s.imageData);
  const setCanvasSize = useEditorStore((s) => s.setCanvasSize);
  const setMode = useEditorStore((s) => s.setMode);

  useEffect(() => {
    if (!imageData || !canvasRef.current) return;

    const blob = new Blob([imageData.buffer as ArrayBuffer]);
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.width;
      canvas.height = img.height;
      setCanvasSize(img.width, img.height);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, [imageData, setCanvasSize]);

  return (
    <div className="editor-canvas-area">
      <div
        className="canvas-container"
        style={{
          transform: `scale(${zoom}) translate(${panX}px, ${panY}px)`,
        }}
      >
        <canvas
          ref={canvasRef}
          data-testid="viewer-canvas"
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
