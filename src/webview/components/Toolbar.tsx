import React, { useState, useCallback } from 'react';
import { Minus, Plus, MousePointer2, BoxSelect, PenLine, Type, Download } from 'lucide-react';
import { useEditorStore, type ToolType } from '../state/editorStore';
import ModeSegment from './ModeSegment';
import { compositeToBytes } from '../engine/engineContext';

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

interface ToolDef {
  type: ToolType;
  icon: React.ReactNode;
  label: string;
}

const tools: ToolDef[] = [
  { type: 'move', icon: <MousePointer2 size={18} />, label: 'Move' },
  { type: 'select', icon: <BoxSelect size={18} />, label: 'Select' },
  { type: 'brush', icon: <PenLine size={18} />, label: 'Brush' },
  { type: 'text', icon: <Type size={18} />, label: 'Text' },
];

const Toolbar: React.FC = () => {
  const activeTool = useEditorStore((s) => s.activeTool);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);
  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);
  const fillColor = useEditorStore((s) => s.fillColor);
  const setFillColor = useEditorStore((s) => s.setFillColor);
  const fileName = useEditorStore((s) => s.fileName);
  const canvasWidth = useEditorStore((s) => s.canvasWidth);
  const canvasHeight = useEditorStore((s) => s.canvasHeight);

  const [copied, setCopied] = useState('');

  const zoomIn = () => setZoom(Math.min(zoom * 1.25, 32));
  const zoomOut = () => setZoom(Math.max(zoom / 1.25, 0.01));

  const pickColor = useCallback(async () => {
    if (!('EyeDropper' in window)) return;
    const EyeDropper = (window as any).EyeDropper;
    try {
      const result = await new EyeDropper().open();
      setFillColor(result.sRGBHex);
    } catch { /* cancelled */ }
  }, [setFillColor]);

  const handleExport = useCallback(() => {
    try {
      const bytes = compositeToBytes('png');
      const blob = new Blob([bytes], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (fileName || 'untitled').replace(/\.[^.]+$/, '') + '.png';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  }, [fileName]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(''), 1500);
  }, []);

  return (
    <div className="editor-toolbar" data-testid="toolbar">
      <button className="toolbar-btn" onClick={zoomOut} title="Zoom Out">
        <Minus size={14} />
      </button>
      <span className="zoom-label clickable" onClick={() => setZoom(1)} title="Reset to 100%">{Math.round(zoom * 100)}%</span>
      <button className="toolbar-btn" onClick={zoomIn} title="Zoom In">
        <Plus size={14} />
      </button>
      <div className="toolbar-separator" />
      <div className="color-picker-group">
        <button
          className="color-swatch-btn"
          style={{ background: fillColor }}
          onClick={pickColor}
          title="Pick Color (Eyedropper)"
        />
        <div className="color-info">
          <span
            className={`color-hex${copied === fillColor ? ' copied' : ''}`}
            onClick={() => copyToClipboard(fillColor)}
            title="Copy HEX"
          >
            {copied === fillColor ? 'Copied!' : fillColor}
          </span>
          <span
            className={`color-rgb${copied === `rgb(${hexToRgb(fillColor)})` ? ' copied' : ''}`}
            onClick={() => copyToClipboard(`rgb(${hexToRgb(fillColor)})`)}
            title="Copy RGB"
          >
            {copied === `rgb(${hexToRgb(fillColor)})` ? 'Copied!' : `rgb(${hexToRgb(fillColor)})`}
          </span>
        </div>
      </div>
      <div className="toolbar-separator" />
      {tools.map((tool) => (
        <button
          key={tool.type}
          className={`toolbar-btn${activeTool === tool.type ? ' active' : ''}`}
          onClick={() => setActiveTool(tool.type)}
          title={tool.label}
        >
          {tool.icon}
        </button>
      ))}
      <button
        className="toolbar-btn"
        onClick={handleExport}
        title="Export"
      >
        <Download size={18} />
      </button>
      <div className="toolbar-separator" />
      <span className="toolbar-file-label">
        {fileName || 'untitled'} — {canvasWidth} x {canvasHeight}
      </span>
      <div className="toolbar-spacer" />
      <ModeSegment />
    </div>
  );
};

export default Toolbar;
