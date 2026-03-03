import { useEffect } from 'react';
import { useEditorStore, ToolType } from '../state/editorStore';
import { useHistoryStore } from '../state/historyStore';
import { useLayerStore } from '../state/layerStore';
import { fillRectLayer, requestRender, copySelection, cutSelection, pasteClipboard } from '../engine/engineContext';
import { hexToPackedRGBA } from '../engine/helpers';

const TOOL_KEYS: Record<string, ToolType> = {
  v: 'move',
  s: 'select',
  b: 'brush',
  t: 'text',
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

        // Clipboard
        if (key === 'c' || key === 'x') {
          const { selection } = useEditorStore.getState();
          if (!selection) return;
          const { activeLayerId } = useLayerStore.getState();
          e.preventDefault();
          if (key === 'c') {
            copySelection(activeLayerId, selection.x, selection.y, selection.width, selection.height);
          } else {
            cutSelection(activeLayerId, selection.x, selection.y, selection.width, selection.height);
            requestRender();
          }
          return;
        }
        if (key === 'v' && !e.shiftKey) {
          e.preventDefault();
          const { activeLayerId } = useLayerStore.getState();
          pasteClipboard(activeLayerId, 0, 0);
          requestRender();
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

      // --- Alt+Backspace: Fill ---
      if (e.altKey && e.key === 'Backspace') {
        e.preventDefault();
        const { selection, canvasWidth, canvasHeight, fillColor } = useEditorStore.getState();
        const { activeLayerId } = useLayerStore.getState();
        const rgba = hexToPackedRGBA(fillColor);
        const rect = selection ?? { x: 0, y: 0, width: canvasWidth, height: canvasHeight };
        fillRectLayer(activeLayerId, rect.x, rect.y, rect.width, rect.height, rgba);
        requestRender();
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
