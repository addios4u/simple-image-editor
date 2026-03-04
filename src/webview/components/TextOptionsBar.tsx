import React from 'react';
import { Bold, Italic } from 'lucide-react';
import { useEditorStore } from '../state/editorStore';

const WEB_SAFE_FONTS = [
  'sans-serif',
  'serif',
  'monospace',
  'Arial',
  'Georgia',
  'Courier New',
  'Times New Roman',
  'Verdana',
  'Tahoma',
  'Trebuchet MS',
];

const TextOptionsBar: React.FC = () => {
  const fontFamily = useEditorStore((s) => s.fontFamily);
  const fontSize = useEditorStore((s) => s.fontSize);
  const fontBold = useEditorStore((s) => s.fontBold);
  const fontItalic = useEditorStore((s) => s.fontItalic);
  const setFontFamily = useEditorStore((s) => s.setFontFamily);
  const setFontSize = useEditorStore((s) => s.setFontSize);
  const setFontBold = useEditorStore((s) => s.setFontBold);
  const setFontItalic = useEditorStore((s) => s.setFontItalic);

  return (
    <>
      <div className="toolbar-separator" />
      <select
        className="toolbar-font-select"
        value={fontFamily}
        onChange={(e) => setFontFamily(e.target.value)}
        title="Font Family"
        style={{ fontSize: 12, padding: '2px 4px', borderRadius: 4, background: 'var(--vscode-input-background, #3c3c3c)', color: 'var(--vscode-input-foreground, #cccccc)', border: '1px solid var(--vscode-input-border, #555)', cursor: 'pointer' }}
      >
        {WEB_SAFE_FONTS.map((f) => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>
      <input
        className="toolbar-font-size"
        type="number"
        min={6}
        max={500}
        value={fontSize}
        onChange={(e) => setFontSize(Math.max(6, parseInt(e.target.value) || 24))}
        title="Font Size"
        style={{ width: 48, fontSize: 12, padding: '2px 4px', borderRadius: 4, textAlign: 'center', background: 'var(--vscode-input-background, #3c3c3c)', color: 'var(--vscode-input-foreground, #cccccc)', border: '1px solid var(--vscode-input-border, #555)' }}
      />
      <button
        className={`toolbar-btn${fontBold ? ' active' : ''}`}
        onClick={() => setFontBold(!fontBold)}
        title="Bold"
      >
        <Bold size={14} />
      </button>
      <button
        className={`toolbar-btn${fontItalic ? ' active' : ''}`}
        onClick={() => setFontItalic(!fontItalic)}
        title="Italic"
      >
        <Italic size={14} />
      </button>
    </>
  );
};

export default TextOptionsBar;
