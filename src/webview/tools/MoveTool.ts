import { BaseTool, type PointerEvent, type Point } from './BaseTool';

export interface MoveToolConfig {
  getActiveLayerId: () => string;
  getLayerOffset: (layerId: string) => { x: number; y: number };
  isLayerLocked: () => boolean;
  setLayerOffset: (layerId: string, x: number, y: number) => void;
  requestRender: () => void;
}

export class MoveTool extends BaseTool {
  readonly name = 'move';

  isDragging = false;

  private startPoint: Point | null = null;
  private currentPoint: Point | null = null;
  private baseOffset: { x: number; y: number } = { x: 0, y: 0 };
  private config: MoveToolConfig | undefined;

  constructor(config?: MoveToolConfig) {
    super();
    this.config = config;
  }

  getCursor(): string {
    return 'move';
  }

  onPointerDown(e: PointerEvent): void {
    if (this.config?.isLayerLocked()) return;
    this.isDragging = true;
    this.startPoint = { x: e.x, y: e.y };
    this.currentPoint = { x: e.x, y: e.y };

    if (this.config) {
      const layerId = this.config.getActiveLayerId();
      this.baseOffset = this.config.getLayerOffset(layerId);
    }
  }

  onPointerMove(e: PointerEvent): void {
    if (!this.isDragging) return;
    this.currentPoint = { x: e.x, y: e.y };

    if (this.config && this.startPoint) {
      const dx = Math.round(this.currentPoint.x - this.startPoint.x);
      const dy = Math.round(this.currentPoint.y - this.startPoint.y);
      const layerId = this.config.getActiveLayerId();
      this.config.setLayerOffset(
        layerId,
        this.baseOffset.x + dx,
        this.baseOffset.y + dy,
      );
      this.config.requestRender();
    }
  }

  onPointerUp(_e: PointerEvent): void {
    this.isDragging = false;
  }

  getDragDelta(): { dx: number; dy: number } {
    if (!this.startPoint || !this.currentPoint) {
      return { dx: 0, dy: 0 };
    }
    return {
      dx: this.currentPoint.x - this.startPoint.x,
      dy: this.currentPoint.y - this.startPoint.y,
    };
  }

  reset(): void {
    this.isDragging = false;
    this.startPoint = null;
    this.currentPoint = null;
    this.baseOffset = { x: 0, y: 0 };
  }
}
