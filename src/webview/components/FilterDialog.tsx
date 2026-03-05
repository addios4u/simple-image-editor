import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useEditorStore } from '../state/editorStore';
import { useLayerStore } from '../state/layerStore';
import { useHistoryStore } from '../state/historyStore';
import {
  captureLayerRegion,
  requestRender,
  gaussianBlurLayer,
  motionBlurLayer,
  gaussianBlurLayerRegion,
  motionBlurLayerRegion,
  applyFilterPreview,
  getLayerImageData,
} from '../engine/engineContext';
import { t } from '../i18n';

export type FilterType = 'gaussian' | 'motion';

interface FilterDialogProps {
  filterType: FilterType;
  onClose: () => void;
}

const PREVIEW_MAX = 160;

function getFilterLabel(type: FilterType): string {
  return type === 'gaussian' ? t('Gaussian Blur') : t('Motion Blur');
}

const FilterDialog: React.FC<FilterDialogProps> = ({ filterType, onClose }) => {
  const selection = useEditorStore((s) => s.selection);
  const canvasWidth = useEditorStore((s) => s.canvasWidth);
  const canvasHeight = useEditorStore((s) => s.canvasHeight);
  const activeLayerId = useLayerStore((s) => s.activeLayerId);
  const layers = useLayerStore((s) => s.layers);
  const activeLayer = layers.find((l) => l.id === activeLayerId);
  const layerOffsetX = activeLayer?.offsetX ?? 0;
  const layerOffsetY = activeLayer?.offsetY ?? 0;

  const [sigma, setSigma] = useState(3.0);
  const [angle, setAngle] = useState(0);
  const [distance, setDistance] = useState(10);

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const thumbnailRef = useRef<ImageData | null>(null);
  const previewDimsRef = useRef({ w: PREVIEW_MAX, h: PREVIEW_MAX });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 썸네일 초기화
  useEffect(() => {
    if (!activeLayerId) return;
    const srcData = getLayerImageData(activeLayerId);
    if (!srcData) return;

    const sw = srcData.width;
    const sh = srcData.height;
    const scale = Math.min(PREVIEW_MAX / sw, PREVIEW_MAX / sh, 1);
    const dstW = Math.max(1, Math.round(sw * scale));
    const dstH = Math.max(1, Math.round(sh * scale));
    previewDimsRef.current = { w: dstW, h: dstH };

    const srcCanvas = new OffscreenCanvas(sw, sh);
    const srcCtx = srcCanvas.getContext('2d')!;
    srcCtx.putImageData(srcData, 0, 0);

    const dstCanvas = new OffscreenCanvas(dstW, dstH);
    const dstCtx = dstCanvas.getContext('2d')!;
    dstCtx.drawImage(srcCanvas, 0, 0, dstW, dstH);
    thumbnailRef.current = dstCtx.getImageData(0, 0, dstW, dstH);
  }, [activeLayerId]);

  // 미리보기 렌더링
  const renderPreview = useCallback(() => {
    const thumb = thumbnailRef.current;
    const canvas = previewCanvasRef.current;
    if (!thumb || !canvas) return;

    const { w, h } = previewDimsRef.current;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let params: { sigma?: number; angle?: number; distance?: number };
    if (filterType === 'gaussian') {
      params = { sigma };
    } else {
      params = { angle, distance };
    }

    const result = applyFilterPreview(thumb.data, w, h, filterType, params);
    if (result) {
      ctx.putImageData(result, 0, 0);
    } else {
      // WASM 미준비 시 원본 표시
      ctx.putImageData(thumb, 0, 0);
    }
  }, [filterType, sigma, angle, distance]);

  // 파라미터 변경 시 디바운스 미리보기
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(renderPreview, 120);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [renderPreview]);

  const handleApply = useCallback(() => {
    if (!activeLayerId) return;

    const region = { x: 0, y: 0, w: canvasWidth, h: canvasHeight };
    const beforeSnapshot = captureLayerRegion(activeLayerId, 0, 0, canvasWidth, canvasHeight);

    if (filterType === 'gaussian') {
      if (selection) {
        // 캔버스 좌표 → 레이어-로컬 좌표 변환 (레이어 오프셋 보정)
        const lx = Math.max(0, selection.x - layerOffsetX);
        const ly = Math.max(0, selection.y - layerOffsetY);
        const lw = Math.min(selection.width, canvasWidth - lx);
        const lh = Math.min(selection.height, canvasHeight - ly);
        if (lw > 0 && lh > 0) gaussianBlurLayerRegion(activeLayerId, sigma, lx, ly, lw, lh);
      } else {
        gaussianBlurLayer(activeLayerId, sigma);
      }
    } else {
      if (selection) {
        const lx = Math.max(0, selection.x - layerOffsetX);
        const ly = Math.max(0, selection.y - layerOffsetY);
        const lw = Math.min(selection.width, canvasWidth - lx);
        const lh = Math.min(selection.height, canvasHeight - ly);
        if (lw > 0 && lh > 0) motionBlurLayerRegion(activeLayerId, angle, distance, lx, ly, lw, lh);
      } else {
        motionBlurLayer(activeLayerId, angle, distance);
      }
    }

    if (beforeSnapshot) {
      const { pushEditWithSnapshot, commitSnapshot } = useHistoryStore.getState();
      const label = selection
        ? `${getFilterLabel(filterType)} (${t('selection')})`
        : getFilterLabel(filterType);
      const entryId = pushEditWithSnapshot(label, activeLayerId, beforeSnapshot, region);
      const afterSnapshot = captureLayerRegion(activeLayerId, 0, 0, canvasWidth, canvasHeight);
      if (afterSnapshot) commitSnapshot(entryId, afterSnapshot);
    }

    requestRender();
    onClose();
  }, [activeLayerId, filterType, sigma, angle, distance, selection, canvasWidth, canvasHeight, layerOffsetX, layerOffsetY, onClose]);

  const { w: pvW, h: pvH } = previewDimsRef.current;

  const dialog = (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={containerStyle}>
        {/* 헤더 */}
        <div style={{ fontWeight: 600, fontSize: 13, color: '#eee', marginBottom: 12 }}>
          {getFilterLabel(filterType)}
        </div>

        {/* 바디: 미리보기 + 파라미터 */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {/* 미리보기 캔버스 */}
          <div style={previewWrapStyle}>
            <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>{t('Preview')}</div>
            <div style={{
              width: PREVIEW_MAX, height: PREVIEW_MAX,
              background: '#111',
              border: '1px solid #444',
              borderRadius: 3,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
            }}>
              <canvas
                ref={previewCanvasRef}
                width={pvW}
                height={pvH}
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
          </div>

          {/* 파라미터 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filterType === 'gaussian' && (
              <SliderRow
                label={t('Strength (Sigma)')}
                value={sigma}
                min={0.1} max={20} step={0.1}
                display={sigma.toFixed(1)}
                onChange={setSigma}
              />
            )}
            {filterType === 'motion' && (
              <>
                <SliderRow
                  label={t('Direction (Angle)')}
                  value={angle}
                  min={0} max={359} step={1}
                  display={`${angle}°`}
                  onChange={setAngle}
                />
                <SliderRow
                  label={t('Distance')}
                  value={distance}
                  min={1} max={100} step={1}
                  display={`${distance}px`}
                  onChange={setDistance}
                />
              </>
            )}

            {/* 적용 범위 표시 */}
            <div style={{
              fontSize: 11, color: selection ? '#7eb8f7' : '#888',
              padding: '5px 8px',
              background: '#1e1e1e',
              borderRadius: 3,
              border: `1px solid ${selection ? '#3a6ea8' : '#333'}`,
            }}>
              {selection
                ? t('Apply to selection ({0}×{1}px)', String(selection.width), String(selection.height))
                : t('Apply to entire layer')}
            </div>
          </div>
        </div>

        {/* 버튼 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={btnStyle('#3c3c3c')}>{t('Cancel')}</button>
          <button onClick={handleApply} style={btnStyle('#0066cc')}>{t('Apply')}</button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(dialog, document.body);
};

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}

const SliderRow: React.FC<SliderRowProps> = ({ label, value, min, max, step, display, onChange }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#aaa' }}>
      <span>{label}</span>
      <span style={{ color: '#eee', fontVariantNumeric: 'tabular-nums', minWidth: 44, textAlign: 'right' }}>
        {display}
      </span>
    </div>
    <input
      type="range"
      min={min} max={max} step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ width: '100%', accentColor: '#007acc' }}
    />
  </div>
);

const containerStyle: React.CSSProperties = {
  background: '#2d2d2d',
  border: '1px solid #555',
  borderRadius: 6,
  padding: '16px 20px',
  minWidth: 380,
  maxWidth: 500,
  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
  color: '#ccc',
  fontSize: 12,
  fontFamily: 'inherit',
};

const previewWrapStyle: React.CSSProperties = {
  flexShrink: 0,
};

function btnStyle(bg: string): React.CSSProperties {
  return {
    padding: '5px 16px',
    background: bg,
    border: 'none',
    borderRadius: 4,
    color: '#eee',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
  };
}

export default FilterDialog;
