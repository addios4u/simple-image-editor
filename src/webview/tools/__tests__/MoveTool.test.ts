import { describe, it, expect, beforeEach } from 'vitest';
import { MoveTool } from '../MoveTool';

describe('MoveTool', () => {
  let tool: MoveTool;

  beforeEach(() => {
    tool = new MoveTool();
  });

  it('name is "move"', () => {
    expect(tool.name).toBe('move');
  });

  it('cursor is "move"', () => {
    expect(tool.getCursor()).toBe('move');
  });

  it('tracks drag delta', () => {
    tool.onPointerDown({ x: 10, y: 20, button: 0, shiftKey: false, ctrlKey: false, altKey: false });
    tool.onPointerMove({ x: 30, y: 50, button: 0, shiftKey: false, ctrlKey: false, altKey: false });

    const delta = tool.getDragDelta();
    expect(delta.dx).toBe(20);
    expect(delta.dy).toBe(30);
  });

  it('returns zero delta when not dragging', () => {
    const delta = tool.getDragDelta();
    expect(delta.dx).toBe(0);
    expect(delta.dy).toBe(0);
  });

  it('stops dragging on pointer up', () => {
    tool.onPointerDown({ x: 10, y: 20, button: 0, shiftKey: false, ctrlKey: false, altKey: false });
    expect(tool.isDragging).toBe(true);

    tool.onPointerUp({ x: 30, y: 50, button: 0, shiftKey: false, ctrlKey: false, altKey: false });
    expect(tool.isDragging).toBe(false);
  });

  it('reset clears state', () => {
    tool.onPointerDown({ x: 10, y: 20, button: 0, shiftKey: false, ctrlKey: false, altKey: false });
    tool.reset();

    expect(tool.isDragging).toBe(false);
    expect(tool.getDragDelta()).toEqual({ dx: 0, dy: 0 });
  });
});
