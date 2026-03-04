import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Eye, EyeOff, Plus, Trash2, Lock, LockOpen, Type } from 'lucide-react';
import { useLayerStore } from '../state/layerStore';
import { useEditorStore } from '../state/editorStore';
import { getLayerImageData, setLayerOpacity as engineSetOpacity, setLayerVisible as engineSetVisible, setLayerBlendMode as engineSetBlendMode, addLayer as engineAddLayer, removeLayer as engineRemoveLayer, moveLayer as engineMoveLayer, rebuildLayerIndexMap, requestRender } from '../engine/engineContext';

const BLEND_MODES = [
  'Normal', 'Multiply', 'Screen', 'Overlay',
  'Darken', 'Lighten', 'ColorDodge', 'ColorBurn',
  'SoftLight', 'HardLight', 'Difference', 'Exclusion',
] as const;

const BLEND_MODE_MAP: Record<string, number> = {};
BLEND_MODES.forEach((mode, i) => { BLEND_MODE_MAP[mode] = i; });

const THUMB_SIZE = 40;

const LayerThumbnail: React.FC<{ layerId: string }> = ({ layerId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const thumbnailVersion = useLayerStore((s) => s.thumbnailVersion);

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
  }, [layerId, thumbnailVersion]);

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
  const commitLayerOpacity = useLayerStore((s) => s.commitLayerOpacity);
  const setLayerLocked = useLayerStore((s) => s.setLayerLocked);
  const setLayerBlendMode = useLayerStore((s) => s.setLayerBlendMode);
  const reorderLayers = useLayerStore((s) => s.reorderLayers);

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [showOpacitySlider, setShowOpacitySlider] = useState(false);
  const opacityRowRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const opacityBeforeEdit = useRef<number | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent, layerId: string) => {
    // Only left button
    if (e.button !== 0) return;
    // Ignore clicks on interactive elements (buttons, inputs) inside
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input')) return;
    dragStartY.current = e.clientY;
    setDraggedId(layerId);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggedId) return;
    // Only start visual drag after 4px movement
    if (Math.abs(e.clientY - dragStartY.current) < 4) return;

    // Find which layer-item we're hovering over
    const listEl = (e.currentTarget as HTMLElement).closest('.layer-list');
    if (!listEl) return;
    const items = listEl.querySelectorAll<HTMLElement>('.layer-item');
    let targetId: string | null = null;
    for (const item of items) {
      const rect = item.getBoundingClientRect();
      if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
        const testId = item.getAttribute('data-testid') ?? '';
        const id = testId.replace('layer-item-', '');
        if (id && id !== draggedId) {
          targetId = id;
        }
        break;
      }
    }
    setDropTargetId(targetId);
  }, [draggedId]);

  const handlePointerUp = useCallback(() => {
    if (draggedId && dropTargetId && draggedId !== dropTargetId) {
      // Compute new order in store's internal (bottom-to-top) order
      const currentIds = useLayerStore.getState().layers.map((l) => l.id);
      const fromIndex = currentIds.indexOf(draggedId);
      const toIndex = currentIds.indexOf(dropTargetId);
      if (fromIndex !== -1 && toIndex !== -1) {
        // Move in WASM first (uses current layerIndexMap)
        engineMoveLayer(draggedId, dropTargetId);

        // Reorder in store
        const newIds = [...currentIds];
        newIds.splice(fromIndex, 1);
        newIds.splice(toIndex, 0, draggedId);
        reorderLayers(newIds);

        // Rebuild engine index map to match new order
        rebuildLayerIndexMap(newIds);
        requestRender();
      }
    }
    setDraggedId(null);
    setDropTargetId(null);
  }, [draggedId, dropTargetId, reorderLayers]);

  const setActiveTool = useEditorStore((s) => s.setActiveTool);
  const setRequestTextEditLayerId = useEditorStore((s) => s.setRequestTextEditLayerId);

  const handleLayerDoubleClick = useCallback((layerId: string) => {
    const layer = useLayerStore.getState().layers.find((l) => l.id === layerId);
    if (!layer?.textData) return;
    setActiveTool('text');
    setActiveLayer(layerId);
    setRequestTextEditLayerId(layerId);
  }, [setActiveTool, setActiveLayer, setRequestTextEditLayerId]);

  const activeLayer = layers.find((l) => l.id === activeLayerId);
  const activeOpacity = activeLayer ? Math.round(activeLayer.opacity * 100) : 100;
  const activeBlendMode = activeLayer?.blendMode ?? 'Normal';

  // Close opacity slider on click outside
  useEffect(() => {
    if (!showOpacitySlider) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (opacityRowRef.current && !opacityRowRef.current.contains(e.target as Node)) {
        setShowOpacitySlider(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showOpacitySlider]);

  const handleOpacityChange = useCallback((value: number) => {
    if (!activeLayer) return;
    const v = Math.max(0, Math.min(100, value));
    setLayerOpacity(activeLayer.id, v / 100);
    engineSetOpacity(activeLayer.id, v / 100);
    requestRender();
  }, [activeLayer, setLayerOpacity]);

  const handleOpacityCommit = useCallback(() => {
    if (!activeLayer || opacityBeforeEdit.current === null) return;
    const prev = opacityBeforeEdit.current;
    const next = activeLayer.opacity;
    if (prev !== next) {
      commitLayerOpacity(activeLayer.id, prev, next);
    }
    opacityBeforeEdit.current = null;
  }, [activeLayer, commitLayerOpacity]);

  return (
    <div className="layer-panel" data-testid="layer-panel">
      {/* Layer Controls */}
      <div className="layer-controls">
        <div className="layer-controls-row">
          <select
            className="layer-blend-select"
            value={activeBlendMode}
            data-testid="layer-blend-select"
            onChange={(e) => {
              if (!activeLayer) return;
              setLayerBlendMode(activeLayer.id, e.target.value);
              engineSetBlendMode(activeLayer.id, BLEND_MODE_MAP[e.target.value] ?? 0);
              requestRender();
            }}
          >
            {BLEND_MODES.map((mode) => (
              <option key={mode} value={mode}>{mode}</option>
            ))}
          </select>
          <span className="layer-controls-label">Opacity:</span>
          <div className="layer-opacity-wrapper" ref={opacityRowRef}>
            <input
              className="layer-opacity-input"
              type="number"
              min={0}
              max={100}
              value={activeOpacity}
              data-testid="layer-opacity-input"
              onFocus={() => {
                setShowOpacitySlider(true);
                if (activeLayer && opacityBeforeEdit.current === null) {
                  opacityBeforeEdit.current = activeLayer.opacity;
                }
              }}
              onChange={(e) => handleOpacityChange(parseInt(e.target.value) || 0)}
              onBlur={handleOpacityCommit}
            />
            <span className="layer-controls-unit">%</span>
            {showOpacitySlider && (
              <div className="opacity-slider-popup">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={activeOpacity}
                  data-testid="layer-opacity-slider"
                  onPointerDown={() => {
                    if (activeLayer && opacityBeforeEdit.current === null) {
                      opacityBeforeEdit.current = activeLayer.opacity;
                    }
                  }}
                  onChange={(e) => handleOpacityChange(parseInt(e.target.value))}
                  onPointerUp={handleOpacityCommit}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="layer-divider" />

      {/* Layer List */}
      <div className="layer-list" data-testid="layer-list">
        {[...layers].reverse().map((layer) => {
          const isActive = layer.id === activeLayerId;
          const isDragged = layer.id === draggedId;
          const isDropTarget = layer.id === dropTargetId;
          return (
            <div
              key={layer.id}
              className={`layer-item${isActive ? ' active' : ''}${isDragged ? ' dragging' : ''}${isDropTarget ? ' drop-target' : ''}`}
              data-testid={`layer-item-${layer.id}`}
              onClick={() => setActiveLayer(layer.id)}
              onDoubleClick={() => handleLayerDoubleClick(layer.id)}
              onPointerDown={(e) => handlePointerDown(e, layer.id)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
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
                  {layer.textData && <Type size={10} style={{ marginRight: 4, opacity: 0.7, verticalAlign: 'middle' }} />}
                  {layer.name}
                </span>
                <span className="layer-meta">
                  {layer.blendMode}, {Math.round(layer.opacity * 100)}%
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
                    engineRemoveLayer(layer.id);
                    removeLayer(layer.id);
                    requestRender();
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
          onClick={() => {
            addLayer();
            // Sync: the store's addLayer just created a new layer — read it back
            const newLayers = useLayerStore.getState().layers;
            const newLayer = newLayers[newLayers.length - 1];
            engineAddLayer(newLayer.id);
          }}
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
