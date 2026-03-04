import { BaseTool, type PointerEvent, type Point } from './BaseTool';
import type { WasmRegionSnapshot } from '../engine/wasmBridge';

/**
 * Dependency-injection config that connects BrushTool to the WASM engine.
 * All getters are called per-stroke so they always reflect current UI state.
 */
export interface BrushToolConfig {
  getColor: () => number;
  getSize: () => number;
  getHardness: () => number;
  getActiveLayerId: () => string;
  isLayerLocked: () => boolean;
  brushStrokeLayer: (
    layerId: string, cx: number, cy: number,
    color: number, size: number, hardness: number,
  ) => void;
  requestRender: () => void;
  getCanvasSize?: () => { width: number; height: number };
  captureLayerRegion?: (layerId: string, x: number, y: number, w: number, h: number) => WasmRegionSnapshot | null;
  pushEditWithSnapshot?: (label: string, layerId: string, before: WasmRegionSnapshot, region: { x: number; y: number; w: number; h: number }) => string;
  commitSnapshot?: (entryId: string, after: WasmRegionSnapshot) => void;
  /** Bakes layer offset into pixels if non-zero, resetting offset to (0,0). */
  bakeOffsetIfNeeded?: (layerId: string) => void;
}

export class BrushTool extends BaseTool {
  readonly name = 'brush';

  isDrawing = false;
  size = 5;
  hardness = 1.0;

  private strokePoints: Point[] = [];
  private lastPoint: Point | null = null;
  private config: BrushToolConfig | null;
  private _strokeHistoryId: string | null = null;

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
    this.lastPoint = { x: e.x, y: e.y };
    this._strokeHistoryId = null;

    if (this.config && !this.config.isLayerLocked()) {
      const layerId = this.config.getActiveLayerId();
      // Bake offset into pixels so brush can draw at full canvas coverage
      this.config.bakeOffsetIfNeeded?.(layerId);
      const size = this.config.getCanvasSize?.() ?? { width: 0, height: 0 };
      const before = this.config.captureLayerRegion?.(layerId, 0, 0, size.width, size.height) ?? null;
      if (before && this.config.pushEditWithSnapshot) {
        this._strokeHistoryId = this.config.pushEditWithSnapshot(
          'Brush Stroke', layerId, before,
          { x: 0, y: 0, w: size.width, h: size.height },
        );
      }
    }

    this.applyBrush(e.x, e.y);
  }

  onPointerMove(e: PointerEvent): void {
    if (!this.isDrawing || !this.lastPoint) return;
    this.strokePoints.push({ x: e.x, y: e.y });

    // 이전 점 → 현재 점 사이를 보간하여 연속된 획을 만든다.
    const dx = e.x - this.lastPoint.x;
    const dy = e.y - this.lastPoint.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const size = this.config?.getSize() ?? this.size;
    const spacing = Math.max(1, size * 0.25);
    const steps = Math.max(1, Math.floor(dist / spacing));

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      this.applyBrush(this.lastPoint.x + dx * t, this.lastPoint.y + dy * t);
    }

    this.lastPoint = { x: e.x, y: e.y };
  }

  onPointerUp(_e: PointerEvent): void {
    this.isDrawing = false;
    this.lastPoint = null;

    if (this._strokeHistoryId && this.config) {
      const layerId = this.config.getActiveLayerId();
      const size = this.config.getCanvasSize?.() ?? { width: 0, height: 0 };
      const after = this.config.captureLayerRegion?.(layerId, 0, 0, size.width, size.height) ?? null;
      if (after) {
        this.config.commitSnapshot?.(this._strokeHistoryId, after);
      }
      this._strokeHistoryId = null;
    }
  }

  getStrokePoints(): Point[] {
    return [...this.strokePoints];
  }

  reset(): void {
    this.isDrawing = false;
    this.strokePoints = [];
    this.lastPoint = null;
    this._strokeHistoryId = null;
  }

  private applyBrush(cx: number, cy: number): void {
    if (!this.config) return;
    if (this.config.isLayerLocked()) return;
    const layerId = this.config.getActiveLayerId();
    const color = this.config.getColor();
    const size = this.config.getSize();
    const hardness = this.config.getHardness();
    this.config.brushStrokeLayer(layerId, cx, cy, color, size, hardness);
    this.config.requestRender();
  }
}
