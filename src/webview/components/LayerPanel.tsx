import React from 'react';
import { Eye, EyeOff, Plus, Minus } from 'lucide-react';
import { useLayerStore } from '../state/layerStore';

const LayerPanel: React.FC = () => {
  const layers = useLayerStore((s) => s.layers);
  const activeLayerId = useLayerStore((s) => s.activeLayerId);
  const addLayer = useLayerStore((s) => s.addLayer);
  const removeLayer = useLayerStore((s) => s.removeLayer);
  const setActiveLayer = useLayerStore((s) => s.setActiveLayer);
  const setLayerVisibility = useLayerStore((s) => s.setLayerVisibility);
  const setLayerOpacity = useLayerStore((s) => s.setLayerOpacity);

  return (
    <div className="sidebar-section" data-testid="layer-panel">
      <div className="sidebar-section-title">Layers</div>
      <div className="layer-list">
        {layers.map((layer) => (
          <div
            key={layer.id}
            className={`layer-item${layer.id === activeLayerId ? ' active' : ''}`}
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
              {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
            <span className="layer-name">{layer.name}</span>
            <input
              type="range"
              className="layer-opacity-slider"
              data-testid={`opacity-slider-${layer.id}`}
              min="0"
              max="1"
              step="0.01"
              value={layer.opacity}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) =>
                setLayerOpacity(layer.id, parseFloat(e.target.value))
              }
              aria-label={`Opacity for ${layer.name}`}
            />
          </div>
        ))}
      </div>
      <div className="layer-actions">
        <button
          className="toolbar-btn"
          onClick={addLayer}
          aria-label="Add Layer"
        >
          <Plus size={16} />
        </button>
        <button
          className="toolbar-btn"
          onClick={() => removeLayer(activeLayerId)}
          aria-label="Delete Layer"
        >
          <Minus size={16} />
        </button>
      </div>
    </div>
  );
};

export default LayerPanel;
