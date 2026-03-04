import { BaseTool, type PointerEvent, type Point } from './BaseTool';
import type { TextData } from '../state/layerStore';

export interface TextToolConfig {
  getActiveLayerId: () => string;
  getLayerTextData: (id: string) => TextData | undefined;
  getLayerOffset: (id: string) => { x: number; y: number };
  openTextEditor: (x: number, y: number, layerId: string | null, existing?: TextData) => void;
}

export class TextTool extends BaseTool {
  readonly name = 'text';

  isEditing = false;

  private insertionPoint: Point | null = null;
  private config: TextToolConfig | null;

  constructor(config?: TextToolConfig) {
    super();
    this.config = config ?? null;
  }

  getCursor(): string {
    return 'text';
  }

  onPointerDown(e: PointerEvent): void {
    this.insertionPoint = { x: e.x, y: e.y };
    this.isEditing = true;

    if (this.config) {
      const layerId = this.config.getActiveLayerId();
      const existing = this.config.getLayerTextData(layerId);
      if (existing) {
        // 기존 텍스트 레이어 편집 — 레이어 offset을 더해 캔버스 좌표로 변환
        const offset = this.config.getLayerOffset(layerId);
        this.config.openTextEditor(existing.x + offset.x, existing.y + offset.y, layerId, existing);
      } else {
        // 클릭 위치에 새 텍스트
        this.config.openTextEditor(e.x, e.y, null);
      }
    }
  }

  getInsertionPoint(): Point | null {
    return this.insertionPoint;
  }

  reset(): void {
    this.isEditing = false;
    this.insertionPoint = null;
  }
}
