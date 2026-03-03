import { useEffect } from 'react';
import { useEditorStore, ToolType } from '../state/editorStore';
import { useHistoryStore } from '../state/historyStore';

const TOOL_KEYS: Record<string, ToolType> = {
  v: 'select',
  m: 'marquee',
  b: 'brush',
  t: 'text',
  z: 'zoom',
};

export function useKeyboardShortcuts(): void {
  const setZoom = useEditorStore((s) => s.setZoom);

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const isMod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      // --- Modifier shortcuts ---
      if (isMod) {
        // Undo / Redo
        if (key === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            useHistoryStore.getState().redo();
          } else {
            useHistoryStore.getState().undo();
          }
          return;
        }

        // Zoom
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          const zoom = useEditorStore.getState().zoom;
          setZoom(Math.min(zoom * 1.25, 32));
        } else if (e.key === '-') {
          e.preventDefault();
          const zoom = useEditorStore.getState().zoom;
          setZoom(Math.max(zoom / 1.25, 0.01));
        } else if (e.key === '0') {
          e.preventDefault();
          setZoom(1);
        }
        return;
      }

      // --- Single-key tool shortcuts (no modifier) ---
      const tool = TOOL_KEYS[key];
      if (tool) {
        e.preventDefault();
        useEditorStore.getState().setActiveTool(tool);
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      const zoom = useEditorStore.getState().zoom;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      setZoom(Math.min(Math.max(zoom * factor, 0.01), 32));
    };

    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [setZoom]);
}
