import React from 'react';
import { Eye, EyeOff, Plus, Trash2, Lock, LockOpen, LockKeyhole, Move } from 'lucide-react';
import { useLayerStore } from '../state/layerStore';

const LayerPanel: React.FC = () => {
  const layers = useLayerStore((s) => s.layers);
  const activeLayerId = useLayerStore((s) => s.activeLayerId);
  const addLayer = useLayerStore((s) => s.addLayer);
  const removeLayer = useLayerStore((s) => s.removeLayer);
  const setActiveLayer = useLayerStore((s) => s.setActiveLayer);
  const setLayerVisibility = useLayerStore((s) => s.setLayerVisibility);
  const setLayerOpacity = useLayerStore((s) => s.setLayerOpacity);

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
            }}
          />
          <span className="layer-controls-unit">%</span>
        </div>
        <div className="layer-controls-row">
          <Lock size={12} className="layer-controls-icon" />
          <LockKeyhole size={12} className="layer-controls-icon" />
          <Move size={12} className="layer-controls-icon" />
          <span className="layer-controls-spacer" />
          <span className="layer-controls-label">Fill:</span>
          <span className="layer-controls-value">100%</span>
        </div>
      </div>

      <div className="layer-divider" />

      {/* Layer List */}
      <div className="layer-list" data-testid="layer-list">
        {[...layers].reverse().map((layer) => {
          const isActive = layer.id === activeLayerId;
          const isBackground = layer.id === layers[0]?.id;
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
                }}
                aria-label={layer.visible ? 'Hide layer' : 'Show layer'}
              >
                {layer.visible
                  ? <Eye size={14} color={isActive ? '#ffffff' : '#969696'} />
                  : <EyeOff size={14} color="#969696" />}
              </button>
              <div className="layer-thumb" />
              <div className="layer-info">
                <span className={`layer-name${isActive ? ' active' : ''}`}>
                  {layer.name}
                </span>
                <span className="layer-meta">
                  Normal, {Math.round(layer.opacity * 100)}%
                </span>
              </div>
              <div className="layer-item-actions">
                {isBackground
                  ? <Lock size={12} color="#969696" />
                  : <LockOpen size={12} color="#969696" />}
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
                  <Trash2 size={14} color={isBackground && layers.length > 1 ? '#555555' : '#969696'} />
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
