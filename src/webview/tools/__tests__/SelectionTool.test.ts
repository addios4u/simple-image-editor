import { describe, it, expect, beforeEach } from 'vitest';
import { SelectionTool } from '../SelectionTool';
import type { PointerEvent } from '../BaseTool';

describe('SelectionTool', () => {
  let tool: SelectionTool;

  beforeEach(() => {
    tool = new SelectionTool();
  });

  it('name is "select"', () => {
    expect(tool.name).toBe('select');
  });

  it('cursor is "default"', () => {
    expect(tool.getCursor()).toBe('default');
  });

  it('onPointerDown records start position', () => {
    const event: PointerEvent = { x: 50, y: 75, button: 0, shiftKey: false, ctrlKey: false, altKey: false };
    tool.onPointerDown(event);
    expect(tool.getDragStart()).toEqual({ x: 50, y: 75 });
  });

  it('onPointerMove with button pressed calculates drag delta', () => {
    const down: PointerEvent = { x: 100, y: 100, button: 0, shiftKey: false, ctrlKey: false, altKey: false };
    tool.onPointerDown(down);

    const move: PointerEvent = { x: 150, y: 120, button: 0, shiftKey: false, ctrlKey: false, altKey: false };
    tool.onPointerMove(move);

    expect(tool.getDragDelta()).toEqual({ dx: 50, dy: 20 });
  });

  it('onPointerUp completes drag operation', () => {
    const down: PointerEvent = { x: 100, y: 100, button: 0, shiftKey: false, ctrlKey: false, altKey: false };
    tool.onPointerDown(down);

    const move: PointerEvent = { x: 200, y: 250, button: 0, shiftKey: false, ctrlKey: false, altKey: false };
    tool.onPointerMove(move);

    const up: PointerEvent = { x: 200, y: 250, button: 0, shiftKey: false, ctrlKey: false, altKey: false };
    tool.onPointerUp(up);

    expect(tool.isDragging).toBe(false);
    expect(tool.getDragDelta()).toEqual({ dx: 100, dy: 150 });
  });

  it('can select/track a region', () => {
    const down: PointerEvent = { x: 10, y: 20, button: 0, shiftKey: false, ctrlKey: false, altKey: false };
    tool.onPointerDown(down);
    expect(tool.isDragging).toBe(true);

    const move: PointerEvent = { x: 110, y: 120, button: 0, shiftKey: false, ctrlKey: false, altKey: false };
    tool.onPointerMove(move);

    expect(tool.getDragStart()).toEqual({ x: 10, y: 20 });
    expect(tool.getDragDelta()).toEqual({ dx: 100, dy: 100 });
  });

  it('reset clears drag state', () => {
    const down: PointerEvent = { x: 50, y: 50, button: 0, shiftKey: false, ctrlKey: false, altKey: false };
    tool.onPointerDown(down);
    tool.onPointerMove({ x: 100, y: 100, button: 0, shiftKey: false, ctrlKey: false, altKey: false });

    tool.reset();
    expect(tool.isDragging).toBe(false);
    expect(tool.getDragDelta()).toEqual({ dx: 0, dy: 0 });
  });
});
