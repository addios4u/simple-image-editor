import { BaseTool, type PointerEvent, type Point } from './BaseTool';

export class TextTool extends BaseTool {
  readonly name = 'text';

  isEditing = false;

  private insertionPoint: Point | null = null;

  getCursor(): string {
    return 'text';
  }

  onPointerDown(e: PointerEvent): void {
    this.insertionPoint = { x: e.x, y: e.y };
    this.isEditing = true;
  }

  getInsertionPoint(): Point | null {
    return this.insertionPoint;
  }

  reset(): void {
    this.isEditing = false;
    this.insertionPoint = null;
  }
}
