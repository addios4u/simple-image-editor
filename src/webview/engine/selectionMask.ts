/**
 * Pixel-based selection mask for complex selection operations (add, subtract, intersect).
 *
 * Uses a Uint8Array where each byte represents one pixel:
 *   0   = not selected
 *   255 = selected
 *
 * Follows the singleton pattern used by engineContext.ts.
 */

import type { SelectionRect } from '../state/editorStore';

// ---------------------------------------------------------------------------
// SelectionMask class
// ---------------------------------------------------------------------------

export class SelectionMask {
  private data: Uint8Array;
  private w: number;
  private h: number;
  private boundsCache: SelectionRect | null | undefined = undefined; // undefined = dirty

  constructor(width: number, height: number) {
    this.w = width;
    this.h = height;
    this.data = new Uint8Array(width * height);
  }

  getWidth(): number {
    return this.w;
  }

  getHeight(): number {
    return this.h;
  }

  getMaskData(): Uint8Array {
    return this.data;
  }

  isEmpty(): boolean {
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i] !== 0) return false;
    }
    return true;
  }

  getBounds(): SelectionRect | null {
    if (this.boundsCache !== undefined) return this.boundsCache;

    let minX = this.w;
    let minY = this.h;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < this.h; y++) {
      const rowOff = y * this.w;
      for (let x = 0; x < this.w; x++) {
        if (this.data[rowOff + x] !== 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < 0) {
      this.boundsCache = null;
      return null;
    }

    this.boundsCache = {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
    return this.boundsCache;
  }

  clear(): void {
    this.data.fill(0);
    this.invalidateBounds();
  }

  // -- Shape operations: add (OR) -----------------------------------------

  addRect(x: number, y: number, w: number, h: number): void {
    this.fillRect(x, y, w, h, 255);
  }

  addEllipse(x: number, y: number, w: number, h: number): void {
    this.fillEllipse(x, y, w, h, 255);
  }

  // -- Shape operations: subtract (clear) ----------------------------------

  subtractRect(x: number, y: number, w: number, h: number): void {
    this.fillRect(x, y, w, h, 0);
  }

  subtractEllipse(x: number, y: number, w: number, h: number): void {
    this.fillEllipse(x, y, w, h, 0);
  }

  // -- Shape operations: intersect (AND) -----------------------------------

  intersectRect(x: number, y: number, w: number, h: number): void {
    this.intersectShape(x, y, w, h, false);
  }

  intersectEllipse(x: number, y: number, w: number, h: number): void {
    this.intersectShape(x, y, w, h, true);
  }

  // -- Snapshot / Restore --------------------------------------------------

  snapshot(): Uint8Array {
    return new Uint8Array(this.data);
  }

  restore(snap: Uint8Array): void {
    this.data = new Uint8Array(snap);
    this.invalidateBounds();
  }

  // -- Internal helpers ----------------------------------------------------

  private invalidateBounds(): void {
    this.boundsCache = undefined;
  }

  /**
   * Fill a rectangle region with the given value (255 or 0).
   * Coordinates are clamped to mask boundaries.
   */
  private fillRect(
    rx: number,
    ry: number,
    rw: number,
    rh: number,
    value: number,
  ): void {
    const x0 = Math.max(0, Math.floor(rx));
    const y0 = Math.max(0, Math.floor(ry));
    const x1 = Math.min(this.w, Math.floor(rx + rw));
    const y1 = Math.min(this.h, Math.floor(ry + rh));

    if (x1 <= x0 || y1 <= y0) return;

    for (let y = y0; y < y1; y++) {
      const rowOff = y * this.w;
      for (let x = x0; x < x1; x++) {
        this.data[rowOff + x] = value;
      }
    }
    this.invalidateBounds();
  }

  /**
   * Fill an ellipse inscribed in the bounding box (ex, ey, ew, eh).
   * Uses the standard ellipse equation: ((x-cx)/rx)^2 + ((y-cy)/ry)^2 <= 1
   */
  private fillEllipse(
    ex: number,
    ey: number,
    ew: number,
    eh: number,
    value: number,
  ): void {
    if (ew <= 0 || eh <= 0) return;

    const cx = ex + ew / 2;
    const cy = ey + eh / 2;
    const rx = ew / 2;
    const ry = eh / 2;

    const x0 = Math.max(0, Math.floor(ex));
    const y0 = Math.max(0, Math.floor(ey));
    const x1 = Math.min(this.w, Math.ceil(ex + ew));
    const y1 = Math.min(this.h, Math.ceil(ey + eh));

    for (let y = y0; y < y1; y++) {
      const rowOff = y * this.w;
      const dy = (y + 0.5 - cy) / ry;
      const dy2 = dy * dy;
      for (let x = x0; x < x1; x++) {
        const dx = (x + 0.5 - cx) / rx;
        if (dx * dx + dy2 <= 1) {
          this.data[rowOff + x] = value;
        }
      }
    }
    this.invalidateBounds();
  }

  /**
   * Intersect: keep only pixels that are BOTH in the current mask AND inside
   * the given shape. Pixels outside the shape are cleared to 0.
   */
  private intersectShape(
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    ellipse: boolean,
  ): void {
    const cx = sx + sw / 2;
    const cy = sy + sh / 2;
    const rx = sw / 2;
    const ry = sh / 2;

    for (let y = 0; y < this.h; y++) {
      const rowOff = y * this.w;
      for (let x = 0; x < this.w; x++) {
        if (this.data[rowOff + x] === 0) continue;

        let inside: boolean;
        if (ellipse) {
          const dx = (x + 0.5 - cx) / rx;
          const dy = (y + 0.5 - cy) / ry;
          inside = dx * dx + dy * dy <= 1;
        } else {
          inside = x >= sx && x < sx + sw && y >= sy && y < sy + sh;
        }

        if (!inside) {
          this.data[rowOff + x] = 0;
        }
      }
    }
    this.invalidateBounds();
  }
}

// ---------------------------------------------------------------------------
// Module singleton
// ---------------------------------------------------------------------------

let currentMask: SelectionMask | null = null;

export function initSelectionMask(w: number, h: number): void {
  currentMask = new SelectionMask(w, h);
}

export function getSelectionMask(): SelectionMask | null {
  return currentMask;
}

export function destroySelectionMask(): void {
  currentMask = null;
}
