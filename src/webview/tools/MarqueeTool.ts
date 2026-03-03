import { BaseTool, type PointerEvent, type Point } from './BaseTool';

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MarqueeToolConfig {
  setSelection: (rect: SelectionRect | null) => void;
}

export class MarqueeTool extends BaseTool {
  readonly name = 'marquee';

  isSelecting = false;

  private startPoint: Point | null = null;
  private selectionRect: SelectionRect | null = null;
  private config: MarqueeToolConfig | undefined;

  constructor(config?: MarqueeToolConfig) {
    super();
    this.config = config;
  }

  getCursor(): string {
    return 'crosshair';
  }

  onPointerDown(e: PointerEvent): void {
    this.isSelecting = true;
    this.startPoint = { x: e.x, y: e.y };
    this.selectionRect = { x: e.x, y: e.y, width: 0, height: 0 };
  }

  onPointerMove(e: PointerEvent): void {
    if (!this.isSelecting || !this.startPoint) return;
    this.updateRect(e);
    this.config?.setSelection(this.selectionRect);
  }

  onPointerUp(e: PointerEvent): void {
    if (!this.isSelecting || !this.startPoint) return;
    this.updateRect(e);
    this.isSelecting = false;
    this.config?.setSelection(this.selectionRect);
  }

  getSelectionRect(): SelectionRect | null {
    return this.selectionRect;
  }

  reset(): void {
    this.isSelecting = false;
    this.startPoint = null;
    this.selectionRect = null;
    this.config?.setSelection(null);
  }

  private updateRect(e: PointerEvent): void {
    if (!this.startPoint) return;

    let width = Math.abs(e.x - this.startPoint.x);
    let height = Math.abs(e.y - this.startPoint.y);

    if (e.shiftKey) {
      const side = Math.min(width, height);
      width = side;
      height = side;
    }

    const x = e.x >= this.startPoint.x
      ? this.startPoint.x
      : this.startPoint.x - width;
    const y = e.y >= this.startPoint.y
      ? this.startPoint.y
      : this.startPoint.y - height;

    this.selectionRect = { x, y, width, height };
  }
}
