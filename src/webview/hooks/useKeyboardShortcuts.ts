import { useEffect } from 'react';
import { useEditorStore, ToolType } from '../state/editorStore';
import { useHistoryStore } from '../state/historyStore';
import { useLayerStore } from '../state/layerStore';
import {
  fillRectLayer, requestRender, cutSelection,
  copySelectionToBlob, pasteImageAsNewLayer, clearMaskedPixels,
  setInternalClipboard, getInternalClipboard, removeLayer as engineRemoveLayer,
} from '../engine/engineContext';
import { getSelectionMask } from '../engine/selectionMask';
import { hexToPackedRGBA } from '../engine/helpers';

const TOOL_CODES: Record<string, ToolType> = {
  KeyV: 'move',
  KeyM: 'select',
  KeyB: 'brush',
  KeyT: 'text',
};

/** Convert canvas-coordinate mask to layer-local coordinates (mirrors Canvas.tsx helper). */
function adjustMaskForOffset(
  canvasMask: Uint8Array,
  canvasW: number,
  canvasH: number,
  offsetX: number,
  offsetY: number,
): Uint8Array {
  if (offsetX === 0 && offsetY === 0) return canvasMask;
  const layerMask = new Uint8Array(canvasW * canvasH);
  for (let ly = 0; ly < canvasH; ly++) {
    const cy = ly + offsetY;
    if (cy < 0 || cy >= canvasH) continue;
    for (let lx = 0; lx < canvasW; lx++) {
      const cx = lx + offsetX;
      if (cx < 0 || cx >= canvasW) continue;
      layerMask[ly * canvasW + lx] = canvasMask[cy * canvasW + cx];
    }
  }
  return layerMask;
}

export function useKeyboardShortcuts(): void {
  const setZoom = useEditorStore((s) => s.setZoom);

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const isMod = e.metaKey || e.ctrlKey;
      const code = e.code;

      // --- Modifier shortcuts ---
      if (isMod) {
        // Undo / Redo
        if (code === 'KeyZ') {
          e.preventDefault();
          if (e.shiftKey) {
            useHistoryStore.getState().redo();
          } else {
            useHistoryStore.getState().undo();
          }
          return;
        }

        // Copy
        if (code === 'KeyC') {
          const mask = getSelectionMask();
          if (!mask || mask.isEmpty()) return;
          const bounds = mask.getBounds();
          if (!bounds) return;
          e.preventDefault();
          void (async () => {
            const blob = await copySelectionToBlob({ x: bounds.x, y: bounds.y, w: bounds.width, h: bounds.height });
            if (!blob) return;
            setInternalClipboard(blob);
            try {
              await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            } catch {
              console.warn('System clipboard not available');
            }
          })();
          return;
        }

        // Cut
        if (code === 'KeyX') {
          const { selection } = useEditorStore.getState();
          if (!selection) return;
          const { activeLayerId } = useLayerStore.getState();
          e.preventDefault();
          cutSelection(activeLayerId, selection.x, selection.y, selection.width, selection.height);
          requestRender();
          return;
        }

        // Paste — creates new layer (same as context menu)
        if (code === 'KeyV' && !e.shiftKey) {
          e.preventDefault();
          void (async () => {
            let blobToPaste: Blob | null = null;
            try {
              const items = await navigator.clipboard.read();
              for (const item of items) {
                const imageType = item.types.find((t) => t.startsWith('image/'));
                if (imageType) {
                  blobToPaste = await item.getType(imageType);
                  break;
                }
              }
            } catch {
              console.warn('System clipboard read failed');
            }
            if (!blobToPaste) blobToPaste = getInternalClipboard();
            if (!blobToPaste) return;

            const layerStore = useLayerStore.getState();
            layerStore.addLayer();
            const newLayers = useLayerStore.getState().layers;
            const newLayer = newLayers[newLayers.length - 1];
            if (!newLayer) return;
            const ok = await pasteImageAsNewLayer(blobToPaste, newLayer.id);
            if (ok) {
              useLayerStore.getState().setActiveLayer(newLayer.id);
              useLayerStore.getState().bumpThumbnailVersion();
              requestRender();
              let currentLayerId = newLayer.id;
              const savedBlob = blobToPaste;
              useHistoryStore.getState().pushEditWithAction(
                'Paste',
                () => {
                  engineRemoveLayer(currentLayerId);
                  useLayerStore.getState().removeLayer(currentLayerId);
                  requestRender();
                },
                () => {
                  void (async () => {
                    useLayerStore.getState().addLayer();
                    const redoLayers = useLayerStore.getState().layers;
                    const redoLayer = redoLayers[redoLayers.length - 1];
                    if (!redoLayer) return;
                    const redoOk = await pasteImageAsNewLayer(savedBlob, redoLayer.id);
                    if (redoOk) {
                      currentLayerId = redoLayer.id;
                      useLayerStore.getState().setActiveLayer(redoLayer.id);
                      useLayerStore.getState().bumpThumbnailVersion();
                      requestRender();
                    } else {
                      useLayerStore.getState().removeLayer(redoLayer.id);
                    }
                  })();
                },
              );
            } else {
              useLayerStore.getState().removeLayer(newLayer.id);
            }
          })();
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

      // --- Delete / Backspace: Clear selection ---
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const mask = getSelectionMask();
        if (!mask || mask.isEmpty()) return;
        const { activeLayerId } = useLayerStore.getState();
        const { canvasWidth, canvasHeight } = useEditorStore.getState();
        const layer = useLayerStore.getState().layers.find((l) => l.id === activeLayerId);
        const offX = layer?.offsetX ?? 0;
        const offY = layer?.offsetY ?? 0;
        const maskData = mask.getMaskData();
        const adjMask = adjustMaskForOffset(maskData, canvasWidth, canvasHeight, offX, offY);
        e.preventDefault();
        clearMaskedPixels(activeLayerId, adjMask);
        useLayerStore.getState().bumpThumbnailVersion();
        requestRender();
        return;
      }

      // --- Single-key tool shortcuts (no modifier) ---
      if (code === 'KeyM') {
        e.preventDefault();
        const store = useEditorStore.getState();
        if (store.activeTool === 'select') {
          store.toggleSelectionShape();
        } else {
          store.setActiveTool('select');
        }
        return;
      }
      const tool = TOOL_CODES[code];
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
