import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BrushTool, type BrushToolConfig } from '../BrushTool';
import type { PointerEvent } from '../BaseTool';

function makeEvent(x: number, y: number): PointerEvent {
  return { x, y, button: 0, shiftKey: false, ctrlKey: false, altKey: false };
}

describe('BrushTool', () => {
  let tool: BrushTool;

  beforeEach(() => {
    tool = new BrushTool();
  });

  it('name is "brush"', () => {
    expect(tool.name).toBe('brush');
  });

  it('cursor is "crosshair"', () => {
    expect(tool.getCursor()).toBe('crosshair');
  });

  it('onPointerDown starts stroke (records point)', () => {
    tool.onPointerDown(makeEvent(50, 75));
    expect(tool.isDrawing).toBe(true);
    expect(tool.getStrokePoints()).toEqual([{ x: 50, y: 75 }]);
  });

  it('onPointerMove adds points to current stroke', () => {
    tool.onPointerDown(makeEvent(10, 20));
    tool.onPointerMove(makeEvent(30, 40));
    tool.onPointerMove(makeEvent(50, 60));

    expect(tool.getStrokePoints()).toEqual([
      { x: 10, y: 20 },
      { x: 30, y: 40 },
      { x: 50, y: 60 },
    ]);
  });

  it('onPointerMove does not add points if not drawing', () => {
    tool.onPointerMove(makeEvent(30, 40));
    expect(tool.getStrokePoints()).toEqual([]);
  });

  it('onPointerUp ends stroke', () => {
    tool.onPointerDown(makeEvent(10, 20));
    tool.onPointerMove(makeEvent(30, 40));
    tool.onPointerUp(makeEvent(30, 40));

    expect(tool.isDrawing).toBe(false);
    expect(tool.getStrokePoints()).toEqual([
      { x: 10, y: 20 },
      { x: 30, y: 40 },
    ]);
  });

  it('getStrokePoints returns accumulated points', () => {
    tool.onPointerDown(makeEvent(0, 0));
    tool.onPointerMove(makeEvent(5, 5));
    tool.onPointerMove(makeEvent(10, 10));
    tool.onPointerMove(makeEvent(15, 15));

    const points = tool.getStrokePoints();
    expect(points).toHaveLength(4);
    expect(points[0]).toEqual({ x: 0, y: 0 });
    expect(points[3]).toEqual({ x: 15, y: 15 });
  });

  it('brush size can be configured', () => {
    expect(tool.size).toBe(5); // default
    tool.size = 20;
    expect(tool.size).toBe(20);
  });

  it('brush hardness can be configured', () => {
    expect(tool.hardness).toBe(1.0); // default
    tool.hardness = 0.5;
    expect(tool.hardness).toBe(0.5);
  });

  it('reset clears stroke state', () => {
    tool.onPointerDown(makeEvent(10, 20));
    tool.onPointerMove(makeEvent(30, 40));

    tool.reset();
    expect(tool.isDrawing).toBe(false);
    expect(tool.getStrokePoints()).toEqual([]);
  });

  describe('with WASM config', () => {
    let config: BrushToolConfig;

    beforeEach(() => {
      config = {
        getColor: vi.fn(() => 0xFF0000FF),
        getSize: vi.fn(() => 8),
        getHardness: vi.fn(() => 0.7),
        getActiveLayerId: vi.fn(() => 'layer-1'),
        isLayerLocked: vi.fn(() => false),
        brushStrokeLayer: vi.fn(),
        requestRender: vi.fn(),
      };
      tool = new BrushTool(config);
    });

    it('calls brushStrokeLayer on pointerDown', () => {
      tool.onPointerDown(makeEvent(50, 75));
      expect(config.brushStrokeLayer).toHaveBeenCalledWith(
        'layer-1', 50, 75, 0xFF0000FF, 8, 0.7,
      );
    });

    it('calls requestRender on pointerDown', () => {
      tool.onPointerDown(makeEvent(50, 75));
      expect(config.requestRender).toHaveBeenCalledTimes(1);
    });

    it('calls brushStrokeLayer on each pointerMove while drawing', () => {
      tool.onPointerDown(makeEvent(10, 20));
      tool.onPointerMove(makeEvent(30, 40));
      tool.onPointerMove(makeEvent(50, 60));

      // 1 from pointerDown + 2 from pointerMove
      expect(config.brushStrokeLayer).toHaveBeenCalledTimes(3);
      expect(config.requestRender).toHaveBeenCalledTimes(3);
    });

    it('does not call brushStrokeLayer on pointerMove when not drawing', () => {
      tool.onPointerMove(makeEvent(30, 40));
      expect(config.brushStrokeLayer).not.toHaveBeenCalled();
      expect(config.requestRender).not.toHaveBeenCalled();
    });

    it('reads current config values for each stroke', () => {
      // First stroke: size 8
      tool.onPointerDown(makeEvent(10, 20));
      expect(config.getSize).toHaveBeenCalled();

      // Config changes between strokes
      (config.getSize as ReturnType<typeof vi.fn>).mockReturnValue(20);
      (config.getColor as ReturnType<typeof vi.fn>).mockReturnValue(0x00FF00FF);

      tool.onPointerUp(makeEvent(10, 20));
      tool.onPointerDown(makeEvent(50, 60));

      expect(config.brushStrokeLayer).toHaveBeenLastCalledWith(
        'layer-1', 50, 60, 0x00FF00FF, 20, 0.7,
      );
    });

    it('does not call brushStrokeLayer when layer is locked', () => {
      (config.isLayerLocked as ReturnType<typeof vi.fn>).mockReturnValue(true);
      tool.onPointerDown(makeEvent(10, 20));
      tool.onPointerMove(makeEvent(30, 40));

      expect(config.brushStrokeLayer).not.toHaveBeenCalled();
      expect(config.requestRender).not.toHaveBeenCalled();
    });

    it('still records stroke points when config is set', () => {
      tool.onPointerDown(makeEvent(10, 20));
      tool.onPointerMove(makeEvent(30, 40));

      expect(tool.getStrokePoints()).toEqual([
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ]);
    });
  });
});
