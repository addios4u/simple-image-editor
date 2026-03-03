import { describe, it, expect } from 'vitest';
import { extractContour } from '../marchingSquares';

/** Helper: create a mask and fill a rectangle. */
function makeMask(
  w: number,
  h: number,
  rects: Array<{ x: number; y: number; w: number; h: number }>,
): Uint8Array {
  const mask = new Uint8Array(w * h);
  for (const r of rects) {
    for (let y = r.y; y < r.y + r.h && y < h; y++) {
      for (let x = r.x; x < r.x + r.w && x < w; x++) {
        mask[y * w + x] = 255;
      }
    }
  }
  return mask;
}

describe('extractContour (Marching Squares)', () => {
  it('returns empty array for empty mask', () => {
    const mask = new Uint8Array(100);
    const contours = extractContour(mask, 10, 10);
    expect(contours).toEqual([]);
  });

  it('returns a single closed contour for a filled rectangle', () => {
    // 10x10 mask with a 4x4 rect at (3,3)
    const mask = makeMask(10, 10, [{ x: 3, y: 3, w: 4, h: 4 }]);
    const contours = extractContour(mask, 10, 10);

    expect(contours.length).toBeGreaterThanOrEqual(1);
    // Each contour should be a closed loop (first point === last point)
    for (const contour of contours) {
      expect(contour.length).toBeGreaterThanOrEqual(4);
      expect(contour[0]).toEqual(contour[contour.length - 1]);
    }
  });

  it('contour roughly surrounds the filled area', () => {
    const mask = makeMask(20, 20, [{ x: 5, y: 5, w: 10, h: 10 }]);
    const contours = extractContour(mask, 20, 20);

    expect(contours.length).toBe(1);
    const pts = contours[0];

    // All contour points should be near the rectangle boundary
    for (const [px, py] of pts) {
      // Points should be within 1 pixel of the rect boundary (5..15 range)
      expect(px).toBeGreaterThanOrEqual(4);
      expect(px).toBeLessThanOrEqual(16);
      expect(py).toBeGreaterThanOrEqual(4);
      expect(py).toBeLessThanOrEqual(16);
    }
  });

  it('produces two separate contours for two disjoint rectangles', () => {
    // Two rects far apart
    const mask = makeMask(30, 10, [
      { x: 1, y: 1, w: 5, h: 5 },
      { x: 20, y: 1, w: 5, h: 5 },
    ]);
    const contours = extractContour(mask, 30, 10);

    expect(contours.length).toBe(2);
    // Both should be closed
    for (const contour of contours) {
      expect(contour[0]).toEqual(contour[contour.length - 1]);
    }
  });

  it('handles a single pixel', () => {
    const mask = new Uint8Array(25); // 5x5
    mask[2 * 5 + 2] = 255; // pixel at (2,2)
    const contours = extractContour(mask, 5, 5);

    expect(contours.length).toBe(1);
    expect(contours[0][0]).toEqual(contours[0][contours[0].length - 1]);
  });

  it('handles full mask (all pixels selected)', () => {
    const mask = new Uint8Array(25).fill(255); // 5x5 all selected
    const contours = extractContour(mask, 5, 5);

    // Should produce a single contour around the entire mask
    expect(contours.length).toBe(1);
    expect(contours[0][0]).toEqual(contours[0][contours[0].length - 1]);
  });

  it('handles mask touching edges', () => {
    // Rect that touches all four edges
    const mask = makeMask(10, 10, [{ x: 0, y: 0, w: 10, h: 10 }]);
    const contours = extractContour(mask, 10, 10);

    expect(contours.length).toBe(1);
    expect(contours[0][0]).toEqual(contours[0][contours[0].length - 1]);
  });

  it('handles U-shaped selection (rect with center-top subtracted)', () => {
    // Start with 10x10 rect, subtract 4x5 from top-center → U shape
    const mask = makeMask(10, 10, [{ x: 0, y: 0, w: 10, h: 10 }]);
    // Clear center-top
    for (let y = 0; y < 5; y++) {
      for (let x = 3; x < 7; x++) {
        mask[y * 10 + x] = 0;
      }
    }
    const contours = extractContour(mask, 10, 10);

    // U-shape produces one contour (outer boundary includes the notch)
    expect(contours.length).toBeGreaterThanOrEqual(1);
    for (const contour of contours) {
      expect(contour[0]).toEqual(contour[contour.length - 1]);
    }
  });
});
