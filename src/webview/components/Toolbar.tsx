import React from 'react';
import { Minus, Plus, MousePointer2, BoxSelect, Paintbrush, Type, Search } from 'lucide-react';
import { useEditorStore, type ToolType } from '../state/editorStore';
import ModeSegment from './ModeSegment';

interface ToolDef {
  type: ToolType;
  icon: React.ReactNode;
  label: string;
}

const tools: ToolDef[] = [
  { type: 'select', icon: <MousePointer2 size={18} />, label: 'Select' },
  { type: 'marquee', icon: <BoxSelect size={18} />, label: 'Marquee' },
  { type: 'brush', icon: <Paintbrush size={18} />, label: 'Brush' },
  { type: 'text', icon: <Type size={18} />, label: 'Text' },
  { type: 'zoom', icon: <Search size={18} />, label: 'Zoom' },
];

const Toolbar: React.FC = () => {
  const activeTool = useEditorStore((s) => s.activeTool);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);
  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);
  const fileName = useEditorStore((s) => s.fileName);
  const canvasWidth = useEditorStore((s) => s.canvasWidth);
  const canvasHeight = useEditorStore((s) => s.canvasHeight);

  const zoomIn = () => setZoom(Math.min(zoom * 1.25, 32));
  const zoomOut = () => setZoom(Math.max(zoom / 1.25, 0.01));

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
