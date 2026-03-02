import React, { useRef, useMemo, useCallback } from 'react';
import { useEditorStore, type ToolType } from '../state/editorStore';
import ZoomControls from './ZoomControls';
import Minimap from './Minimap';
import { BaseTool, type PointerEvent as ToolPointerEvent } from '../tools/BaseTool';
import { SelectionTool } from '../tools/SelectionTool';
import { MarqueeTool } from '../tools/MarqueeTool';
import { BrushTool } from '../tools/BrushTool';
import { TextTool } from '../tools/TextTool';

function createTool(type: ToolType): BaseTool {
  switch (type) {
    case 'marquee':
      return new MarqueeTool();
    case 'brush':
      return new BrushTool();
    case 'text':
      return new TextTool();
    case 'select':
    default:
      return new SelectionTool();
  }
}

function toToolEvent(e: React.PointerEvent<HTMLCanvasElement>): ToolPointerEvent {
  const rect = e.currentTarget.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
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
  const panX = useEditorStore((s) => s.panX);
  const panY = useEditorStore((s) => s.panY);
  const setPan = useEditorStore((s) => s.setPan);
  const activeTool = useEditorStore((s) => s.activeTool);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const toolRef = useRef<{ type: ToolType; instance: BaseTool } | null>(null);

  const tool = useMemo(() => {
    if (!toolRef.current || toolRef.current.type !== activeTool) {
      const instance = createTool(activeTool);
      toolRef.current = { type: activeTool, instance };
    }
    return toolRef.current.instance;
  }, [activeTool]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      tool.onPointerDown(toToolEvent(e));
    },
    [tool],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      tool.onPointerMove(toToolEvent(e));
    },
    [tool],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      tool.onPointerUp(toToolEvent(e));
    },
    [tool],
  );

  return (
    <div className="canvas-container" ref={containerRef}>
      <div
        className="canvas-wrapper"
        style={{
          transform: `scale(${zoom}) translate(${panX}px, ${panY}px)`,
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
      </div>
      <Minimap
        mode="transform"
        sourceCanvas={canvasRef.current}
        containerEl={containerRef.current}
        zoom={zoom}
        panX={panX}
        panY={panY}
        setPan={setPan}
      />
    </div>
  );
};

export default Canvas;
