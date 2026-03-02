import { BaseTool, type PointerEvent, type Point } from './BaseTool';

export class BrushTool extends BaseTool {
  readonly name = 'brush';

  isDrawing = false;
  size = 5;
  hardness = 1.0;

  private strokePoints: Point[] = [];

  getCursor(): string {
    return 'crosshair';
  }

  onPointerDown(e: PointerEvent): void {
    this.isDrawing = true;
    this.strokePoints = [{ x: e.x, y: e.y }];
  }

  onPointerMove(e: PointerEvent): void {
    if (!this.isDrawing) return;
    this.strokePoints.push({ x: e.x, y: e.y });
  }

  onPointerUp(_e: PointerEvent): void {
    this.isDrawing = false;
  }

  getStrokePoints(): Point[] {
    return [...this.strokePoints];
  }

  reset(): void {
    this.isDrawing = false;
    this.strokePoints = [];
  }
}
