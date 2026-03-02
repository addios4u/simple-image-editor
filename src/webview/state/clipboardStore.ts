import { create } from 'zustand';

export interface ClipboardRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  layerId: string;
}

interface ClipboardState {
  hasData: boolean;
  region: ClipboardRegion | null;
  // Actions
  copy: (region: ClipboardRegion) => void;
  cut: (region: ClipboardRegion) => void;
  paste: () => ClipboardRegion | null;
  clear: () => void;
}

export const useClipboardStore = create<ClipboardState>((set, get) => ({
  hasData: false,
  region: null,

  copy: (region) => set({ hasData: true, region }),

  cut: (region) => set({ hasData: true, region }),

  paste: () => {
    return get().region;
  },

  clear: () => set({ hasData: false, region: null }),
}));
