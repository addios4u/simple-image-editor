import React from 'react';
import { useEditorStore, type ToolType } from '../state/editorStore';

interface ToolDef {
  type: ToolType;
  label: string;
  shortcut: string;
}

const tools: ToolDef[] = [
  { type: 'select', label: 'Select', shortcut: 'V' },
  { type: 'marquee', label: 'Marquee', shortcut: 'M' },
  { type: 'brush', label: 'Brush', shortcut: 'B' },
  { type: 'text', label: 'Text', shortcut: 'T' },
  { type: 'zoom', label: 'Zoom', shortcut: 'Z' },
];

const Toolbar: React.FC = () => {
  const activeTool = useEditorStore((s) => s.activeTool);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);

  return (
    <div className="editor-toolbar" data-testid="toolbar">
      {tools.map((tool) => (
        <button
          key={tool.type}
          className={`toolbar-btn${activeTool === tool.type ? ' active' : ''}`}
          onClick={() => setActiveTool(tool.type)}
          title={`${tool.label} (${tool.shortcut})`}
        >
          {tool.label}
        </button>
      ))}
    </div>
  );
};

export default Toolbar;
