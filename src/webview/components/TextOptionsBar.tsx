import React, { useCallback } from 'react';
import { Bold, Italic } from 'lucide-react';
import { useEditorStore } from '../state/editorStore';
import { useLayerStore } from '../state/layerStore';
import type { TextData } from '../state/layerStore';
import { renderTextToLayer, requestRender } from '../engine/engineContext';

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

  // 활성 레이어가 텍스트 레이어면 변경사항 즉시 반영
  const applyToActiveTextLayer = useCallback((overrides: Partial<TextData>) => {
    const { activeLayerId, layers, setLayerTextData, bumpThumbnailVersion } = useLayerStore.getState();
    const layer = layers.find((l) => l.id === activeLayerId);
    if (!layer?.textData) return;
    const { fillColor } = useEditorStore.getState();
    const newTextData: TextData = { ...layer.textData, ...overrides };
    renderTextToLayer(activeLayerId, newTextData, fillColor);
    setLayerTextData(activeLayerId, newTextData);
    bumpThumbnailVersion();
    requestRender();
  }, []);

  return (
    <>
      <div className="toolbar-separator" />
      <select
        className="toolbar-font-select"
        value={fontFamily}
        onChange={(e) => { setFontFamily(e.target.value); applyToActiveTextLayer({ fontFamily: e.target.value }); }}
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
        onChange={(e) => { const v = Math.max(6, parseInt(e.target.value) || 24); setFontSize(v); applyToActiveTextLayer({ fontSize: v }); }}
        title="Font Size"
        style={{ width: 48, fontSize: 12, padding: '2px 4px', borderRadius: 4, textAlign: 'center', background: 'var(--vscode-input-background, #3c3c3c)', color: 'var(--vscode-input-foreground, #cccccc)', border: '1px solid var(--vscode-input-border, #555)' }}
      />
      <button
        className={`toolbar-btn${fontBold ? ' active' : ''}`}
        onClick={() => { setFontBold(!fontBold); applyToActiveTextLayer({ bold: !fontBold }); }}
        title="Bold"
      >
        <Bold size={14} />
      </button>
      <button
        className={`toolbar-btn${fontItalic ? ' active' : ''}`}
        onClick={() => { setFontItalic(!fontItalic); applyToActiveTextLayer({ italic: !fontItalic }); }}
        title="Italic"
      >
        <Italic size={14} />
      </button>
    </>
  );
};

export default TextOptionsBar;
