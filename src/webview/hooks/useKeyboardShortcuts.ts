import { useEffect } from 'react';
import { useEditorStore } from '../state/editorStore';

export function useKeyboardShortcuts(): void {
  const setZoom = useEditorStore((s) => s.setZoom);

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;

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
