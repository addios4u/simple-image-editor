import React, { useRef, useEffect, useCallback, useState } from 'react';
import ReactDOM from 'react-dom';
import { Bold, Italic } from 'lucide-react';
import type { TextData } from '../state/layerStore';
import { useEditorStore } from '../state/editorStore';

const WEB_SAFE_FONTS = [
  'sans-serif', 'serif', 'monospace',
  'Arial', 'Georgia', 'Courier New', 'Times New Roman', 'Verdana', 'Tahoma', 'Trebuchet MS',
];

interface TextInputDialogProps {
  existing?: TextData;
  onConfirm: (text: string) => void;
  onCancel: () => void;
}

const TextInputDialog: React.FC<TextInputDialogProps> = ({ existing, onConfirm, onCancel }) => {
  const [text, setText] = useState(existing?.text ?? '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fontFamily = useEditorStore((s) => s.fontFamily);
  const fontSize = useEditorStore((s) => s.fontSize);
  const fontBold = useEditorStore((s) => s.fontBold);
  const fontItalic = useEditorStore((s) => s.fontItalic);
  const fillColor = useEditorStore((s) => s.fillColor);
  const setFillColor = useEditorStore((s) => s.setFillColor);
  const setFontFamily = useEditorStore((s) => s.setFontFamily);
  const setFontSize = useEditorStore((s) => s.setFontSize);
  const setFontBold = useEditorStore((s) => s.setFontBold);
  const setFontItalic = useEditorStore((s) => s.setFontItalic);

  useEffect(() => {
    const id = setTimeout(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      ta.select();
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      const trimmed = text.trim();
      if (trimmed) onConfirm(text);
      else onCancel();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }, [text, onConfirm, onCancel]);

  const dialog = (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        style={{
          background: '#2d2d2d',
          border: '1px solid #555',
          borderRadius: 6,
          padding: '16px 20px',
          minWidth: 360,
          maxWidth: 560,
          width: '40vw',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          color: '#ccc',
          fontSize: 12,
          fontFamily: 'inherit',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 13, color: '#eee' }}>텍스트 입력</div>

        {/* 폰트 옵션 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <select
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
            style={inputStyle}
          >
            {WEB_SAFE_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <input
            type="number" min={6} max={500}
            value={fontSize}
            onChange={(e) => setFontSize(Math.max(6, parseInt(e.target.value) || 24))}
            style={{ ...inputStyle, width: 52, textAlign: 'center' }}
          />
          <button
            onClick={() => setFontBold(!fontBold)}
            style={toggleBtnStyle(fontBold)}
            title="Bold"
          >
            <Bold size={13} />
          </button>
          <button
            onClick={() => setFontItalic(!fontItalic)}
            style={toggleBtnStyle(fontItalic)}
            title="Italic"
          >
            <Italic size={13} />
          </button>
          <label
            title="텍스트 색상"
            style={{ width: 18, height: 18, borderRadius: 3, background: fillColor, border: '1px solid #777', flexShrink: 0, cursor: 'pointer', position: 'relative', display: 'inline-block' }}
          >
            <input
              type="color"
              value={fillColor}
              onChange={(e) => setFillColor(e.target.value)}
              style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', padding: 0, border: 'none' }}
            />
          </label>
        </div>

        {/* 텍스트 입력 */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="텍스트 입력 (Enter: 개행, Cmd+Enter: 확정, Esc: 취소)"
          rows={5}
          style={{
            fontFamily,
            fontSize,
            fontWeight: fontBold ? 'bold' : 'normal',
            fontStyle: fontItalic ? 'italic' : 'normal',
            color: '#ddd',
            background: '#1e1e1e',
            border: '1px solid #555',
            borderRadius: 4,
            padding: '8px',
            resize: 'vertical',
            width: '100%',
            boxSizing: 'border-box',
            lineHeight: 1.4,
            outline: 'none',
          }}
        />

        {/* 버튼 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onCancel} style={btnStyle('#3c3c3c')}>취소 (Esc)</button>
          <button
            onClick={() => { const t = text.trim(); if (t) onConfirm(text); else onCancel(); }}
            style={btnStyle('#0066cc')}
          >
            확인 (Cmd+Enter)
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(dialog, document.body);
};

const inputStyle: React.CSSProperties = {
  background: '#1e1e1e',
  border: '1px solid #555',
  borderRadius: 3,
  color: '#ccc',
  fontSize: 11,
  padding: '3px 6px',
  cursor: 'pointer',
};

function toggleBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '3px 7px',
    background: active ? '#0066cc' : '#3c3c3c',
    border: '1px solid #555',
    borderRadius: 3,
    color: '#eee',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  };
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    padding: '5px 16px',
    background: bg,
    border: 'none',
    borderRadius: 4,
    color: '#eee',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
  };
}

export default TextInputDialog;
