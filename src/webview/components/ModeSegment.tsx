import React from 'react';
import { Eye, Pencil } from 'lucide-react';
import { useEditorStore, type EditorMode } from '../state/editorStore';

const ModeSegment: React.FC = () => {
  const mode = useEditorStore((s) => s.mode);
  const setMode = useEditorStore((s) => s.setMode);

  return (
    <div className="mode-segment">
      <button
        className={`mode-seg-btn${mode === 'viewer' ? ' active' : ''}`}
        onClick={() => setMode('viewer')}
        title="Viewer"
      >
        <Eye size={14} />
        <span>Viewer</span>
      </button>
      <button
        className={`mode-seg-btn${mode === 'editor' ? ' active' : ''}`}
        onClick={() => setMode('editor')}
        title="Editor"
      >
        <Pencil size={14} />
        <span>Editor</span>
      </button>
    </div>
  );
};

export default ModeSegment;
