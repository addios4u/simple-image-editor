import React, { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import { useEditorStore, type ToolType } from '../state/editorStore';
import Minimap from './Minimap';
import ContextMenu, { type ContextMenuAction } from './ContextMenu';
import FillDialog, { type FillDialogResult } from './FillDialog';
import StrokeDialog, { type StrokeDialogResult } from './StrokeDialog';
import { BaseTool, type PointerEvent as ToolPointerEvent } from '../tools/BaseTool';
import { MoveTool, type MoveToolConfig } from '../tools/MoveTool';
import { MarqueeTool, type MarqueeToolConfig } from '../tools/MarqueeTool';
import { BrushTool, type BrushToolConfig } from '../tools/BrushTool';
import { TextTool } from '../tools/TextTool';
import {
  setupCanvas, setupRenderLoop, compositeAndRender, brushStrokeLayer,
  requestRender, getCanvasSize, setLayerOffset,
  extractMaskedPixels, stampBufferOntoLayer,
  setFloatingLayer, setFloatingOffset, clearFloatingLayer,
  captureLayerRegion, restoreLayerRegion,
  clearMaskedPixels, fillMaskedPixels, strokeMaskedBoundary,
  cropCanvas, copySelectionToBlob, pasteImageAsNewLayer,
  addLayer,
} from '../engine/engineContext';
import { RenderLoop } from '../engine/renderLoop';
import { hexToPackedRGBA } from '../engine/helpers';
import { useLayerStore } from '../state/layerStore';
import { useHistoryStore } from '../state/historyStore';
import { getSelectionMask } from '../engine/selectionMask';

/** Lazy config — getters read current store state on each call. */
const brushConfig: BrushToolConfig = {
  getColor: () => hexToPackedRGBA(useEditorStore.getState().fillColor),
  getSize: () => useEditorStore.getState().strokeWidth,
  getHardness: () => 1.0,
  getActiveLayerId: () => useLayerStore.getState().activeLayerId,
  isLayerLocked: () => {
    const { layers, activeLayerId } = useLayerStore.getState();
    const layer = layers.find((l) => l.id === activeLayerId);
    return layer?.locked ?? false;
  },
  brushStrokeLayer,
  requestRender,
};

const moveConfig: MoveToolConfig = {
  getActiveLayerId: () => useLayerStore.getState().activeLayerId,
  getLayerOffset: (layerId) => {
    const layer = useLayerStore.getState().layers.find((l) => l.id === layerId);
    return { x: layer?.offsetX ?? 0, y: layer?.offsetY ?? 0 };
  },
  isLayerLocked: () => {
    const { layers, activeLayerId } = useLayerStore.getState();
    const layer = layers.find((l) => l.id === activeLayerId);
    return layer?.locked ?? false;
  },
  setLayerOffset: (layerId, x, y) => {
    useLayerStore.getState().setLayerOffset(layerId, x, y);
    setLayerOffset(layerId, x, y);
  },
  requestRender,
  // Selection-move support
  getMask: () => getSelectionMask(),
  getCanvasSize: () => ({
    width: useEditorStore.getState().canvasWidth,
    height: useEditorStore.getState().canvasHeight,
  }),
  extractMaskedPixels,
  stampBufferOntoLayer,
  setFloatingLayer,
  setFloatingOffset,
  clearFloatingLayer,
  captureLayerRegion,
  restoreLayerRegion,
  onContourChange: (contour) => {
    sharedContour = contour;
  },
};

// Shared mutable ref for contour data — written by MarqueeTool, read by overlay renderer.
let sharedContour: Array<Array<[number, number]>> | null = null;

function hexToRgba(hex: string): [number, number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b, 255];
}

const marqueeConfig: MarqueeToolConfig = {
  setSelection: (rect) => useEditorStore.getState().setSelection(rect),
  getSelectionShape: () => useEditorStore.getState().selectionShape,
  getCanvasSize: () => ({
    width: useEditorStore.getState().canvasWidth,
    height: useEditorStore.getState().canvasHeight,
  }),
  getMask: () => getSelectionMask(),
  onContourChange: (contour) => {
    sharedContour = contour;
  },
};

function createTool(type: ToolType): BaseTool {
  switch (type) {
    case 'move':
      return new MoveTool(moveConfig);
    case 'select':
      return new MarqueeTool(marqueeConfig);
    case 'brush':
      return new BrushTool(brushConfig);
    case 'text':
      return new TextTool();
    default:
      return new MoveTool(moveConfig);
  }
}

function toToolEvent(
  e: React.PointerEvent<HTMLCanvasElement>,
  zoom: number,
): ToolPointerEvent {
  const rect = e.currentTarget.getBoundingClientRect();
  // getBoundingClientRect already reflects CSS transforms, so dividing
  // by zoom converts the screen-pixel offset back to canvas pixels.
  return {
    x: (e.clientX - rect.left) / zoom,
    y: (e.clientY - rect.top) / zoom,
    button: e.button,
    shiftKey: e.shiftKey,
    ctrlKey: e.ctrlKey,
    altKey: e.altKey,
  };
}

const Canvas: React.FC = () => {
  const canvasWidth = useEditorStore((s) => s.canvasWidth);
  const canvasHeight = useEditorStore((s) => s.canvasHeight);
  const zoom = useEditorStore((s) => s.zoom);
  const activeTool = useEditorStore((s) => s.activeTool);

  const selection = useEditorStore((s) => s.selection);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const toolRef = useRef<{ type: ToolType; instance: BaseTool } | null>(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const fillColor = useEditorStore((s) => s.fillColor);
  const strokeColor = useEditorStore((s) => s.strokeColor);
  const strokeWidth = useEditorStore((s) => s.strokeWidth);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [fillDialogOpen, setFillDialogOpen] = useState(false);
  const [strokeDialogOpen, setStrokeDialogOpen] = useState(false);
  const pendingMaskRef = useRef<Uint8Array | null>(null);
  const pendingLayerIdRef = useRef<string | null>(null);
  const pendingSelectionRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const antsOffsetRef = useRef(0);
  const antsRafRef = useRef<number>(0);
  const internalClipboardBlobRef = useRef<Blob | null>(null);

  // Setup canvas 2D context and render loop on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setupCanvas(ctx);
    const loop = new RenderLoop(compositeAndRender);
    setupRenderLoop(loop);
    loop.start();

    const engineSize = getCanvasSize();
    if (engineSize.width > 0 && engineSize.height > 0) {
      useEditorStore.getState().setCanvasSize(engineSize.width, engineSize.height);
    }

    requestRender();

    return () => {
      loop.stop();
    };
  }, []);

  // Marching ants animation on the overlay canvas
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;

    let lastTime = 0;
    const ANTS_SPEED = 40; // pixels per second

    const animate = (time: number) => {
      const dt = time - lastTime;
      if (dt > 16) {
        lastTime = time;
        antsOffsetRef.current = (antsOffsetRef.current - (dt * ANTS_SPEED) / 1000) % 8;

        ctx.clearRect(0, 0, overlay.width, overlay.height);
        const contour = sharedContour;
        if (contour && contour.length > 0) {
          ctx.save();
          ctx.lineWidth = 1;
          ctx.strokeStyle = '#000000';
          ctx.setLineDash([4, 4]);
          ctx.lineDashOffset = antsOffsetRef.current;

          for (const loop of contour) {
            if (loop.length < 2) continue;
            ctx.beginPath();
            ctx.moveTo(loop[0][0], loop[0][1]);
            for (let i = 1; i < loop.length; i++) {
              ctx.lineTo(loop[i][0], loop[i][1]);
            }
            ctx.stroke();
          }

          // White pass for visibility on dark backgrounds
          ctx.strokeStyle = '#ffffff';
          ctx.lineDashOffset = antsOffsetRef.current + 4;
          for (const loop of contour) {
            if (loop.length < 2) continue;
            ctx.beginPath();
            ctx.moveTo(loop[0][0], loop[0][1]);
            for (let i = 1; i < loop.length; i++) {
              ctx.lineTo(loop[i][0], loop[i][1]);
            }
            ctx.stroke();
          }
          ctx.restore();
        }
      }
      antsRafRef.current = requestAnimationFrame(animate);
    };

    antsRafRef.current = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(antsRafRef.current);
    };
  }, [canvasWidth, canvasHeight]);

  const tool = useMemo(() => {
    if (!toolRef.current || toolRef.current.type !== activeTool) {
      const instance = createTool(activeTool);
      toolRef.current = { type: activeTool, instance };
    }
    return toolRef.current.instance;
  }, [activeTool]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      tool.onPointerDown(toToolEvent(e, zoom));
    },
    [tool, zoom],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const evt = toToolEvent(e, zoom);
      tool.onPointerMove(evt);
      setCursorPos({ x: Math.round(evt.x), y: Math.round(evt.y) });
    },
    [tool, zoom],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.currentTarget.releasePointerCapture(e.pointerId);
      tool.onPointerUp(toToolEvent(e, zoom));
    },
    [tool, zoom],
  );

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  return (
    <div className="canvas-area-wrapper">
      <div
        ref={containerRef}
        className="editor-canvas-area"
      >
        <div
          className="canvas-container"
          style={{
            width: canvasWidth * zoom,
            height: canvasHeight * zoom,
          }}
        >
          <div
            className="canvas-wrapper"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            <canvas
              ref={canvasRef}
              data-testid="editor-canvas"
              width={canvasWidth}
              height={canvasHeight}
              style={{ cursor: tool.getCursor() }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onContextMenu={handleContextMenu}
            />
            <canvas
              ref={overlayRef}
              data-testid="selection-overlay"
              width={canvasWidth}
              height={canvasHeight}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>
      </div>
      <Minimap
        mode="scroll"
        sourceCanvas={canvasRef.current}
        containerEl={containerRef.current}
        zoom={zoom}
        docWidth={canvasWidth}
        docHeight={canvasHeight}
        cursorX={cursorPos.x}
        cursorY={cursorPos.y}
      />
      {fillDialogOpen && (
        <FillDialog
          initialColor={fillColor}
          onCancel={() => setFillDialogOpen(false)}
          onConfirm={(result: FillDialogResult) => {
            setFillDialogOpen(false);
            const maskData = pendingMaskRef.current;
            const layerId = pendingLayerIdRef.current;
            const sel = pendingSelectionRef.current;
            if (!maskData || !layerId || !sel) return;
            try {
              const [r, g, b] = hexToRgba(result.color);
              const a = Math.round((result.opacity / 100) * 255);
              const { pushEditWithSnapshot, commitSnapshot } = useHistoryStore.getState();
              const before = captureLayerRegion(layerId, sel.x, sel.y, sel.width, sel.height);
              if (!before) return;
              const entryId = pushEditWithSnapshot('Fill Selection', layerId, before,
                { x: sel.x, y: sel.y, w: sel.width, h: sel.height });
              fillMaskedPixels(layerId, maskData, r, g, b, a);
              const after = captureLayerRegion(layerId, sel.x, sel.y, sel.width, sel.height);
              if (after) commitSnapshot(entryId, after);
              useEditorStore.getState().setFillColor(result.color);
              requestRender();
            } catch (e) { console.error('Fill error:', e); }
          }}
        />
      )}
      {strokeDialogOpen && (
        <StrokeDialog
          initialColor={strokeColor}
          initialWidth={strokeWidth}
          onCancel={() => setStrokeDialogOpen(false)}
          onConfirm={(result: StrokeDialogResult) => {
            setStrokeDialogOpen(false);
            const maskData = pendingMaskRef.current;
            const layerId = pendingLayerIdRef.current;
            const sel = pendingSelectionRef.current;
            if (!maskData || !layerId || !sel) return;
            try {
              const [r, g, b, a] = hexToRgba(result.color);
              const { pushEditWithSnapshot, commitSnapshot } = useHistoryStore.getState();
              const before = captureLayerRegion(layerId, sel.x, sel.y, sel.width, sel.height);
              if (!before) return;
              const entryId = pushEditWithSnapshot('Stroke Selection', layerId, before,
                { x: sel.x, y: sel.y, w: sel.width, h: sel.height });
              strokeMaskedBoundary(layerId, maskData, r, g, b, a, result.width);
              const after = captureLayerRegion(layerId, sel.x, sel.y, sel.width, sel.height);
              if (after) commitSnapshot(entryId, after);
              useEditorStore.getState().setStrokeColor(result.color);
              useEditorStore.getState().setStrokeWidth(result.width);
              requestRender();
            } catch (e) { console.error('Stroke error:', e); }
          }}
        />
      )}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          hasSelection={!!selection}
          onClose={() => setContextMenu(null)}
          onAction={async (action: ContextMenuAction) => {
            setContextMenu(null);
            try {
            const mask = getSelectionMask();
            const maskData = mask?.getMaskData();
            const { activeLayerId } = useLayerStore.getState();
            const { pushEditWithSnapshot, commitSnapshot } = useHistoryStore.getState();
            const { setSelection, setCanvasSize } = useEditorStore.getState();

            switch (action) {
              case 'copy': {
                if (!mask || !selection) break;
                const bounds = mask.getBounds();
                if (!bounds) break;
                const blob = await copySelectionToBlob({
                  x: bounds.x, y: bounds.y, w: bounds.width, h: bounds.height,
                });
                if (!blob) break;
                internalClipboardBlobRef.current = blob;
                try {
                  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                } catch (e) {
                  console.warn('System clipboard not available:', e);
                }
                break;
              }
              case 'paste': {
                let blobToPaste: Blob | null = null;
                try {
                  const items = await navigator.clipboard.read();
                  for (const item of items) {
                    const imageType = item.types.find((t) => t.startsWith('image/'));
                    if (imageType) {
                      blobToPaste = await item.getType(imageType);
                      break;
                    }
                    if (item.types.includes('text/plain')) {
                      const text = await item.getType('text/plain').then((b) => b.text());
                      console.log('텍스트 클립보드 - TextTool 구현 후 연동 예정:', text);
                      break;
                    }
                  }
                } catch (e) {
                  console.warn('System clipboard read failed, trying internal clipboard:', e);
                  blobToPaste = internalClipboardBlobRef.current;
                }
                if (!blobToPaste) break;
                const newLayerStore = useLayerStore.getState();
                newLayerStore.addLayer();
                const newLayers = useLayerStore.getState().layers;
                const newLayer = newLayers[newLayers.length - 1];
                if (!newLayer) break;
                const ok = await pasteImageAsNewLayer(blobToPaste, newLayer.id);
                if (ok) {
                  useLayerStore.getState().setActiveLayer(newLayer.id);
                  requestRender();
                } else {
                  useLayerStore.getState().removeLayer(newLayer.id);
                }
                break;
              }
              case 'clear': {
                if (!maskData || !activeLayerId || !selection) break;
                const before = captureLayerRegion(
                  activeLayerId, selection.x, selection.y, selection.width, selection.height,
                );
                if (!before) break;
                const entryId = pushEditWithSnapshot(
                  'Clear Selection', activeLayerId, before,
                  { x: selection.x, y: selection.y, w: selection.width, h: selection.height },
                );
                clearMaskedPixels(activeLayerId, maskData);
                const after = captureLayerRegion(
                  activeLayerId, selection.x, selection.y, selection.width, selection.height,
                );
                if (after) commitSnapshot(entryId, after);
                requestRender();
                break;
              }
              case 'fill': {
                if (!maskData || !activeLayerId || !selection) break;
                pendingMaskRef.current = new Uint8Array(maskData);
                pendingLayerIdRef.current = activeLayerId;
                pendingSelectionRef.current = { ...selection };
                setFillDialogOpen(true);
                break;
              }
              case 'stroke': {
                if (!maskData || !activeLayerId || !selection) break;
                pendingMaskRef.current = new Uint8Array(maskData);
                pendingLayerIdRef.current = activeLayerId;
                pendingSelectionRef.current = { ...selection };
                setStrokeDialogOpen(true);
                break;
              }
              case 'crop': {
                if (!selection) break;
                const { x, y, width: w, height: h } = selection;
                // Capture full-canvas snapshot using a 1x1 fallback region for history
                const before = captureLayerRegion(activeLayerId, 0, 0, 1, 1);
                if (before) {
                  const entryId = pushEditWithSnapshot(
                    'Crop Canvas', activeLayerId, before,
                    { x: 0, y: 0, w: 1, h: 1 },
                  );
                  cropCanvas(x, y, w, h);
                  setCanvasSize(w, h);
                  setSelection(null);
                  const after = captureLayerRegion(activeLayerId, 0, 0, 1, 1);
                  if (after) commitSnapshot(entryId, after);
                } else {
                  cropCanvas(x, y, w, h);
                  setCanvasSize(w, h);
                  setSelection(null);
                }
                requestRender();
                break;
              }
              case 'freeTransform': {
                console.log('Free Transform: 추후 구현');
                break;
              }
            }
            } catch (e) {
              console.error('Context menu action error:', e);
            }
          }}
        />
      )}
    </div>
  );
};

export default Canvas;