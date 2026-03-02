import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useEditorStore } from '../state/editorStore';
import ZoomControls from './ZoomControls';

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

const ViewerMode: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const scrollStart = useRef({ x: 0, y: 0 });

  const zoom = useEditorStore((s) => s.zoom);
  const imageData = useEditorStore((s) => s.imageData);
  const fillColor = useEditorStore((s) => s.fillColor);
  const strokeColor = useEditorStore((s) => s.strokeColor);
  const setFillColor = useEditorStore((s) => s.setFillColor);
  const setStrokeColor = useEditorStore((s) => s.setStrokeColor);
  const setCanvasSize = useEditorStore((s) => s.setCanvasSize);
  const setMode = useEditorStore((s) => s.setMode);

  const [grabbing, setGrabbing] = useState(false);

  // Draw image on canvas
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

  // Drag-to-pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const area = areaRef.current;
    if (!area) return;
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    scrollStart.current = { x: area.scrollLeft, y: area.scrollTop };
    setGrabbing(true);
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const area = areaRef.current;
    if (!area) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    area.scrollLeft = scrollStart.current.x - dx;
    area.scrollTop = scrollStart.current.y - dy;
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    setGrabbing(false);
  }, []);

  // Eyedropper color picker
  const pickColor = useCallback(async (target: 'fill' | 'stroke') => {
    if (!('EyeDropper' in window)) return;
    const EyeDropper = (window as any).EyeDropper;
    const dropper = new EyeDropper();
    try {
      const result = await dropper.open();
      if (target === 'fill') {
        setFillColor(result.sRGBHex);
      } else {
        setStrokeColor(result.sRGBHex);
      }
    } catch {
      // User cancelled
    }
  }, [setFillColor, setStrokeColor]);

  return (
    <div
      ref={areaRef}
      className="editor-canvas-area"
      style={{ cursor: grabbing ? 'grabbing' : 'grab' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        className="canvas-container"
        style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
      >
        <canvas
          ref={canvasRef}
          data-testid="viewer-canvas"
        />
      </div>
      <div className="viewer-toolbar" onMouseDown={(e) => e.stopPropagation()}>
        <ZoomControls />
        <div className="toolbar-separator" />
        <div className="color-picker-group">
          <button
            className="color-swatch-btn"
            style={{ background: fillColor }}
            onClick={() => pickColor('fill')}
            title="Pick Fill Color (Eyedropper)"
          />
          <div className="color-info">
            <span className="color-hex">{fillColor.toUpperCase()}</span>
            <span className="color-rgb">RGB({hexToRgb(fillColor)})</span>
          </div>
        </div>
        <div className="color-picker-group">
          <button
            className="color-swatch-btn"
            style={{ background: strokeColor }}
            onClick={() => pickColor('stroke')}
            title="Pick Stroke Color (Eyedropper)"
          />
          <div className="color-info">
            <span className="color-hex">{strokeColor.toUpperCase()}</span>
            <span className="color-rgb">RGB({hexToRgb(strokeColor)})</span>
          </div>
        </div>
        <div className="toolbar-separator" />
        <button
          className="toolbar-btn"
          onClick={() => setMode('editor')}
          title="Edit Mode"
        >
          Edit
        </button>
      </div>
    </div>
  );
};

export default ViewerMode;
