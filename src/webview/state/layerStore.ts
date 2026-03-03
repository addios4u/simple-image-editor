import { create } from 'zustand';

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  locked: boolean;
  blendMode: string;
  offsetX: number;
  offsetY: number;
}

interface LayerState {
  layers: Layer[];
  activeLayerId: string;
  // Actions
  addLayer: () => void;
  removeLayer: (id: string) => void;
  setLayerVisibility: (id: string, visible: boolean) => void;
  setLayerOpacity: (id: string, opacity: number) => void;
  setLayerLocked: (id: string, locked: boolean) => void;
  setLayerBlendMode: (id: string, blendMode: string) => void;
  setLayerOffset: (id: string, x: number, y: number) => void;
  setActiveLayer: (id: string) => void;
  reorderLayers: (layerIds: string[]) => void;
  duplicateLayer: (id: string) => void;
  renameLayer: (id: string, name: string) => void;
  /** Bulk-set layers (e.g. from ORA load). Updates the internal ID counter. */
  setLayers: (layers: Layer[]) => void;
  /** Reset the internal ID counter. For test isolation only. */
  _resetCounter: () => void;
}

let nextId = 2;

export const useLayerStore = create<LayerState>((set, get) => ({
  layers: [{ id: 'layer-1', name: 'Background', visible: true, opacity: 1, locked: false, blendMode: 'Normal', offsetX: 0, offsetY: 0 }],
  activeLayerId: 'layer-1',

  addLayer: () =>
    set((state) => {
      const id = `layer-${nextId++}`;
      const name = `Layer ${nextId - 1}`;
      const newLayer: Layer = { id, name, visible: true, opacity: 1, locked: false, blendMode: 'Normal', offsetX: 0, offsetY: 0 };
      return { layers: [...state.layers, newLayer] };
    }),

  removeLayer: (id) =>
    set((state) => {
      if (state.layers.length <= 1) return state;
      const layers = state.layers.filter((l) => l.id !== id);
      const activeLayerId =
        state.activeLayerId === id ? layers[0].id : state.activeLayerId;
      return { layers, activeLayerId };
    }),

  setLayerVisibility: (id, visible) =>
    set((state) => ({
      layers: state.layers.map((l) =>
        l.id === id ? { ...l, visible } : l,
      ),
    })),

  setLayerOpacity: (id, opacity) =>
    set((state) => ({
      layers: state.layers.map((l) =>
        l.id === id ? { ...l, opacity: Math.max(0, Math.min(1, opacity)) } : l,
      ),
    })),

  setLayerLocked: (id, locked) =>
    set((state) => ({
      layers: state.layers.map((l) =>
        l.id === id ? { ...l, locked } : l,
      ),
    })),

  setLayerBlendMode: (id, blendMode) =>
    set((state) => ({
      layers: state.layers.map((l) =>
        l.id === id ? { ...l, blendMode } : l,
      ),
    })),

  setLayerOffset: (id, x, y) =>
    set((state) => ({
      layers: state.layers.map((l) =>
        l.id === id ? { ...l, offsetX: x, offsetY: y } : l,
      ),
    })),

  setActiveLayer: (id) => set({ activeLayerId: id }),

  reorderLayers: (layerIds) =>
    set((state) => {
      const layerMap = new Map(state.layers.map((l) => [l.id, l]));
      const reordered = layerIds
        .map((id) => layerMap.get(id))
        .filter((l): l is Layer => l !== undefined);
      return { layers: reordered };
    }),

  duplicateLayer: (id) =>
    set((state) => {
      const source = state.layers.find((l) => l.id === id);
      if (!source) return state;
      const newId = `layer-${nextId++}`;
      const copy: Layer = {
        ...source,
        id: newId,
        name: `${source.name} (copy)`,
      };
      const index = state.layers.findIndex((l) => l.id === id);
      const layers = [...state.layers];
      layers.splice(index + 1, 0, copy);
      return { layers };
    }),

  renameLayer: (id, name) =>
    set((state) => ({
      layers: state.layers.map((l) =>
        l.id === id ? { ...l, name } : l,
      ),
    })),

  setLayers: (newLayers) => {
    const maxNum = newLayers.reduce((max, l) => {
      const n = parseInt(l.id.replace('layer-', ''), 10);
      return isNaN(n) ? max : Math.max(max, n);
    }, 1);
    nextId = maxNum + 1;
    set({ layers: newLayers, activeLayerId: newLayers[0]?.id ?? 'layer-1' });
  },

  _resetCounter: () => {
    nextId = 2;
  },
}));
