import { describe, it, expect, beforeEach } from 'vitest';
import { BrushTool } from '../BrushTool';
import type { PointerEvent } from '../BaseTool';

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
    const event: PointerEvent = { x: 50, y: 75, button: 0, shiftKey: false, ctrlKey: false, altKey: false };
    tool.onPointerDown(event);

    expect(tool.isDrawing).toBe(true);
    expect(tool.getStrokePoints()).toEqual([{ x: 50, y: 75 }]);
  });

  it('onPointerMove adds points to current stroke', () => {
    tool.onPointerDown({ x: 10, y: 20, button: 0, shiftKey: false, ctrlKey: false, altKey: false });
    tool.onPointerMove({ x: 30, y: 40, button: 0, shiftKey: false, ctrlKey: false, altKey: false });
    tool.onPointerMove({ x: 50, y: 60, button: 0, shiftKey: false, ctrlKey: false, altKey: false });

    expect(tool.getStrokePoints()).toEqual([
      { x: 10, y: 20 },
      { x: 30, y: 40 },
      { x: 50, y: 60 },
    ]);
  });

  it('onPointerMove does not add points if not drawing', () => {
    tool.onPointerMove({ x: 30, y: 40, button: 0, shiftKey: false, ctrlKey: false, altKey: false });
    expect(tool.getStrokePoints()).toEqual([]);
  });

  it('onPointerUp ends stroke', () => {
    tool.onPointerDown({ x: 10, y: 20, button: 0, shiftKey: false, ctrlKey: false, altKey: false });
    tool.onPointerMove({ x: 30, y: 40, button: 0, shiftKey: false, ctrlKey: false, altKey: false });
    tool.onPointerUp({ x: 30, y: 40, button: 0, shiftKey: false, ctrlKey: false, altKey: false });

    expect(tool.isDrawing).toBe(false);
    expect(tool.getStrokePoints()).toEqual([
      { x: 10, y: 20 },
      { x: 30, y: 40 },
    ]);
  });

  it('getStrokePoints returns accumulated points', () => {
    tool.onPointerDown({ x: 0, y: 0, button: 0, shiftKey: false, ctrlKey: false, altKey: false });
    tool.onPointerMove({ x: 5, y: 5, button: 0, shiftKey: false, ctrlKey: false, altKey: false });
    tool.onPointerMove({ x: 10, y: 10, button: 0, shiftKey: false, ctrlKey: false, altKey: false });
    tool.onPointerMove({ x: 15, y: 15, button: 0, shiftKey: false, ctrlKey: false, altKey: false });

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
    tool.onPointerDown({ x: 10, y: 20, button: 0, shiftKey: false, ctrlKey: false, altKey: false });
    tool.onPointerMove({ x: 30, y: 40, button: 0, shiftKey: false, ctrlKey: false, altKey: false });

    tool.reset();
    expect(tool.isDrawing).toBe(false);
    expect(tool.getStrokePoints()).toEqual([]);
  });
});
