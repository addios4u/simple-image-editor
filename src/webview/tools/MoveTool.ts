import { BaseTool, type PointerEvent, type Point } from './BaseTool';
import type { SelectionMask } from '../engine/selectionMask';
import type { WasmRegionSnapshot } from '../engine/wasmBridge';
import { extractContour } from '../engine/marchingSquares';

export interface MoveToolConfig {
  // Layer-move
  getActiveLayerId: () => string;
  getLayerOffset: (layerId: string) => { x: number; y: number };
  isLayerLocked: () => boolean;
  setLayerOffset: (layerId: string, x: number, y: number) => void;
  requestRender: () => void;

  // Selection-move (optional — absent = layer-move only)
  getMask?: () => SelectionMask | null;
  getCanvasSize?: () => { width: number; height: number };
  extractMaskedPixels?: (layerId: string, mask: Uint8Array) => Uint8Array | null;
  stampBufferOntoLayer?: (
    layerId: string, srcData: Uint8Array,
    srcWidth: number, srcHeight: number,
    offsetX: number, offsetY: number,
  ) => void;
  setFloatingLayer?: (data: Uint8Array, width: number, height: number) => void;
  setFloatingOffset?: (x: number, y: number) => void;
  clearFloatingLayer?: () => void;
  captureLayerRegion?: (
    layerId: string, x: number, y: number, w: number, h: number,
  ) => WasmRegionSnapshot | null;
  restoreLayerRegion?: (layerId: string, snapshot: WasmRegionSnapshot) => void;
  onContourChange?: (contour: Array<Array<[number, number]>> | null) => void;
}

type MoveMode = 'idle' | 'layer-move' | 'selection-move';

export class MoveTool extends BaseTool {
  readonly name = 'move';
  isDragging = false;

  private mode: MoveMode = 'idle';
  private startPoint: Point | null = null;
  private currentPoint: Point | null = null;
  private baseOffset: { x: number; y: number } = { x: 0, y: 0 };
  private config: MoveToolConfig | undefined;

  // Selection-move state
  private maskSnapshot: Uint8Array | null = null;
  private floatingPixels: Uint8Array | null = null;
  private floatingWidth = 0;
  private floatingHeight = 0;

  constructor(config?: MoveToolConfig) {
    super();
    this.config = config;
  }

  getCursor(): string {
    return 'move';
  }

  onPointerDown(e: PointerEvent): void {
    if (this.config?.isLayerLocked()) return;

    const mask = this.config?.getMask?.() ?? null;
    const hasSelection = mask && !mask.isEmpty() &&
      mask.getPixel(Math.floor(e.x), Math.floor(e.y)) !== 0;

    if (hasSelection && this.config?.extractMaskedPixels) {
      // --- SELECTION-MOVE MODE ---
      this.mode = 'selection-move';
      this.isDragging = true;
      this.startPoint = { x: e.x, y: e.y };
      this.currentPoint = { x: e.x, y: e.y };

      const layerId = this.config.getActiveLayerId();
      const canvasSize = this.config.getCanvasSize?.() ?? { width: 0, height: 0 };

      // Save mask snapshot for translate during drag
      this.maskSnapshot = mask!.snapshot();

      // Capture undo snapshot
      this.config.captureLayerRegion?.(
        layerId, 0, 0, canvasSize.width, canvasSize.height,
      );

      // Extract masked pixels from layer (clears source)
      this.floatingPixels = this.config.extractMaskedPixels(layerId, mask!.getMaskData());
      this.floatingWidth = canvasSize.width;
      this.floatingHeight = canvasSize.height;

      // Set as floating layer in compositor
      if (this.floatingPixels) {
        this.config.setFloatingLayer?.(
          this.floatingPixels, canvasSize.width, canvasSize.height,
        );
      }

      this.config.requestRender();
    } else {
      // --- LAYER-MOVE MODE ---
      this.mode = 'layer-move';
      this.isDragging = true;
      this.startPoint = { x: e.x, y: e.y };
      this.currentPoint = { x: e.x, y: e.y };

      if (this.config) {
        const layerId = this.config.getActiveLayerId();
        this.baseOffset = this.config.getLayerOffset(layerId);
      }
    }
  }

  onPointerMove(e: PointerEvent): void {
    if (!this.isDragging || !this.startPoint) return;
    this.currentPoint = { x: e.x, y: e.y };

    if (this.mode === 'selection-move' && this.config) {
      const dx = Math.round(this.currentPoint.x - this.startPoint.x);
      const dy = Math.round(this.currentPoint.y - this.startPoint.y);

      // Update floating layer offset
      this.config.setFloatingOffset?.(dx, dy);

      // Translate mask for marching ants
      this.translateMaskAndContour(dx, dy);

      this.config.requestRender();
    } else if (this.mode === 'layer-move' && this.config) {
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
    if (!this.isDragging) return;

    if (this.mode === 'selection-move' && this.config && this.floatingPixels) {
      const dx = Math.round((this.currentPoint?.x ?? 0) - (this.startPoint?.x ?? 0));
      const dy = Math.round((this.currentPoint?.y ?? 0) - (this.startPoint?.y ?? 0));
      const layerId = this.config.getActiveLayerId();

      // Clear floating layer from compositor
      this.config.clearFloatingLayer?.();

      // Stamp extracted pixels at new offset
      this.config.stampBufferOntoLayer?.(
        layerId, this.floatingPixels,
        this.floatingWidth, this.floatingHeight,
        dx, dy,
      );

      // Finalize mask position
      this.translateMaskAndContour(dx, dy);

      this.config.requestRender();

      // Cleanup
      this.floatingPixels = null;
      this.maskSnapshot = null;
    }

    this.isDragging = false;
    this.mode = 'idle';
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
    if (this.mode === 'selection-move' && this.config) {
      // Cancel: clear floating layer without stamping
      this.config.clearFloatingLayer?.();

      // Restore mask to original position
      if (this.maskSnapshot) {
        const mask = this.config.getMask?.() ?? null;
        if (mask) {
          mask.restore(this.maskSnapshot);
        }
      }
    }

    this.isDragging = false;
    this.mode = 'idle';
    this.startPoint = null;
    this.currentPoint = null;
    this.baseOffset = { x: 0, y: 0 };
    this.floatingPixels = null;
    this.maskSnapshot = null;
    this.floatingWidth = 0;
    this.floatingHeight = 0;
  }

  private translateMaskAndContour(dx: number, dy: number): void {
    if (!this.config || !this.maskSnapshot) return;

    const mask = this.config.getMask?.() ?? null;
    if (!mask) return;

    mask.restore(this.maskSnapshot);
    mask.translate(dx, dy);

    const contour = mask.isEmpty()
      ? null
      : extractContour(mask.getMaskData(), mask.getWidth(), mask.getHeight());
    this.config.onContourChange?.(contour);
  }
}
