import React, { useCallback, useState } from 'react';
import { useEditorStore } from '../state/editorStore';
import { useLayerStore } from '../state/layerStore';
import { fillRectLayer, requestRender } from '../engine/engineContext';
import { hexToPackedRGBA } from '../engine/helpers';

const PropertyPanel: React.FC = () => {
  const fillColor = useEditorStore((s) => s.fillColor);
  const strokeColor = useEditorStore((s) => s.strokeColor);
  const setFillColor = useEditorStore((s) => s.setFillColor);
  const setStrokeColor = useEditorStore((s) => s.setStrokeColor);
  const [strokeWidth, setStrokeWidth] = useState(1);

  const handleFill = useCallback(() => {
    const { selection, canvasWidth, canvasHeight, fillColor: color } = useEditorStore.getState();
    const { activeLayerId } = useLayerStore.getState();
    const rgba = hexToPackedRGBA(color);
    const rect = selection ?? { x: 0, y: 0, width: canvasWidth, height: canvasHeight };
    fillRectLayer(activeLayerId, rect.x, rect.y, rect.width, rect.height, rgba);
    requestRender();
  }, []);

  return (
    <div className="sidebar-section" data-testid="property-panel">
      <div className="sidebar-section-title">Properties</div>

      <div className="property-group">
        <div className="property-label">Fill</div>
        <div className="property-row">
          <input
            type="color"
            data-testid="fill-color-input"
            className="color-input"
            value={fillColor}
            onInput={(e) =>
              setFillColor((e.target as HTMLInputElement).value)
            }
            aria-label="Fill color"
          />
          <button className="toolbar-btn" aria-label="Fill" onClick={handleFill}>
            Fill <span className="shortcut-hint">(Alt+Backspace)</span>
          </button>
        </div>
      </div>

      <div className="property-group">
        <div className="property-label">Stroke</div>
        <div className="property-row">
          <input
            type="color"
            data-testid="stroke-color-input"
            className="color-input"
            value={strokeColor}
            onInput={(e) =>
              setStrokeColor((e.target as HTMLInputElement).value)
            }
            aria-label="Stroke color"
          />
          <button className="toolbar-btn" aria-label="Stroke">
            Stroke
          </button>
        </div>
        <div className="property-row">
          <label className="property-label" htmlFor="stroke-width">
            Width
          </label>
          <input
            id="stroke-width"
            type="range"
            data-testid="stroke-width-slider"
            className="stroke-width-slider"
            min="1"
            max="50"
            step="1"
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(parseInt(e.target.value, 10))}
            aria-label="Stroke width"
          />
          <span className="stroke-width-value">{strokeWidth}px</span>
        </div>
      </div>
    </div>
  );
};

export default PropertyPanel;
