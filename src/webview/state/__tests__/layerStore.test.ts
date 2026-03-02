import { describe, it, expect, beforeEach } from 'vitest';
import { useLayerStore } from '../layerStore';

describe('layerStore', () => {
  beforeEach(() => {
    // Reset to initial state before each test
    useLayerStore.setState({
      layers: [{ id: 'layer-1', name: 'Background', visible: true, opacity: 1 }],
      activeLayerId: 'layer-1',
    });
    // Reset the internal counter so IDs are predictable
    useLayerStore.getState()._resetCounter();
  });

  it('has one default layer named Background', () => {
    const state = useLayerStore.getState();
    expect(state.layers).toHaveLength(1);
    expect(state.layers[0].name).toBe('Background');
    expect(state.layers[0].visible).toBe(true);
    expect(state.layers[0].opacity).toBe(1);
    expect(state.activeLayerId).toBe(state.layers[0].id);
  });

  it('addLayer creates new layer with correct properties', () => {
    const { addLayer } = useLayerStore.getState();

    addLayer();

    const state = useLayerStore.getState();
    expect(state.layers).toHaveLength(2);
    const newLayer = state.layers[1];
    expect(newLayer.name).toBe('Layer 2');
    expect(newLayer.visible).toBe(true);
    expect(newLayer.opacity).toBe(1);
    expect(newLayer.id).toBeDefined();
    expect(newLayer.id).not.toBe(state.layers[0].id);
  });

  it('removeLayer removes layer by id', () => {
    const { addLayer } = useLayerStore.getState();
    addLayer();
    const state = useLayerStore.getState();
    const layerToRemove = state.layers[1];

    useLayerStore.getState().removeLayer(layerToRemove.id);

    const updated = useLayerStore.getState();
    expect(updated.layers).toHaveLength(1);
    expect(updated.layers.find((l) => l.id === layerToRemove.id)).toBeUndefined();
  });

  it('removeLayer does not remove last layer', () => {
    const state = useLayerStore.getState();
    const onlyLayerId = state.layers[0].id;

    useLayerStore.getState().removeLayer(onlyLayerId);

    const updated = useLayerStore.getState();
    expect(updated.layers).toHaveLength(1);
    expect(updated.layers[0].id).toBe(onlyLayerId);
  });

  it('setLayerVisibility toggles visibility', () => {
    const state = useLayerStore.getState();
    const layerId = state.layers[0].id;

    useLayerStore.getState().setLayerVisibility(layerId, false);
    expect(useLayerStore.getState().layers[0].visible).toBe(false);

    useLayerStore.getState().setLayerVisibility(layerId, true);
    expect(useLayerStore.getState().layers[0].visible).toBe(true);
  });

  it('setLayerOpacity changes opacity clamped 0-1', () => {
    const state = useLayerStore.getState();
    const layerId = state.layers[0].id;

    useLayerStore.getState().setLayerOpacity(layerId, 0.5);
    expect(useLayerStore.getState().layers[0].opacity).toBe(0.5);

    // Clamp above 1
    useLayerStore.getState().setLayerOpacity(layerId, 1.5);
    expect(useLayerStore.getState().layers[0].opacity).toBe(1);

    // Clamp below 0
    useLayerStore.getState().setLayerOpacity(layerId, -0.5);
    expect(useLayerStore.getState().layers[0].opacity).toBe(0);
  });

  it('setActiveLayer changes active layer id', () => {
    const { addLayer } = useLayerStore.getState();
    addLayer();

    const state = useLayerStore.getState();
    const secondLayerId = state.layers[1].id;

    useLayerStore.getState().setActiveLayer(secondLayerId);
    expect(useLayerStore.getState().activeLayerId).toBe(secondLayerId);
  });

  it('reorderLayers changes layer order', () => {
    const { addLayer } = useLayerStore.getState();
    addLayer();
    addLayer();

    const state = useLayerStore.getState();
    const ids = state.layers.map((l) => l.id);
    const reversed = [...ids].reverse();

    useLayerStore.getState().reorderLayers(reversed);

    const reordered = useLayerStore.getState().layers.map((l) => l.id);
    expect(reordered).toEqual(reversed);
  });

  it('duplicateLayer creates copy with new id and "(copy)" name suffix', () => {
    const state = useLayerStore.getState();
    const originalId = state.layers[0].id;

    useLayerStore.getState().duplicateLayer(originalId);

    const updated = useLayerStore.getState();
    expect(updated.layers).toHaveLength(2);
    const copy = updated.layers[1];
    expect(copy.name).toBe('Background (copy)');
    expect(copy.id).not.toBe(originalId);
    expect(copy.visible).toBe(state.layers[0].visible);
    expect(copy.opacity).toBe(state.layers[0].opacity);
  });

  it('renameLayer changes layer name', () => {
    const state = useLayerStore.getState();
    const layerId = state.layers[0].id;

    useLayerStore.getState().renameLayer(layerId, 'My Layer');
    expect(useLayerStore.getState().layers[0].name).toBe('My Layer');
  });

  it('layer ids are unique', () => {
    const { addLayer } = useLayerStore.getState();
    addLayer();
    addLayer();
    addLayer();

    const ids = useLayerStore.getState().layers.map((l) => l.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('removeLayer sets activeLayerId to first layer when active layer is removed', () => {
    const { addLayer } = useLayerStore.getState();
    addLayer();

    const state = useLayerStore.getState();
    const secondLayerId = state.layers[1].id;
    useLayerStore.getState().setActiveLayer(secondLayerId);

    useLayerStore.getState().removeLayer(secondLayerId);

    const updated = useLayerStore.getState();
    expect(updated.activeLayerId).toBe(updated.layers[0].id);
  });
});
