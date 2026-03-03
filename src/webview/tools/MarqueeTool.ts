import { BaseTool, type PointerEvent, type Point } from './BaseTool';
import type { SelectionRect, SelectionShape } from '../state/editorStore';
import { SelectionMask } from '../engine/selectionMask';
import { extractContour } from '../engine/marchingSquares';

export type { SelectionRect };

export interface MarqueeToolConfig {
  /** Update the store's bounding-rect selection (backward compat). */
  setSelection: (rect: SelectionRect | null) => void;
  getSelectionShape: () => SelectionShape;
  getCanvasSize: () => { width: number; height: number };
  /** Get the current selection mask (global singleton). */
  getMask: () => SelectionMask | null;
  /** Push updated contour for marching-ants rendering. */
  onContourChange: (contour: Array<Array<[number, number]>> | null) => void;
}

type SelectionMode = 'replace' | 'add' | 'subtract' | 'intersect';

export class MarqueeTool extends BaseTool {
  readonly name = 'marquee';

  isSelecting = false;

  private startPoint: Point | null = null;
  private selectionRect: SelectionRect | null = null;
  private config: MarqueeToolConfig | undefined;
  private mode: SelectionMode = 'replace';
  private maskSnapshot: Uint8Array | null = null;

  constructor(config?: MarqueeToolConfig) {
    super();
    this.config = config;
  }

  getCursor(): string {
    return 'crosshair';
  }

  onPointerDown(e: PointerEvent): void {
    // Determine selection mode from modifier keys
    // Priority: Shift+Alt → intersect, Shift → add, Alt → subtract
    if (e.shiftKey && e.altKey) {
      this.mode = 'intersect';
    } else if (e.shiftKey) {
      this.mode = 'add';
    } else if (e.altKey) {
      this.mode = 'subtract';
    } else {
      this.mode = 'replace';
    }

    // Snapshot mask state for live preview restore
    const mask = this.config?.getMask() ?? null;
    this.maskSnapshot = mask ? mask.snapshot() : null;

    this.isSelecting = true;
    this.startPoint = { x: e.x, y: e.y };
    this.selectionRect = { x: e.x, y: e.y, width: 0, height: 0 };
  }

  onPointerMove(e: PointerEvent): void {
    if (!this.isSelecting || !this.startPoint) return;
    this.updateRect(e);
    this.applyToMask();
  }

  onPointerUp(e: PointerEvent): void {
    if (!this.isSelecting || !this.startPoint) return;
    this.updateRect(e);
    this.isSelecting = false;
    this.applyToMask();
    this.maskSnapshot = null;
  }

  getSelectionRect(): SelectionRect | null {
    return this.selectionRect;
  }

  reset(): void {
    // If we have a snapshot (mid-drag), restore it
    if (this.maskSnapshot) {
      const mask = this.config?.getMask() ?? null;
      if (mask) {
        mask.restore(this.maskSnapshot);
      }
    }
    this.isSelecting = false;
    this.startPoint = null;
    this.selectionRect = null;
    this.maskSnapshot = null;
    this.mode = 'replace';
    if (this.config) {
      const mask = this.config.getMask();
      if (mask) {
        mask.clear();
        this.config.onContourChange(null);
      }
      this.config.setSelection(null);
    }
  }

  /**
   * Apply the current drag rect onto the mask using the active mode,
   * then update store bounds and contour.
   */
  private applyToMask(): void {
    if (!this.config || !this.selectionRect) return;

    const mask = this.config.getMask();
    if (!mask) {
      // No mask available — fall back to simple rect
      this.config.setSelection(this.selectionRect);
      return;
    }

    const rect = this.selectionRect;
    const shape = this.config.getSelectionShape();

    // Restore from snapshot so each move re-applies from the base state
    if (this.maskSnapshot) {
      mask.restore(this.maskSnapshot);
    }

    // Apply the operation
    switch (this.mode) {
      case 'replace':
        mask.clear();
        if (shape === 'ellipse') {
          mask.addEllipse(rect.x, rect.y, rect.width, rect.height);
        } else {
          mask.addRect(rect.x, rect.y, rect.width, rect.height);
        }
        break;
      case 'add':
        if (shape === 'ellipse') {
          mask.addEllipse(rect.x, rect.y, rect.width, rect.height);
        } else {
          mask.addRect(rect.x, rect.y, rect.width, rect.height);
        }
        break;
      case 'subtract':
        if (shape === 'ellipse') {
          mask.subtractEllipse(rect.x, rect.y, rect.width, rect.height);
        } else {
          mask.subtractRect(rect.x, rect.y, rect.width, rect.height);
        }
        break;
      case 'intersect':
        if (shape === 'ellipse') {
          mask.intersectEllipse(rect.x, rect.y, rect.width, rect.height);
        } else {
          mask.intersectRect(rect.x, rect.y, rect.width, rect.height);
        }
        break;
    }

    // Update store with bounding rect
    const bounds = mask.getBounds();
    this.config.setSelection(bounds);
    this.selectionRect = bounds;

    // Update contour for rendering
    const contour = mask.isEmpty()
      ? null
      : extractContour(mask.getMaskData(), mask.getWidth(), mask.getHeight());
    this.config.onContourChange(contour);
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
}
