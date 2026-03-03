import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MarqueeTool, type MarqueeToolConfig } from '../MarqueeTool';
import type { PointerEvent } from '../BaseTool';

describe('MarqueeTool', () => {
  let tool: MarqueeTool;

  beforeEach(() => {
    tool = new MarqueeTool();
  });

  it('name is "marquee"', () => {
    expect(tool.name).toBe('marquee');
  });

  it('cursor is "crosshair"', () => {
    expect(tool.getCursor()).toBe('crosshair');
  });

  it('onPointerDown starts selection rect', () => {
    const event: PointerEvent = { x: 50, y: 75, button: 0, shiftKey: false, ctrlKey: false, altKey: false };
    tool.onPointerDown(event);

    expect(tool.isSelecting).toBe(true);
    expect(tool.getSelectionRect()).toEqual({ x: 50, y: 75, width: 0, height: 0 });
  });

  it('onPointerMove updates selection rect dimensions', () => {
    tool.onPointerDown({ x: 10, y: 20, button: 0, shiftKey: false, ctrlKey: false, altKey: false });
    tool.onPointerMove({ x: 110, y: 70, button: 0, shiftKey: false, ctrlKey: false, altKey: false });

    expect(tool.getSelectionRect()).toEqual({ x: 10, y: 20, width: 100, height: 50 });
  });

  it('onPointerUp finalizes selection', () => {
    tool.onPointerDown({ x: 10, y: 20, button: 0, shiftKey: false, ctrlKey: false, altKey: false });
    tool.onPointerMove({ x: 110, y: 70, button: 0, shiftKey: false, ctrlKey: false, altKey: false });
    tool.onPointerUp({ x: 110, y: 70, button: 0, shiftKey: false, ctrlKey: false, altKey: false });

    expect(tool.isSelecting).toBe(false);
    expect(tool.getSelectionRect()).toEqual({ x: 10, y: 20, width: 100, height: 50 });
  });

  it('shift+drag constrains to square (width === height)', () => {
    tool.onPointerDown({ x: 10, y: 10, button: 0, shiftKey: false, ctrlKey: false, altKey: false });
    tool.onPointerMove({ x: 110, y: 60, button: 0, shiftKey: true, ctrlKey: false, altKey: false });

    const rect = tool.getSelectionRect();
    expect(rect).not.toBeNull();
    expect(rect!.width).toBe(rect!.height);
  });

  it('shift+drag uses minimum of width/height for square constraint', () => {
    tool.onPointerDown({ x: 0, y: 0, button: 0, shiftKey: false, ctrlKey: false, altKey: false });
    tool.onPointerMove({ x: 200, y: 80, button: 0, shiftKey: true, ctrlKey: false, altKey: false });

    const rect = tool.getSelectionRect();
    expect(rect!.width).toBe(80);
    expect(rect!.height).toBe(80);
  });

  it('getSelectionRect returns null before any interaction', () => {
    expect(tool.getSelectionRect()).toBeNull();
  });

  it('handles negative drag direction (dragging up-left)', () => {
    tool.onPointerDown({ x: 100, y: 100, button: 0, shiftKey: false, ctrlKey: false, altKey: false });
    tool.onPointerMove({ x: 50, y: 30, button: 0, shiftKey: false, ctrlKey: false, altKey: false });

    const rect = tool.getSelectionRect();
    expect(rect).toEqual({ x: 50, y: 30, width: 50, height: 70 });
  });

  it('reset clears selection state', () => {
    tool.onPointerDown({ x: 10, y: 20, button: 0, shiftKey: false, ctrlKey: false, altKey: false });
    tool.onPointerMove({ x: 110, y: 70, button: 0, shiftKey: false, ctrlKey: false, altKey: false });

    tool.reset();
    expect(tool.isSelecting).toBe(false);
    expect(tool.getSelectionRect()).toBeNull();
  });

  // ---------------------------------------------------------------
  // Config-based selection callback (Phase E-1)
  // ---------------------------------------------------------------

  describe('with config', () => {
    const mockSetSelection = vi.fn();
    let configTool: MarqueeTool;
    const config: MarqueeToolConfig = {
      setSelection: mockSetSelection,
    };

    beforeEach(() => {
      vi.clearAllMocks();
      configTool = new MarqueeTool(config);
    });

    it('calls setSelection on pointer up with final rect', () => {
      configTool.onPointerDown({ x: 10, y: 20, button: 0, shiftKey: false, ctrlKey: false, altKey: false });
      configTool.onPointerMove({ x: 110, y: 70, button: 0, shiftKey: false, ctrlKey: false, altKey: false });
      configTool.onPointerUp({ x: 110, y: 70, button: 0, shiftKey: false, ctrlKey: false, altKey: false });

      expect(mockSetSelection).toHaveBeenCalledWith({ x: 10, y: 20, width: 100, height: 50 });
    });

    it('calls setSelection with null on reset', () => {
      configTool.onPointerDown({ x: 10, y: 20, button: 0, shiftKey: false, ctrlKey: false, altKey: false });
      configTool.onPointerMove({ x: 50, y: 50, button: 0, shiftKey: false, ctrlKey: false, altKey: false });

      configTool.reset();
      expect(mockSetSelection).toHaveBeenCalledWith(null);
    });

    it('calls setSelection during drag (live preview)', () => {
      configTool.onPointerDown({ x: 0, y: 0, button: 0, shiftKey: false, ctrlKey: false, altKey: false });
      configTool.onPointerMove({ x: 50, y: 50, button: 0, shiftKey: false, ctrlKey: false, altKey: false });

      expect(mockSetSelection).toHaveBeenCalledWith({ x: 0, y: 0, width: 50, height: 50 });
    });
  });
});
