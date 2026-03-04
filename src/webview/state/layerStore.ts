import { create } from 'zustand';
import { useHistoryStore } from './historyStore';

export interface TextData {
  text: string;
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  x: number;
  y: number;
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  locked: boolean;
  blendMode: string;
  offsetX: number;
  offsetY: number;
  textData?: TextData;
}

interface LayerState {
  layers: Layer[];
  activeLayerId: string;
  thumbnailVersion: number;
  // Actions
  bumpThumbnailVersion: () => void;
  addLayer: () => void;
  removeLayer: (id: string) => void;
  setLayerVisibility: (id: string, visible: boolean) => void;
  setLayerOpacity: (id: string, opacity: number) => void;
  commitLayerOpacity: (id: string, prevOpacity: number, newOpacity: number) => void;
  setLayerLocked: (id: string, locked: boolean) => void;
  setLayerBlendMode: (id: string, blendMode: string) => void;
  setLayerOffset: (id: string, x: number, y: number) => void;
  setLayerTextData: (id: string, textData: TextData | undefined) => void;
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
  thumbnailVersion: 0,

  bumpThumbnailVersion: () => set((state) => ({ thumbnailVersion: state.thumbnailVersion + 1 })),

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

  setLayerVisibility: (id, visible) => {
    const prev = get().layers.find((l) => l.id === id)?.visible ?? true;
    set((state) => ({
      layers: state.layers.map((l) => l.id === id ? { ...l, visible } : l),
    }));
    useHistoryStore.getState().pushEditWithAction(
      'Layer Visibility',
      () => set((state) => ({ layers: state.layers.map((l) => l.id === id ? { ...l, visible: prev } : l) })),
      () => set((state) => ({ layers: state.layers.map((l) => l.id === id ? { ...l, visible } : l) })),
    );
  },

  setLayerOpacity: (id, opacity) =>
    set((state) => ({
      layers: state.layers.map((l) =>
        l.id === id ? { ...l, opacity: Math.max(0, Math.min(1, opacity)) } : l,
      ),
    })),

  commitLayerOpacity: (id, prevOpacity, newOpacity) => {
    useHistoryStore.getState().pushEditWithAction(
      'Layer Opacity',
      () => set((state) => ({ layers: state.layers.map((l) => l.id === id ? { ...l, opacity: prevOpacity } : l) })),
      () => set((state) => ({ layers: state.layers.map((l) => l.id === id ? { ...l, opacity: newOpacity } : l) })),
    );
  },

  setLayerLocked: (id, locked) =>
    set((state) => ({
      layers: state.layers.map((l) =>
        l.id === id ? { ...l, locked } : l,
      ),
    })),

  setLayerBlendMode: (id, blendMode) => {
    const prev = get().layers.find((l) => l.id === id)?.blendMode ?? 'Normal';
    set((state) => ({
      layers: state.layers.map((l) => l.id === id ? { ...l, blendMode } : l),
    }));
    useHistoryStore.getState().pushEditWithAction(
      'Layer Blend Mode',
      () => set((state) => ({ layers: state.layers.map((l) => l.id === id ? { ...l, blendMode: prev } : l) })),
      () => set((state) => ({ layers: state.layers.map((l) => l.id === id ? { ...l, blendMode } : l) })),
    );
  },

  setLayerOffset: (id, x, y) =>
    set((state) => ({
      layers: state.layers.map((l) =>
        l.id === id ? { ...l, offsetX: x, offsetY: y } : l,
      ),
    })),

  setLayerTextData: (id, textData) =>
    set((state) => ({
      layers: state.layers.map((l) =>
        l.id === id ? { ...l, textData } : l,
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
