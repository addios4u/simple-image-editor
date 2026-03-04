import React, { useRef, useEffect, useCallback, useState } from 'react';
import type { TextData } from '../state/layerStore';
import { useEditorStore } from '../state/editorStore';

interface TextInputOverlayProps {
  /** Canvas 좌표 (zoom 적용 전) */
  x: number;
  y: number;
  zoom: number;
  existing?: TextData;
  onConfirm: (text: string) => void;
  onCancel: () => void;
}

const TextInputOverlay: React.FC<TextInputOverlayProps> = ({
  x, y, zoom, existing, onConfirm, onCancel,
}) => {
  const [text, setText] = useState(existing?.text ?? '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fontFamily = useEditorStore((s) => s.fontFamily);
  const fontSize = useEditorStore((s) => s.fontSize);
  const fontBold = useEditorStore((s) => s.fontBold);
  const fontItalic = useEditorStore((s) => s.fontItalic);
  const fillColor = useEditorStore((s) => s.fillColor);

  // 마운트 시 포커스
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.focus();
    ta.select();
  }, []);

  // 내용에 맞게 textarea 높이 자동 조절
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
  }, [text]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const trimmed = text.trim();
      if (trimmed) onConfirm(text);
      else onCancel();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }, [text, onConfirm, onCancel]);

  const scaledFontSize = fontSize * zoom;

  return (
    <div
      data-testid="text-input-overlay"
      style={{
        position: 'absolute',
        left: x * zoom,
        top: y * zoom,
        zIndex: 200,
        pointerEvents: 'all',
      }}
    >
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="텍스트 입력… (Enter: 확정, Shift+Enter: 줄바꿈, Esc: 취소)"
        rows={1}
        style={{
          fontFamily,
          fontSize: `${scaledFontSize}px`,
          fontWeight: fontBold ? 'bold' : 'normal',
          fontStyle: fontItalic ? 'italic' : 'normal',
          color: fillColor,
          lineHeight: 1.2,
          background: 'rgba(0,0,0,0.05)',
          border: '1.5px dashed #0088ff',
          outline: 'none',
          resize: 'none',
          overflow: 'hidden',
          minWidth: `${Math.max(120, scaledFontSize * 4)}px`,
          minHeight: `${scaledFontSize * 1.4}px`,
          padding: '2px 4px',
          boxSizing: 'border-box',
          whiteSpace: 'pre',
        }}
      />
    </div>
  );
};

export default TextInputOverlay;
