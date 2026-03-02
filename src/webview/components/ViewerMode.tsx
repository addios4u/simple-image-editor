import React, { useRef, useEffect } from 'react';
import { useEditorStore } from '../state/editorStore';
import ZoomControls from './ZoomControls';

const ViewerMode: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zoom = useEditorStore((s) => s.zoom);
  const panX = useEditorStore((s) => s.panX);
  const panY = useEditorStore((s) => s.panY);
  const imageData = useEditorStore((s) => s.imageData);
  const fillColor = useEditorStore((s) => s.fillColor);
  const strokeColor = useEditorStore((s) => s.strokeColor);
  const setFillColor = useEditorStore((s) => s.setFillColor);
  const setStrokeColor = useEditorStore((s) => s.setStrokeColor);
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
      <div className="viewer-toolbar">
        <ZoomControls />
        <div className="toolbar-separator" />
        <span className="color-label">Fill</span>
        <div className="color-swatch" style={{ background: fillColor }}>
          <input
            type="color"
            value={fillColor}
            onChange={(e) => setFillColor(e.target.value)}
            title="Fill Color"
          />
        </div>
        <span className="color-label">Stroke</span>
        <div className="color-swatch" style={{ background: strokeColor }}>
          <input
            type="color"
            value={strokeColor}
            onChange={(e) => setStrokeColor(e.target.value)}
            title="Stroke Color"
          />
        </div>
        <div className="toolbar-separator" />
        <button
          className="toolbar-btn"
          onClick={() => setMode('editor')}
          title="Edit Mode (E)"
        >
          Edit
        </button>
      </div>
    </div>
  );
};

export default ViewerMode;
