import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MarqueeTool, type MarqueeToolConfig } from '../MarqueeTool';
import type { PointerEvent } from '../BaseTool';
import { SelectionMask } from '../../engine/selectionMask';

const MASK_W = 200;
const MASK_H = 200;

/** Create a config wired to a real SelectionMask. */
function makeConfig(mask: SelectionMask, shape: 'rectangle' | 'ellipse' = 'rectangle') {
  const mockSetSelection = vi.fn();
  const mockOnContourChange = vi.fn();
  const config: MarqueeToolConfig = {
    setSelection: mockSetSelection,
    getSelectionShape: () => shape,
    getCanvasSize: () => ({ width: MASK_W, height: MASK_H }),
    getMask: () => mask,
    onContourChange: mockOnContourChange,
  };
  return { config, mockSetSelection, mockOnContourChange };
}

function ev(x: number, y: number, opts: Partial<PointerEvent> = {}): PointerEvent {
  return { x, y, button: 0, shiftKey: false, ctrlKey: false, altKey: false, ...opts };
}

describe('MarqueeTool', () => {
  let tool: MarqueeTool;

  beforeEach(() => {
    tool = new MarqueeTool();
  });

  // -----------------------------------------------------------
  // Basic (no config) — backwards compat
  // -----------------------------------------------------------

  it('name is "marquee"', () => {
    expect(tool.name).toBe('marquee');
  });

  it('cursor is "crosshair"', () => {
    expect(tool.getCursor()).toBe('crosshair');
  });

  it('onPointerDown starts selection rect', () => {
    tool.onPointerDown(ev(50, 75));
    expect(tool.isSelecting).toBe(true);
    expect(tool.getSelectionRect()).toEqual({ x: 50, y: 75, width: 0, height: 0 });
  });

  it('onPointerMove updates selection rect dimensions', () => {
    tool.onPointerDown(ev(10, 20));
    tool.onPointerMove(ev(110, 70));
    expect(tool.getSelectionRect()).toEqual({ x: 10, y: 20, width: 100, height: 50 });
  });

  it('onPointerUp finalizes selection', () => {
    tool.onPointerDown(ev(10, 20));
    tool.onPointerMove(ev(110, 70));
    tool.onPointerUp(ev(110, 70));
    expect(tool.isSelecting).toBe(false);
  });

  it('getSelectionRect returns null before any interaction', () => {
    expect(tool.getSelectionRect()).toBeNull();
  });

  it('handles negative drag direction (dragging up-left)', () => {
    tool.onPointerDown(ev(100, 100));
    tool.onPointerMove(ev(50, 30));
    expect(tool.getSelectionRect()).toEqual({ x: 50, y: 30, width: 50, height: 70 });
  });

  it('reset clears selection state', () => {
    tool.onPointerDown(ev(10, 20));
    tool.onPointerMove(ev(110, 70));
    tool.reset();
    expect(tool.isSelecting).toBe(false);
    expect(tool.getSelectionRect()).toBeNull();
  });

  // -----------------------------------------------------------
  // With config + mask — replace mode
  // -----------------------------------------------------------

  describe('with config (replace mode)', () => {
    it('calls setSelection with bounds on pointer up', () => {
      const mask = new SelectionMask(MASK_W, MASK_H);
      const { config, mockSetSelection } = makeConfig(mask);
      const t = new MarqueeTool(config);

      t.onPointerDown(ev(10, 20));
      t.onPointerMove(ev(110, 70));
      t.onPointerUp(ev(110, 70));

      expect(mockSetSelection).toHaveBeenCalledWith({ x: 10, y: 20, width: 100, height: 50 });
    });

    it('calls setSelection with null on reset', () => {
      const mask = new SelectionMask(MASK_W, MASK_H);
      const { config, mockSetSelection } = makeConfig(mask);
      const t = new MarqueeTool(config);

      t.onPointerDown(ev(10, 20));
      t.onPointerMove(ev(50, 50));
      t.reset();

      expect(mockSetSelection).toHaveBeenCalledWith(null);
    });

    it('provides live preview (calls setSelection during drag)', () => {
      const mask = new SelectionMask(MASK_W, MASK_H);
      const { config, mockSetSelection } = makeConfig(mask);
      const t = new MarqueeTool(config);

      t.onPointerDown(ev(0, 0));
      t.onPointerMove(ev(50, 50));

      expect(mockSetSelection).toHaveBeenCalledWith({ x: 0, y: 0, width: 50, height: 50 });
    });

    it('replace mode clears previous mask content', () => {
      const mask = new SelectionMask(MASK_W, MASK_H);
      mask.addRect(150, 150, 30, 30); // pre-existing selection
      const { config, mockSetSelection } = makeConfig(mask);
      const t = new MarqueeTool(config);

      // Replace: should clear the old 150,150 rect
      t.onPointerDown(ev(10, 10));
      t.onPointerUp(ev(40, 40));

      // Only the new rect should remain in the mask
      expect(mask.getMaskData()[150 * MASK_W + 150]).toBe(0);
      expect(mask.getMaskData()[20 * MASK_W + 20]).toBe(255);
    });
  });

  // -----------------------------------------------------------
  // Add mode (Shift+drag) — true union, not bounding box
  // -----------------------------------------------------------

  describe('add mode (Shift)', () => {
    it('Shift+drag adds new region without filling gap between', () => {
      const mask = new SelectionMask(MASK_W, MASK_H);
      mask.addRect(10, 10, 20, 20); // Existing: (10,10)→(30,30)
      const { config } = makeConfig(mask);
      const t = new MarqueeTool(config);

      // Add a disjoint rect at (80,80)→(100,100)
      t.onPointerDown(ev(80, 80, { shiftKey: true }));
      t.onPointerUp(ev(100, 100, { shiftKey: true }));

      const data = mask.getMaskData();
      // Both regions selected
      expect(data[15 * MASK_W + 15]).toBe(255);
      expect(data[90 * MASK_W + 90]).toBe(255);
      // Gap NOT selected (this is the key difference from the old bounding-box union)
      expect(data[50 * MASK_W + 50]).toBe(0);
    });

    it('Shift+drag with no existing selection acts as replace', () => {
      const mask = new SelectionMask(MASK_W, MASK_H);
      const { config, mockSetSelection } = makeConfig(mask);
      const t = new MarqueeTool(config);

      t.onPointerDown(ev(10, 10, { shiftKey: true }));
      t.onPointerUp(ev(60, 60, { shiftKey: true }));

      expect(mockSetSelection).toHaveBeenLastCalledWith({ x: 10, y: 10, width: 50, height: 50 });
    });

    it('Shift+drag add mode returns correct bounding rect', () => {
      const mask = new SelectionMask(MASK_W, MASK_H);
      mask.addRect(5, 5, 10, 10);
      const { config, mockSetSelection } = makeConfig(mask);
      const t = new MarqueeTool(config);

      t.onPointerDown(ev(80, 80, { shiftKey: true }));
      t.onPointerUp(ev(90, 90, { shiftKey: true }));

      // Bounding rect encompasses both regions
      expect(mockSetSelection).toHaveBeenLastCalledWith({ x: 5, y: 5, width: 85, height: 85 });
    });
  });

  // -----------------------------------------------------------
  // Subtract mode (Alt+drag) — preserves all remaining parts
  // -----------------------------------------------------------

  describe('subtract mode (Alt)', () => {
    it('Alt+drag removes only the dragged area, keeping everything else', () => {
      const mask = new SelectionMask(MASK_W, MASK_H);
      mask.addRect(0, 0, 100, 100);
      const { config } = makeConfig(mask);
      const t = new MarqueeTool(config);

      // Subtract a horizontal strip from the middle
      t.onPointerDown(ev(0, 40, { altKey: true }));
      t.onPointerUp(ev(100, 60, { altKey: true }));

      const data = mask.getMaskData();
      // Top part still selected
      expect(data[10 * MASK_W + 50]).toBe(255);
      // Bottom part still selected
      expect(data[70 * MASK_W + 50]).toBe(255);
      // Middle strip removed
      expect(data[50 * MASK_W + 50]).toBe(0);
    });

    it('Alt+drag creates L-shaped selection', () => {
      const mask = new SelectionMask(MASK_W, MASK_H);
      mask.addRect(0, 0, 60, 60);
      const { config } = makeConfig(mask);
      const t = new MarqueeTool(config);

      // Subtract top-right quadrant
      t.onPointerDown(ev(30, 0, { altKey: true }));
      t.onPointerUp(ev(60, 30, { altKey: true }));

      const data = mask.getMaskData();
      // Top-left: selected
      expect(data[10 * MASK_W + 10]).toBe(255);
      // Top-right: NOT selected
      expect(data[10 * MASK_W + 40]).toBe(0);
      // Bottom-left: selected
      expect(data[40 * MASK_W + 10]).toBe(255);
      // Bottom-right: selected (was not subtracted)
      expect(data[40 * MASK_W + 40]).toBe(255);
    });

    it('Alt+drag fully covering selection clears it', () => {
      const mask = new SelectionMask(MASK_W, MASK_H);
      mask.addRect(10, 10, 50, 50);
      const { config, mockSetSelection } = makeConfig(mask);
      const t = new MarqueeTool(config);

      t.onPointerDown(ev(0, 0, { altKey: true }));
      t.onPointerUp(ev(200, 200, { altKey: true }));

      expect(mockSetSelection).toHaveBeenLastCalledWith(null);
      expect(mask.isEmpty()).toBe(true);
    });

    it('Alt+drag with no overlap keeps existing selection', () => {
      const mask = new SelectionMask(MASK_W, MASK_H);
      mask.addRect(0, 0, 50, 50);
      const { config, mockSetSelection } = makeConfig(mask);
      const t = new MarqueeTool(config);

      t.onPointerDown(ev(100, 100, { altKey: true }));
      t.onPointerUp(ev(150, 150, { altKey: true }));

      expect(mockSetSelection).toHaveBeenLastCalledWith({ x: 0, y: 0, width: 50, height: 50 });
    });

    it('Alt+drag with no existing selection results in null', () => {
      const mask = new SelectionMask(MASK_W, MASK_H);
      const { config, mockSetSelection } = makeConfig(mask);
      const t = new MarqueeTool(config);

      t.onPointerDown(ev(10, 10, { altKey: true }));
      t.onPointerUp(ev(60, 60, { altKey: true }));

      expect(mockSetSelection).toHaveBeenLastCalledWith(null);
    });
  });

  // -----------------------------------------------------------
  // Intersect mode (Shift+Alt)
  // -----------------------------------------------------------

  describe('intersect mode (Shift+Alt)', () => {
    it('Shift+Alt keeps only pixels inside both existing selection and new drag', () => {
      const mask = new SelectionMask(MASK_W, MASK_H);
      mask.addRect(0, 0, 60, 60);
      const { config, mockSetSelection } = makeConfig(mask);
      const t = new MarqueeTool(config);

      // Intersect with (30,30)→(90,90)
      t.onPointerDown(ev(30, 30, { shiftKey: true, altKey: true }));
      t.onPointerUp(ev(90, 90, { shiftKey: true, altKey: true }));

      const data = mask.getMaskData();
      // Intersection: (30,30)→(60,60) — should be selected
      expect(data[40 * MASK_W + 40]).toBe(255);
      // Was in original but outside intersect rect
      expect(data[10 * MASK_W + 10]).toBe(0);
      // Outside both
      expect(data[80 * MASK_W + 80]).toBe(0);

      // Bounds should be the intersection region
      expect(mockSetSelection).toHaveBeenLastCalledWith({ x: 30, y: 30, width: 30, height: 30 });
    });

    it('Shift+Alt with no existing selection results in empty', () => {
      const mask = new SelectionMask(MASK_W, MASK_H);
      const { config, mockSetSelection } = makeConfig(mask);
      const t = new MarqueeTool(config);

      t.onPointerDown(ev(10, 10, { shiftKey: true, altKey: true }));
      t.onPointerUp(ev(60, 60, { shiftKey: true, altKey: true }));

      expect(mockSetSelection).toHaveBeenLastCalledWith(null);
    });
  });

  // -----------------------------------------------------------
  // Ellipse shape
  // -----------------------------------------------------------

  describe('ellipse shape', () => {
    it('replace mode with ellipse selects elliptical region', () => {
      const mask = new SelectionMask(MASK_W, MASK_H);
      const { config } = makeConfig(mask, 'ellipse');
      const t = new MarqueeTool(config);

      t.onPointerDown(ev(10, 10));
      t.onPointerUp(ev(90, 90));

      const data = mask.getMaskData();
      // Center should be selected
      expect(data[50 * MASK_W + 50]).toBe(255);
      // Corner of bounding box should NOT be selected
      expect(data[10 * MASK_W + 10]).toBe(0);
    });
  });

  // -----------------------------------------------------------
  // Contour change callback
  // -----------------------------------------------------------

  describe('contour callback', () => {
    it('calls onContourChange during drag', () => {
      const mask = new SelectionMask(MASK_W, MASK_H);
      const { config, mockOnContourChange } = makeConfig(mask);
      const t = new MarqueeTool(config);

      t.onPointerDown(ev(10, 10));
      t.onPointerMove(ev(50, 50));

      expect(mockOnContourChange).toHaveBeenCalled();
      const arg = mockOnContourChange.mock.calls[mockOnContourChange.mock.calls.length - 1][0];
      // Should receive contour arrays
      expect(Array.isArray(arg)).toBe(true);
    });

    it('calls onContourChange(null) on reset', () => {
      const mask = new SelectionMask(MASK_W, MASK_H);
      const { config, mockOnContourChange } = makeConfig(mask);
      const t = new MarqueeTool(config);

      t.onPointerDown(ev(10, 10));
      t.onPointerMove(ev(50, 50));
      t.reset();

      expect(mockOnContourChange).toHaveBeenLastCalledWith(null);
    });
  });

  // -----------------------------------------------------------
  // Live preview restores snapshot each move
  // -----------------------------------------------------------

  describe('live preview snapshot/restore', () => {
    it('each pointer move re-applies from base state, not accumulating', () => {
      const mask = new SelectionMask(MASK_W, MASK_H);
      mask.addRect(0, 0, 50, 50); // existing
      const { config } = makeConfig(mask);
      const t = new MarqueeTool(config);

      // Start add mode
      t.onPointerDown(ev(60, 60, { shiftKey: true }));

      // Move to 70,70 → adds (60,60,10,10)
      t.onPointerMove(ev(70, 70, { shiftKey: true }));
      // Move to 80,80 → should add (60,60,20,20), not (60,60,10,10)+(60,60,20,20)
      t.onPointerMove(ev(80, 80, { shiftKey: true }));

      const data = mask.getMaskData();
      // Original region
      expect(data[25 * MASK_W + 25]).toBe(255);
      // New add region
      expect(data[70 * MASK_W + 70]).toBe(255);
      // Pixel at (65, 65) should be in the add region
      expect(data[65 * MASK_W + 65]).toBe(255);
    });
  });
});
