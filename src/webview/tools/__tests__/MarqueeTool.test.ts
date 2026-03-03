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
  // Config-based selection callback
  // ---------------------------------------------------------------

  describe('with config', () => {
    const mockSetSelection = vi.fn();
    let configTool: MarqueeTool;
    const config: MarqueeToolConfig = {
      setSelection: mockSetSelection,
      getSelection: () => null,
      getSelectionShape: () => 'rectangle',
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

  // ---------------------------------------------------------------
  // Add mode (Shift+drag)
  // ---------------------------------------------------------------

  describe('add mode (Shift)', () => {
    it('Shift+drag unions with existing selection (bounding box)', () => {
      const mockSetSelection = vi.fn();
      const existing = { x: 10, y: 10, width: 50, height: 50 };
      const config: MarqueeToolConfig = {
        setSelection: mockSetSelection,
        getSelection: () => existing,
        getSelectionShape: () => 'rectangle',
      };
      const addTool = new MarqueeTool(config);

      addTool.onPointerDown({ x: 80, y: 80, button: 0, shiftKey: true, ctrlKey: false, altKey: false });
      addTool.onPointerMove({ x: 120, y: 120, button: 0, shiftKey: true, ctrlKey: false, altKey: false });
      addTool.onPointerUp({ x: 120, y: 120, button: 0, shiftKey: true, ctrlKey: false, altKey: false });

      // Union bounding box: min(10,80)=10, min(10,80)=10, max(60,120)=120, max(60,120)=120
      expect(mockSetSelection).toHaveBeenLastCalledWith({ x: 10, y: 10, width: 110, height: 110 });
    });

    it('Shift+drag with no existing selection acts as replace', () => {
      const mockSetSelection = vi.fn();
      const config: MarqueeToolConfig = {
        setSelection: mockSetSelection,
        getSelection: () => null,
        getSelectionShape: () => 'rectangle',
      };
      const addTool = new MarqueeTool(config);

      addTool.onPointerDown({ x: 10, y: 10, button: 0, shiftKey: true, ctrlKey: false, altKey: false });
      addTool.onPointerUp({ x: 60, y: 60, button: 0, shiftKey: true, ctrlKey: false, altKey: false });

      expect(mockSetSelection).toHaveBeenLastCalledWith({ x: 10, y: 10, width: 50, height: 50 });
    });
  });

  // ---------------------------------------------------------------
  // Subtract mode (Alt+drag)
  // ---------------------------------------------------------------

  describe('subtract mode (Alt)', () => {
    it('Alt+drag removes overlap from existing selection', () => {
      const mockSetSelection = vi.fn();
      // Existing selection: 0,0 → 100,100
      const existing = { x: 0, y: 0, width: 100, height: 100 };
      const config: MarqueeToolConfig = {
        setSelection: mockSetSelection,
        getSelection: () => existing,
        getSelectionShape: () => 'rectangle',
      };
      const subTool = new MarqueeTool(config);

      // Subtract right half: 50,0 → 100,100
      subTool.onPointerDown({ x: 50, y: 0, button: 0, shiftKey: false, ctrlKey: false, altKey: true });
      subTool.onPointerUp({ x: 100, y: 100, button: 0, shiftKey: false, ctrlKey: false, altKey: true });

      // Remaining: left strip 0,0 → 50,100
      expect(mockSetSelection).toHaveBeenLastCalledWith({ x: 0, y: 0, width: 50, height: 100 });
    });

    it('Alt+drag fully covering selection clears it', () => {
      const mockSetSelection = vi.fn();
      const existing = { x: 10, y: 10, width: 50, height: 50 };
      const config: MarqueeToolConfig = {
        setSelection: mockSetSelection,
        getSelection: () => existing,
        getSelectionShape: () => 'rectangle',
      };
      const subTool = new MarqueeTool(config);

      // Subtract area fully covers existing
      subTool.onPointerDown({ x: 0, y: 0, button: 0, shiftKey: false, ctrlKey: false, altKey: true });
      subTool.onPointerUp({ x: 200, y: 200, button: 0, shiftKey: false, ctrlKey: false, altKey: true });

      expect(mockSetSelection).toHaveBeenLastCalledWith(null);
    });

    it('Alt+drag with no overlap keeps existing selection', () => {
      const mockSetSelection = vi.fn();
      const existing = { x: 0, y: 0, width: 50, height: 50 };
      const config: MarqueeToolConfig = {
        setSelection: mockSetSelection,
        getSelection: () => existing,
        getSelectionShape: () => 'rectangle',
      };
      const subTool = new MarqueeTool(config);

      // Subtract area doesn't overlap
      subTool.onPointerDown({ x: 100, y: 100, button: 0, shiftKey: false, ctrlKey: false, altKey: true });
      subTool.onPointerUp({ x: 150, y: 150, button: 0, shiftKey: false, ctrlKey: false, altKey: true });

      expect(mockSetSelection).toHaveBeenLastCalledWith({ x: 0, y: 0, width: 50, height: 50 });
    });

    it('Alt+drag with no existing selection results in null', () => {
      const mockSetSelection = vi.fn();
      const config: MarqueeToolConfig = {
        setSelection: mockSetSelection,
        getSelection: () => null,
        getSelectionShape: () => 'rectangle',
      };
      const subTool = new MarqueeTool(config);

      subTool.onPointerDown({ x: 10, y: 10, button: 0, shiftKey: false, ctrlKey: false, altKey: true });
      subTool.onPointerUp({ x: 60, y: 60, button: 0, shiftKey: false, ctrlKey: false, altKey: true });

      expect(mockSetSelection).toHaveBeenLastCalledWith(null);
    });
  });
});
