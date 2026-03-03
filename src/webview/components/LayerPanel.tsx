import React, { useRef, useEffect } from 'react';
import { Eye, EyeOff, Plus, Trash2, Lock, LockOpen } from 'lucide-react';
import { useLayerStore } from '../state/layerStore';
import { getLayerImageData, setLayerOpacity as engineSetOpacity, setLayerVisible as engineSetVisible, requestRender } from '../engine/engineContext';

const THUMB_SIZE = 40;

const LayerThumbnail: React.FC<{ layerId: string }> = ({ layerId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgData = getLayerImageData(layerId);
    if (!imgData) {
      // Draw checkerboard fallback
      ctx.clearRect(0, 0, THUMB_SIZE, THUMB_SIZE);
      const size = 5;
      for (let y = 0; y < THUMB_SIZE; y += size) {
        for (let x = 0; x < THUMB_SIZE; x += size) {
          ctx.fillStyle = (Math.floor(x / size) + Math.floor(y / size)) % 2 === 0 ? '#555' : '#333';
          ctx.fillRect(x, y, size, size);
        }
      }
      return;
    }

    // Draw the full image scaled to thumbnail
    const offscreen = document.createElement('canvas');
    offscreen.width = imgData.width;
    offscreen.height = imgData.height;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;
    offCtx.putImageData(imgData, 0, 0);

    // Draw checkerboard background (for transparency)
    const size = 5;
    for (let y = 0; y < THUMB_SIZE; y += size) {
      for (let x = 0; x < THUMB_SIZE; x += size) {
        ctx.fillStyle = (Math.floor(x / size) + Math.floor(y / size)) % 2 === 0 ? '#555' : '#333';
        ctx.fillRect(x, y, size, size);
      }
    }

    // Draw scaled layer on top
    ctx.drawImage(offscreen, 0, 0, THUMB_SIZE, THUMB_SIZE);
  }, [layerId]);

  return (
    <canvas
      ref={canvasRef}
      className="layer-thumb-canvas"
      width={THUMB_SIZE}
      height={THUMB_SIZE}
    />
  );
};

const LayerPanel: React.FC = () => {
  const layers = useLayerStore((s) => s.layers);
  const activeLayerId = useLayerStore((s) => s.activeLayerId);
  const addLayer = useLayerStore((s) => s.addLayer);
  const removeLayer = useLayerStore((s) => s.removeLayer);
  const setActiveLayer = useLayerStore((s) => s.setActiveLayer);
  const setLayerVisibility = useLayerStore((s) => s.setLayerVisibility);
  const setLayerOpacity = useLayerStore((s) => s.setLayerOpacity);
  const setLayerLocked = useLayerStore((s) => s.setLayerLocked);

  const activeLayer = layers.find((l) => l.id === activeLayerId);
  const activeOpacity = activeLayer ? Math.round(activeLayer.opacity * 100) : 100;

  return (
    <div className="layer-panel" data-testid="layer-panel">
      {/* Layer Controls */}
      <div className="layer-controls">
        <div className="layer-controls-row">
          <div className="layer-blend-select">
            <span className="layer-blend-value">Normal</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </div>
          <span className="layer-controls-label">Opacity:</span>
          <input
            className="layer-opacity-input"
            type="number"
            min={0}
            max={100}
            value={activeOpacity}
            data-testid="layer-opacity-input"
            onChange={(e) => {
              if (!activeLayer) return;
              const v = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
              setLayerOpacity(activeLayer.id, v / 100);
              engineSetOpacity(activeLayer.id, v / 100);
              requestRender();
            }}
          />
          <span className="layer-controls-unit">%</span>
        </div>
      </div>

      <div className="layer-divider" />

      {/* Layer List */}
      <div className="layer-list" data-testid="layer-list">
        {[...layers].reverse().map((layer) => {
          const isActive = layer.id === activeLayerId;
          return (
            <div
              key={layer.id}
              className={`layer-item${isActive ? ' active' : ''}`}
              data-testid={`layer-item-${layer.id}`}
              onClick={() => setActiveLayer(layer.id)}
            >
              <button
                className="layer-visibility-btn"
                data-testid={`visibility-toggle-${layer.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setLayerVisibility(layer.id, !layer.visible);
                  engineSetVisible(layer.id, !layer.visible);
                  requestRender();
                }}
                aria-label={layer.visible ? 'Hide layer' : 'Show layer'}
              >
                {layer.visible
                  ? <Eye size={14} color={isActive ? '#ffffff' : '#969696'} />
                  : <EyeOff size={14} color="#969696" />}
              </button>
              <LayerThumbnail layerId={layer.id} />
              <div className="layer-info">
                <span className={`layer-name${isActive ? ' active' : ''}`}>
                  {layer.name}
                </span>
                <span className="layer-meta">
                  Normal, {Math.round(layer.opacity * 100)}%
                </span>
              </div>
              <div className="layer-item-actions">
                <button
                  className="layer-lock-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLayerLocked(layer.id, !layer.locked);
                  }}
                  aria-label={layer.locked ? 'Unlock layer' : 'Lock layer'}
                >
                  {layer.locked
                    ? <Lock size={12} color="#969696" />
                    : <LockOpen size={12} color="#969696" />}
                </button>
                <button
                  className="layer-delete-btn"
                  data-testid={`delete-layer-${layer.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeLayer(layer.id);
                  }}
                  disabled={layers.length <= 1}
                  aria-label={`Delete ${layer.name}`}
                >
                  <Trash2 size={14} color="#969696" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="layer-divider" />

      {/* Layer Actions */}
      <div className="layer-actions">
        <button
          className="layer-add-btn"
          onClick={addLayer}
          aria-label="Add Layer"
        >
          <Plus size={14} />
          <span>레이어 추가</span>
        </button>
      </div>
    </div>
  );
};

export default LayerPanel;
