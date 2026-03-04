import { create } from 'zustand';

export type EditorMode = 'viewer' | 'editor';
export type ToolType = 'move' | 'select' | 'brush' | 'text';
export type SidebarTab = 'layers' | 'history' | 'ai';
export type SelectionShape = 'rectangle' | 'ellipse';

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface EditorState {
  mode: EditorMode;
  activeTool: ToolType;
  zoom: number;
  panX: number;
  panY: number;
  fillColor: string;
  strokeColor: string;
  canvasWidth: number;
  canvasHeight: number;
  activeTab: SidebarTab;
  imageData: Uint8Array | null;
  fileName: string;
  strokeWidth: number;
  selection: SelectionRect | null;
  selectionShape: SelectionShape;
  selectionVersion: number;
  fontFamily: string;
  fontSize: number;
  fontBold: boolean;
  fontItalic: boolean;
  requestTextEditLayerId: string | null;
  isDirty: boolean;
  isOra: boolean;
  // Actions
  setMode: (mode: EditorMode) => void;
  setActiveTool: (tool: ToolType) => void;
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  setFillColor: (color: string) => void;
  setStrokeColor: (color: string) => void;
  setCanvasSize: (w: number, h: number) => void;
  setActiveTab: (tab: SidebarTab) => void;
  setImageData: (data: Uint8Array, fileName: string) => void;
  setStrokeWidth: (width: number) => void;
  setSelection: (sel: SelectionRect | null) => void;
  bumpSelectionVersion: () => void;
  toggleSelectionShape: () => void;
  setFontFamily: (f: string) => void;
  setFontSize: (s: number) => void;
  setFontBold: (b: boolean) => void;
  setFontItalic: (i: boolean) => void;
  setRequestTextEditLayerId: (id: string | null) => void;
  setDirty: (dirty: boolean) => void;
  setIsOra: (isOra: boolean) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  mode: 'viewer',
  activeTool: 'select',
  zoom: 1,
  panX: 0,
  panY: 0,
  fillColor: '#000000',
  strokeColor: '#000000',
  canvasWidth: 800,
  canvasHeight: 600,
  activeTab: 'layers',
  imageData: null,
  fileName: '',
  strokeWidth: 5,
  selection: null,
  selectionShape: 'rectangle',
  selectionVersion: 0,
  fontFamily: 'sans-serif',
  fontSize: 24,
  fontBold: false,
  fontItalic: false,
  requestTextEditLayerId: null,
  isDirty: false,
  isOra: false,
  setMode: (mode) => set({ mode }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setZoom: (zoom) => set({ zoom }),
  setPan: (x, y) => set({ panX: x, panY: y }),
  setFillColor: (color) => set({ fillColor: color }),
  setStrokeColor: (color) => set({ strokeColor: color }),
  setCanvasSize: (w, h) => set({ canvasWidth: w, canvasHeight: h }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setImageData: (data, fileName) => set({ imageData: data, fileName }),
  setStrokeWidth: (width) => set({ strokeWidth: width }),
  setSelection: (sel) => set((state) => ({ selection: sel, selectionVersion: state.selectionVersion + 1 })),
  bumpSelectionVersion: () => set((state) => ({ selectionVersion: state.selectionVersion + 1 })),
  toggleSelectionShape: () =>
    set((state) => ({
      selectionShape: state.selectionShape === 'rectangle' ? 'ellipse' : 'rectangle',
    })),
  setFontFamily: (fontFamily) => set({ fontFamily }),
  setFontSize: (fontSize) => set({ fontSize }),
  setFontBold: (fontBold) => set({ fontBold }),
  setFontItalic: (fontItalic) => set({ fontItalic }),
  setRequestTextEditLayerId: (requestTextEditLayerId) => set({ requestTextEditLayerId }),
  setDirty: (isDirty) => set({ isDirty }),
  setIsOra: (isOra) => set({ isOra }),
}));
