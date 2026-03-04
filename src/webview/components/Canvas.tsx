import React, { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import { useEditorStore, type ToolType } from '../state/editorStore';
import Minimap from './Minimap';
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
} from '../engine/engineContext';
import { RenderLoop } from '../engine/renderLoop';
import { hexToPackedRGBA } from '../engine/helpers';
import { useLayerStore } from '../state/layerStore';
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

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const toolRef = useRef<{ type: ToolType; instance: BaseTool } | null>(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const antsOffsetRef = useRef(0);
  const antsRafRef = useRef<number>(0);

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
    </div>
  );
};

export default Canvas;