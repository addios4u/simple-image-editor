import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Minus, Plus } from 'lucide-react';
import { useEditorStore } from '../state/editorStore';
import ModeSegment from './ModeSegment';
import BuyMeACoffee from './BuyMeACoffee';
import Minimap from './Minimap';
import { t } from '../i18n';

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

function getMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'png': return 'image/png';
    case 'jpg': case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'svg': return 'image/svg+xml';
    case 'bmp': return 'image/bmp';
    case 'webp': return 'image/webp';
    default: return 'image/png';
  }
}

const ViewerMode: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const scrollStart = useRef({ x: 0, y: 0 });

  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);
  const imageData = useEditorStore((s) => s.imageData);
  const fileName = useEditorStore((s) => s.fileName);
  const canvasWidth = useEditorStore((s) => s.canvasWidth);
  const canvasHeight = useEditorStore((s) => s.canvasHeight);
  const isDirty = useEditorStore((s) => s.isDirty);
  const fillColor = useEditorStore((s) => s.fillColor);
  const setFillColor = useEditorStore((s) => s.setFillColor);
  const setCanvasSize = useEditorStore((s) => s.setCanvasSize);

  const isSvg = fileName.toLowerCase().endsWith('.svg');
  const [svgUrl, setSvgUrl] = useState<string | null>(null);
  const [grabbing, setGrabbing] = useState(false);
  const [copied, setCopied] = useState('');
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  // Draw image on canvas (raster) or prepare SVG URL
  useEffect(() => {
    if (!imageData) return;

    const mime = getMimeType(fileName);
    const blob = new Blob([imageData.buffer as ArrayBuffer], { type: mime });
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
      if (isSvg) {
        setSvgUrl(url);
      } else {
        URL.revokeObjectURL(url);
      }
    };
    img.src = url;
    return () => {
      if (isSvg) URL.revokeObjectURL(url);
    };
  }, [imageData, fileName, isSvg, setCanvasSize]);

  // Drag-to-pan
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
    // Track cursor position in image coordinates
    const el = isSvg ? imgRef.current : canvasRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      const imgX = Math.round((e.clientX - rect.left) / zoom);
      const imgY = Math.round((e.clientY - rect.top) / zoom);
      setCursorPos({ x: Math.max(0, imgX), y: Math.max(0, imgY) });
    }

    if (!isDragging.current) return;
    const area = areaRef.current;
    if (!area) return;
    area.scrollLeft = scrollStart.current.x - (e.clientX - dragStart.current.x);
    area.scrollTop = scrollStart.current.y - (e.clientY - dragStart.current.y);
  }, [zoom, isSvg]);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    setGrabbing(false);
  }, []);

  // Eyedropper
  const pickColor = useCallback(async () => {
    if (!('EyeDropper' in window)) return;
    const EyeDropper = (window as any).EyeDropper;
    try {
      const result = await new EyeDropper().open();
      setFillColor(result.sRGBHex);
    } catch { /* cancelled */ }
  }, [setFillColor]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(''), 1500);
  }, []);

  const zoomIn = () => setZoom(Math.min(zoom * 1.25, 32));
  const zoomOut = () => setZoom(Math.max(zoom / 1.25, 0.01));

  return (
    <>
      <div className="editor-toolbar">
        <button className="toolbar-btn" onClick={zoomOut} title={t('Zoom Out')}>
          <Minus size={14} />
        </button>
        <span className="zoom-label clickable" onClick={() => setZoom(1)} title={t('Reset to 100%')}>{Math.round(zoom * 100)}%</span>
        <button className="toolbar-btn" onClick={zoomIn} title={t('Zoom In')}>
          <Plus size={14} />
        </button>
        <div className="toolbar-separator" />
        <div className="color-picker-group">
          <button
            className="color-swatch-btn"
            style={{ background: fillColor }}
            onClick={pickColor}
            title={t('Pick Color (Eyedropper)')}
          />
          <div className="color-info">
            <span
              className={`color-hex${copied === fillColor ? ' copied' : ''}`}
              onClick={() => copyToClipboard(fillColor)}
              title={t('Copy HEX')}
            >
              {copied === fillColor ? t('Copied!') : fillColor}
            </span>
            <span
              className={`color-rgb${copied === `rgb(${hexToRgb(fillColor)})` ? ' copied' : ''}`}
              onClick={() => copyToClipboard(`rgb(${hexToRgb(fillColor)})`)}
              title={t('Copy RGB')}
            >
              {copied === `rgb(${hexToRgb(fillColor)})` ? t('Copied!') : `rgb(${hexToRgb(fillColor)})`}
            </span>
          </div>
        </div>
        <div className="toolbar-separator" />
        <span className="toolbar-file-label">
          {isDirty && <span className="dirty-indicator" title={t('Unsaved changes')}>●</span>}
          {fileName || 'untitled'} — {canvasWidth} x {canvasHeight}
        </span>
        <div className="toolbar-spacer" />
        <ModeSegment />
        <BuyMeACoffee />
      </div>
      <div className="toolbar-divider" />
      <div className="canvas-area-wrapper">
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
            style={{
              width: canvasWidth * zoom,
              height: canvasHeight * zoom,
            }}
          >
            <canvas
              ref={canvasRef}
              data-testid="viewer-canvas"
              style={isSvg
                ? { display: 'none' }
                : { transform: `scale(${zoom})`, transformOrigin: '0 0' }
              }
            />
            {isSvg && svgUrl && (
              <img
                ref={imgRef}
                src={svgUrl}
                alt={fileName}
                style={{ width: '100%', height: '100%' }}
              />
            )}
          </div>
        </div>
        <Minimap
          mode="scroll"
          sourceCanvas={canvasRef.current}
          containerEl={areaRef.current}
          zoom={zoom}
          docWidth={canvasWidth}
          docHeight={canvasHeight}
          cursorX={cursorPos.x}
          cursorY={cursorPos.y}
        />
      </div>
    </>
  );
};

export default ViewerMode;
