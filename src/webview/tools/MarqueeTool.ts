import { BaseTool, type PointerEvent, type Point } from './BaseTool';
import type { SelectionShape } from '../state/editorStore';

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MarqueeToolConfig {
  setSelection: (rect: SelectionRect | null) => void;
  getSelection: () => SelectionRect | null;
  getSelectionShape: () => SelectionShape;
}

type SelectionMode = 'replace' | 'add' | 'subtract';

/** Compute bounding box union of two rects. */
function unionBounds(a: SelectionRect, b: SelectionRect): SelectionRect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);
  return { x, y, width: right - x, height: bottom - y };
}

/**
 * Subtract `sub` from `base`. Returns the largest remaining rectangle,
 * or null if `base` is fully covered.
 */
function subtractRect(base: SelectionRect, sub: SelectionRect): SelectionRect | null {
  const bRight = base.x + base.width;
  const bBottom = base.y + base.height;
  const sRight = sub.x + sub.width;
  const sBottom = sub.y + sub.height;

  // No overlap → keep base
  if (sub.x >= bRight || sRight <= base.x || sub.y >= bBottom || sBottom <= base.y) {
    return base;
  }

  // Fully covered → null
  if (sub.x <= base.x && sRight >= bRight && sub.y <= base.y && sBottom >= bBottom) {
    return null;
  }

  // Compute up to 4 remaining strips and pick the largest by area
  const candidates: SelectionRect[] = [];

  // Left strip
  if (sub.x > base.x) {
    candidates.push({ x: base.x, y: base.y, width: sub.x - base.x, height: base.height });
  }
  // Right strip
  if (sRight < bRight) {
    candidates.push({ x: sRight, y: base.y, width: bRight - sRight, height: base.height });
  }
  // Top strip
  if (sub.y > base.y) {
    candidates.push({ x: base.x, y: base.y, width: base.width, height: sub.y - base.y });
  }
  // Bottom strip
  if (sBottom < bBottom) {
    candidates.push({ x: base.x, y: sBottom, width: base.width, height: bBottom - sBottom });
  }

  if (candidates.length === 0) return null;

  // Return the largest by area
  let best = candidates[0];
  let bestArea = best.width * best.height;
  for (let i = 1; i < candidates.length; i++) {
    const area = candidates[i].width * candidates[i].height;
    if (area > bestArea) {
      best = candidates[i];
      bestArea = area;
    }
  }
  return best;
}

export class MarqueeTool extends BaseTool {
  readonly name = 'marquee';

  isSelecting = false;

  private startPoint: Point | null = null;
  private selectionRect: SelectionRect | null = null;
  private config: MarqueeToolConfig | undefined;
  private mode: SelectionMode = 'replace';
  private prevSelection: SelectionRect | null = null;

  constructor(config?: MarqueeToolConfig) {
    super();
    this.config = config;
  }

  getCursor(): string {
    return 'crosshair';
  }

  onPointerDown(e: PointerEvent): void {
    // Determine selection mode from modifier keys
    if (e.shiftKey) {
      this.mode = 'add';
    } else if (e.altKey) {
      this.mode = 'subtract';
    } else {
      this.mode = 'replace';
    }

    // Save previous selection for add/subtract
    this.prevSelection = this.config?.getSelection() ?? null;

    this.isSelecting = true;
    this.startPoint = { x: e.x, y: e.y };
    this.selectionRect = { x: e.x, y: e.y, width: 0, height: 0 };
  }

  onPointerMove(e: PointerEvent): void {
    if (!this.isSelecting || !this.startPoint) return;
    this.updateRect(e);

    // Live preview: show combined result during drag
    if (this.config) {
      const combined = this.combineSelection(this.selectionRect!);
      this.config.setSelection(combined);
    }
  }

  onPointerUp(e: PointerEvent): void {
    if (!this.isSelecting || !this.startPoint) return;
    this.updateRect(e);
    this.isSelecting = false;

    if (this.config) {
      const combined = this.combineSelection(this.selectionRect!);
      this.config.setSelection(combined);
      this.selectionRect = combined;
    }
  }

  getSelectionRect(): SelectionRect | null {
    return this.selectionRect;
  }

  reset(): void {
    this.isSelecting = false;
    this.startPoint = null;
    this.selectionRect = null;
    this.prevSelection = null;
    this.mode = 'replace';
    this.config?.setSelection(null);
  }

  private updateRect(e: PointerEvent): void {
    if (!this.startPoint) return;

    const width = Math.abs(e.x - this.startPoint.x);
    const height = Math.abs(e.y - this.startPoint.y);

    const x = e.x >= this.startPoint.x
      ? this.startPoint.x
      : this.startPoint.x - width;
    const y = e.y >= this.startPoint.y
      ? this.startPoint.y
      : this.startPoint.y - height;

    this.selectionRect = { x, y, width, height };
  }

  private combineSelection(newRect: SelectionRect): SelectionRect | null {
    switch (this.mode) {
      case 'add':
        if (!this.prevSelection) return newRect;
        return unionBounds(this.prevSelection, newRect);
      case 'subtract':
        if (!this.prevSelection) return null;
        return subtractRect(this.prevSelection, newRect);
      case 'replace':
      default:
        return newRect;
    }
  }
}
