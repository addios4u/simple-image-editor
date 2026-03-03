import { BaseTool, type PointerEvent, type Point } from './BaseTool';

/**
 * Dependency-injection config that connects BrushTool to the WASM engine.
 * All getters are called per-stroke so they always reflect current UI state.
 */
export interface BrushToolConfig {
  getColor: () => number;
  getSize: () => number;
  getHardness: () => number;
  getActiveLayerId: () => string;
  brushStrokeLayer: (
    layerId: string, cx: number, cy: number,
    color: number, size: number, hardness: number,
  ) => void;
  requestRender: () => void;
}

export class BrushTool extends BaseTool {
  readonly name = 'brush';

  isDrawing = false;
  size = 5;
  hardness = 1.0;

  private strokePoints: Point[] = [];
  private config: BrushToolConfig | null;

  constructor(config?: BrushToolConfig) {
    super();
    this.config = config ?? null;
  }

  getCursor(): string {
    return 'crosshair';
  }

  onPointerDown(e: PointerEvent): void {
    this.isDrawing = true;
    this.strokePoints = [{ x: e.x, y: e.y }];
    this.applyBrush(e.x, e.y);
  }

  onPointerMove(e: PointerEvent): void {
    if (!this.isDrawing) return;
    this.strokePoints.push({ x: e.x, y: e.y });
    this.applyBrush(e.x, e.y);
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

  private applyBrush(cx: number, cy: number): void {
    if (!this.config) return;
    const layerId = this.config.getActiveLayerId();
    const color = this.config.getColor();
    const size = this.config.getSize();
    const hardness = this.config.getHardness();
    this.config.brushStrokeLayer(layerId, cx, cy, color, size, hardness);
    this.config.requestRender();
  }
}
