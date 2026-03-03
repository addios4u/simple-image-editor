import { create } from 'zustand';

export type EditorMode = 'viewer' | 'editor';
export type ToolType = 'select' | 'marquee' | 'brush' | 'text' | 'zoom';
export type SidebarTab = 'layers' | 'properties' | 'ai';

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
  setSelection: (sel) => set({ selection: sel }),
}));
