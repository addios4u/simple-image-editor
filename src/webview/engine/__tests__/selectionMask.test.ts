import { describe, it, expect, beforeEach } from 'vitest';
import {
  SelectionMask,
  initSelectionMask,
  getSelectionMask,
  destroySelectionMask,
} from '../selectionMask';

describe('SelectionMask', () => {
  let mask: SelectionMask;

  beforeEach(() => {
    mask = new SelectionMask(100, 100);
  });

  // -----------------------------------------------------------
  // Construction & basic state
  // -----------------------------------------------------------

  it('creates an empty mask with correct dimensions', () => {
    expect(mask.getWidth()).toBe(100);
    expect(mask.getHeight()).toBe(100);
    expect(mask.isEmpty()).toBe(true);
    expect(mask.getBounds()).toBeNull();
  });

  it('getMaskData returns Uint8Array of correct length', () => {
    const data = mask.getMaskData();
    expect(data).toBeInstanceOf(Uint8Array);
    expect(data.length).toBe(100 * 100);
  });

  // -----------------------------------------------------------
  // addRect
  // -----------------------------------------------------------

  describe('addRect', () => {
    it('marks pixels inside the rectangle as selected (255)', () => {
      mask.addRect(10, 20, 30, 40);
      const data = mask.getMaskData();

      // Inside: (10,20)
      expect(data[20 * 100 + 10]).toBe(255);
      // Inside: (39, 59) — last pixel in rect
      expect(data[59 * 100 + 39]).toBe(255);
      // Outside: (9, 20)
      expect(data[20 * 100 + 9]).toBe(0);
      // Outside: (40, 20) — just past right edge
      expect(data[20 * 100 + 40]).toBe(0);
    });

    it('clamps to mask boundaries', () => {
      // Rect extends beyond right and bottom edges
      mask.addRect(80, 90, 50, 50);

      const data = mask.getMaskData();
      // Inside (clamped): (99, 99)
      expect(data[99 * 100 + 99]).toBe(255);
      // Inside (clamped): (80, 90)
      expect(data[90 * 100 + 80]).toBe(255);
    });

    it('handles negative coordinates by clamping to 0', () => {
      mask.addRect(-10, -10, 20, 20);

      const data = mask.getMaskData();
      // (0,0) should be selected
      expect(data[0]).toBe(255);
      // (9,9) should be selected
      expect(data[9 * 100 + 9]).toBe(255);
      // (10,10) should NOT be selected (because -10+20=10, exclusive)
      expect(data[10 * 100 + 10]).toBe(0);
    });

    it('does nothing for zero-area rect', () => {
      mask.addRect(10, 10, 0, 0);
      expect(mask.isEmpty()).toBe(true);
    });

    it('unions with existing selection (OR)', () => {
      mask.addRect(0, 0, 20, 20);
      mask.addRect(50, 50, 20, 20);

      const data = mask.getMaskData();
      // Both areas selected
      expect(data[10 * 100 + 10]).toBe(255);
      expect(data[60 * 100 + 60]).toBe(255);
      // Gap between them is NOT selected
      expect(data[30 * 100 + 30]).toBe(0);
    });
  });

  // -----------------------------------------------------------
  // addEllipse
  // -----------------------------------------------------------

  describe('addEllipse', () => {
    it('marks pixels inside the ellipse as selected', () => {
      // Ellipse bounding box at (10, 10, 40, 40) → center (30, 30), radii (20, 20)
      mask.addEllipse(10, 10, 40, 40);

      const data = mask.getMaskData();
      // Center should be selected
      expect(data[30 * 100 + 30]).toBe(255);
      // Corner of bounding box should NOT be selected (outside ellipse)
      expect(data[10 * 100 + 10]).toBe(0);
    });

    it('does nothing for zero-area ellipse', () => {
      mask.addEllipse(10, 10, 0, 0);
      expect(mask.isEmpty()).toBe(true);
    });
  });

  // -----------------------------------------------------------
  // subtractRect
  // -----------------------------------------------------------

  describe('subtractRect', () => {
    it('removes pixels from existing selection', () => {
      mask.addRect(0, 0, 100, 100); // Select all
      mask.subtractRect(20, 20, 60, 60); // Remove center

      const data = mask.getMaskData();
      // Border still selected
      expect(data[0]).toBe(255);              // top-left
      expect(data[10 * 100 + 10]).toBe(255);  // within border
      // Center removed
      expect(data[50 * 100 + 50]).toBe(0);
      expect(data[20 * 100 + 20]).toBe(0);    // edge of subtracted area
    });

    it('creates L-shaped selection when subtracting corner', () => {
      mask.addRect(0, 0, 60, 60);
      mask.subtractRect(30, 0, 30, 30); // Remove top-right quadrant

      const data = mask.getMaskData();
      // Top-left: selected
      expect(data[10 * 100 + 10]).toBe(255);
      // Top-right: NOT selected
      expect(data[10 * 100 + 40]).toBe(0);
      // Bottom-left: selected
      expect(data[40 * 100 + 10]).toBe(255);
      // Bottom-right: selected
      expect(data[40 * 100 + 40]).toBe(255);
    });

    it('with no existing selection does nothing', () => {
      mask.subtractRect(10, 10, 50, 50);
      expect(mask.isEmpty()).toBe(true);
    });
  });

  // -----------------------------------------------------------
  // subtractEllipse
  // -----------------------------------------------------------

  describe('subtractEllipse', () => {
    it('removes elliptical area from selection', () => {
      mask.addRect(0, 0, 100, 100); // Select all
      mask.subtractEllipse(25, 25, 50, 50); // Remove center ellipse

      const data = mask.getMaskData();
      // Center should be removed
      expect(data[50 * 100 + 50]).toBe(0);
      // Corners should remain (outside ellipse)
      expect(data[0]).toBe(255);
      expect(data[99 * 100 + 99]).toBe(255);
    });
  });

  // -----------------------------------------------------------
  // intersectRect
  // -----------------------------------------------------------

  describe('intersectRect', () => {
    it('keeps only pixels that are in both existing selection and rect', () => {
      mask.addRect(0, 0, 60, 60);
      mask.intersectRect(30, 30, 60, 60);

      const data = mask.getMaskData();
      // Intersection: (30,30) to (60,60)
      expect(data[40 * 100 + 40]).toBe(255);
      // Outside intersection — was in original but not in intersect rect
      expect(data[10 * 100 + 10]).toBe(0);
      // Outside both
      expect(data[80 * 100 + 80]).toBe(0);
    });

    it('with no existing selection results in empty', () => {
      mask.intersectRect(10, 10, 50, 50);
      expect(mask.isEmpty()).toBe(true);
    });
  });

  // -----------------------------------------------------------
  // intersectEllipse
  // -----------------------------------------------------------

  describe('intersectEllipse', () => {
    it('keeps only pixels inside both selection and ellipse', () => {
      mask.addRect(0, 0, 100, 100);
      mask.intersectEllipse(25, 25, 50, 50);

      const data = mask.getMaskData();
      // Center of ellipse (50,50): selected
      expect(data[50 * 100 + 50]).toBe(255);
      // Corner (0,0): outside ellipse → cleared
      expect(data[0]).toBe(0);
    });
  });

  // -----------------------------------------------------------
  // getBounds
  // -----------------------------------------------------------

  describe('getBounds', () => {
    it('returns null for empty mask', () => {
      expect(mask.getBounds()).toBeNull();
    });

    it('returns tight bounding rect for single rect', () => {
      mask.addRect(10, 20, 30, 40);
      expect(mask.getBounds()).toEqual({ x: 10, y: 20, width: 30, height: 40 });
    });

    it('returns bounding rect encompassing two disjoint rects', () => {
      mask.addRect(5, 5, 10, 10);
      mask.addRect(80, 80, 10, 10);
      const bounds = mask.getBounds();
      expect(bounds).toEqual({ x: 5, y: 5, width: 85, height: 85 });
    });

    it('updates after subtract operation', () => {
      mask.addRect(0, 0, 100, 100);
      mask.subtractRect(0, 0, 100, 50); // Remove top half
      const bounds = mask.getBounds();
      expect(bounds).toEqual({ x: 0, y: 50, width: 100, height: 50 });
    });
  });

  // -----------------------------------------------------------
  // clear
  // -----------------------------------------------------------

  describe('clear', () => {
    it('removes all selection', () => {
      mask.addRect(0, 0, 100, 100);
      mask.clear();
      expect(mask.isEmpty()).toBe(true);
      expect(mask.getBounds()).toBeNull();
    });
  });

  // -----------------------------------------------------------
  // snapshot / restore
  // -----------------------------------------------------------

  describe('snapshot / restore', () => {
    it('snapshot returns independent copy of mask data', () => {
      mask.addRect(10, 10, 20, 20);
      const snap = mask.snapshot();

      // Modify mask after snapshot
      mask.clear();
      expect(mask.isEmpty()).toBe(true);

      // Restore from snapshot
      mask.restore(snap);
      expect(mask.isEmpty()).toBe(false);
      expect(mask.getBounds()).toEqual({ x: 10, y: 10, width: 20, height: 20 });
    });

    it('restoring does not share reference with snapshot array', () => {
      mask.addRect(10, 10, 20, 20);
      const snap = mask.snapshot();
      mask.restore(snap);

      // Mutating the snap array should not affect the mask
      snap[10 * 100 + 10] = 0;
      expect(mask.getMaskData()[10 * 100 + 10]).toBe(255);
    });
  });

  // -----------------------------------------------------------
  // getPixel
  // -----------------------------------------------------------

  describe('getPixel', () => {
    it('returns 0 for unselected pixel', () => {
      expect(mask.getPixel(50, 50)).toBe(0);
    });

    it('returns 255 for selected pixel', () => {
      mask.addRect(10, 10, 20, 20);
      expect(mask.getPixel(15, 15)).toBe(255);
    });

    it('returns 0 for out-of-bounds coordinates', () => {
      mask.addRect(0, 0, 100, 100);
      expect(mask.getPixel(-1, 50)).toBe(0);
      expect(mask.getPixel(100, 50)).toBe(0);
      expect(mask.getPixel(50, -1)).toBe(0);
      expect(mask.getPixel(50, 100)).toBe(0);
    });
  });

  // -----------------------------------------------------------
  // translate
  // -----------------------------------------------------------

  describe('translate', () => {
    it('moves selection to the right and down', () => {
      mask.addRect(10, 10, 20, 20);
      mask.translate(5, 5);
      expect(mask.getBounds()).toEqual({ x: 15, y: 15, width: 20, height: 20 });
    });

    it('moves selection to the left and up', () => {
      mask.addRect(20, 20, 10, 10);
      mask.translate(-5, -5);
      expect(mask.getBounds()).toEqual({ x: 15, y: 15, width: 10, height: 10 });
    });

    it('clips pixels that move out of bounds', () => {
      mask.addRect(0, 0, 10, 10);
      mask.translate(-5, 0);
      // Only x=0..4 remain (originally x=5..9 shifted left by 5)
      expect(mask.getBounds()).toEqual({ x: 0, y: 0, width: 5, height: 10 });
    });

    it('clips pixels that move past right/bottom edge', () => {
      mask.addRect(90, 90, 10, 10);
      mask.translate(5, 5);
      // Only (95..99, 95..99) remain
      expect(mask.getBounds()).toEqual({ x: 95, y: 95, width: 5, height: 5 });
    });

    it('results in empty mask if fully moved out of bounds', () => {
      mask.addRect(0, 0, 10, 10);
      mask.translate(200, 0);
      expect(mask.isEmpty()).toBe(true);
      expect(mask.getBounds()).toBeNull();
    });

    it('zero translation does not change mask', () => {
      mask.addRect(10, 10, 20, 20);
      const before = mask.snapshot();
      mask.translate(0, 0);
      expect(mask.getMaskData()).toEqual(before);
    });

    it('preserves complex shapes (L-shape)', () => {
      mask.addRect(0, 0, 30, 30);
      mask.subtractRect(15, 0, 15, 15); // L-shape
      mask.translate(10, 10);

      // Original selected pixel (5, 20) → now at (15, 30)
      expect(mask.getPixel(15, 30)).toBe(255);
      // Original unselected pixel (20, 5) → now at (30, 15) — still unselected
      expect(mask.getPixel(30, 15)).toBe(0);
    });
  });

  // -----------------------------------------------------------
  // Module singleton
  // -----------------------------------------------------------

  describe('module singleton', () => {
    it('initSelectionMask creates and returns via getSelectionMask', () => {
      initSelectionMask(200, 150);
      const m = getSelectionMask();
      expect(m).not.toBeNull();
      expect(m!.getWidth()).toBe(200);
      expect(m!.getHeight()).toBe(150);
      destroySelectionMask();
    });

    it('destroySelectionMask clears the singleton', () => {
      initSelectionMask(100, 100);
      destroySelectionMask();
      expect(getSelectionMask()).toBeNull();
    });

    it('reinit replaces existing mask', () => {
      initSelectionMask(100, 100);
      const first = getSelectionMask();
      initSelectionMask(200, 200);
      const second = getSelectionMask();
      expect(second).not.toBe(first);
      expect(second!.getWidth()).toBe(200);
      destroySelectionMask();
    });
  });
});
