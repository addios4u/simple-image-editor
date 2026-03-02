import { describe, it, expect, beforeEach } from 'vitest';
import { TextTool } from '../TextTool';
import type { PointerEvent } from '../BaseTool';

describe('TextTool', () => {
  let tool: TextTool;

  beforeEach(() => {
    tool = new TextTool();
  });

  it('name is "text"', () => {
    expect(tool.name).toBe('text');
  });

  it('cursor is "text"', () => {
    expect(tool.getCursor()).toBe('text');
  });

  it('onPointerDown sets text insertion point', () => {
    const event: PointerEvent = { x: 100, y: 200, button: 0, shiftKey: false, ctrlKey: false, altKey: false };
    tool.onPointerDown(event);

    expect(tool.getInsertionPoint()).toEqual({ x: 100, y: 200 });
  });

  it('getInsertionPoint returns the clicked position', () => {
    tool.onPointerDown({ x: 55, y: 77, button: 0, shiftKey: false, ctrlKey: false, altKey: false });
    const point = tool.getInsertionPoint();
    expect(point).toEqual({ x: 55, y: 77 });
  });

  it('getInsertionPoint returns null before any click', () => {
    expect(tool.getInsertionPoint()).toBeNull();
  });

  it('isEditing state tracks whether text input is active', () => {
    expect(tool.isEditing).toBe(false);

    tool.onPointerDown({ x: 50, y: 50, button: 0, shiftKey: false, ctrlKey: false, altKey: false });
    expect(tool.isEditing).toBe(true);
  });

  it('second click updates insertion point', () => {
    tool.onPointerDown({ x: 10, y: 20, button: 0, shiftKey: false, ctrlKey: false, altKey: false });
    tool.onPointerDown({ x: 30, y: 40, button: 0, shiftKey: false, ctrlKey: false, altKey: false });

    expect(tool.getInsertionPoint()).toEqual({ x: 30, y: 40 });
  });

  it('reset clears insertion point and editing state', () => {
    tool.onPointerDown({ x: 50, y: 50, button: 0, shiftKey: false, ctrlKey: false, altKey: false });
    expect(tool.isEditing).toBe(true);

    tool.reset();
    expect(tool.isEditing).toBe(false);
    expect(tool.getInsertionPoint()).toBeNull();
  });
});
