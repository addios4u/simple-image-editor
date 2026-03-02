import { create } from 'zustand';

export type ExportFormat = 'png' | 'jpeg' | 'gif';

interface ExportState {
  format: ExportFormat | null;
  quality: number; // JPEG quality 1-100
  isExporting: boolean;
  // Actions
  setFormat: (format: ExportFormat) => void;
  setQuality: (quality: number) => void;
  setExporting: (exporting: boolean) => void;
  reset: () => void;
  getExportConfig: () => { format: ExportFormat | null; quality: number };
}

const initialState = {
  format: null as ExportFormat | null,
  quality: 85,
  isExporting: false,
};

export const useExportStore = create<ExportState>((set, get) => ({
  ...initialState,

  setFormat: (format) => set({ format }),

  setQuality: (quality) => set({ quality: Math.max(1, Math.min(100, quality)) }),

  setExporting: (exporting) => set({ isExporting: exporting }),

  reset: () => set({ ...initialState }),

  getExportConfig: () => {
    const { format, quality } = get();
    return { format, quality };
  },
}));
