import { BaseTool, type PointerEvent, type Point } from './BaseTool';

export class MoveTool extends BaseTool {
  readonly name = 'move';

  isDragging = false;

  private startPoint: Point | null = null;
  private currentPoint: Point | null = null;

  getCursor(): string {
    return 'move';
  }

  onPointerDown(e: PointerEvent): void {
    this.isDragging = true;
    this.startPoint = { x: e.x, y: e.y };
    this.currentPoint = { x: e.x, y: e.y };
  }

  onPointerMove(e: PointerEvent): void {
    if (!this.isDragging) return;
    this.currentPoint = { x: e.x, y: e.y };
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
  }
}
