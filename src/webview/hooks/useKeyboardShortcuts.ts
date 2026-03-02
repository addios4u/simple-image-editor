import { useEffect } from 'react';
import { useEditorStore, type ToolType } from '../state/editorStore';

const toolShortcuts: Record<string, ToolType> = {
  v: 'select',
  m: 'marquee',
  b: 'brush',
  t: 'text',
  z: 'zoom',
};

export function useKeyboardShortcuts(): void {
  const setActiveTool = useEditorStore((s) => s.setActiveTool);
  const setZoom = useEditorStore((s) => s.setZoom);
  const setMode = useEditorStore((s) => s.setMode);
  const mode = useEditorStore((s) => s.mode);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const isMod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      // Mod + = / Mod + -: zoom in/out
      if (isMod && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        const zoom = useEditorStore.getState().zoom;
        setZoom(Math.min(zoom * 1.25, 32));
        return;
      }
      if (isMod && e.key === '-') {
        e.preventDefault();
        const zoom = useEditorStore.getState().zoom;
        setZoom(Math.max(zoom / 1.25, 0.01));
        return;
      }
      // Mod + 0: reset zoom
      if (isMod && e.key === '0') {
        e.preventDefault();
        setZoom(1);
        return;
      }

      // Single key shortcuts (no modifier)
      if (isMod || e.altKey) return;

      // E: toggle viewer/editor mode
      if (key === 'e') {
        setMode(mode === 'viewer' ? 'editor' : 'viewer');
        return;
      }

      // Tool shortcuts (editor mode only)
      if (mode === 'editor') {
        const tool = toolShortcuts[key];
        if (tool) {
          setActiveTool(tool);
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setActiveTool, setZoom, setMode, mode]);
}
