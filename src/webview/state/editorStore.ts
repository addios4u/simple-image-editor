import { create } from 'zustand';

export type EditorMode = 'viewer' | 'editor';
export type ToolType = 'select' | 'marquee' | 'brush' | 'text' | 'zoom';
export type SidebarTab = 'layers' | 'properties' | 'ai';

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
  // Actions
  setMode: (mode: EditorMode) => void;
  setActiveTool: (tool: ToolType) => void;
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  setFillColor: (color: string) => void;
  setStrokeColor: (color: string) => void;
  setCanvasSize: (w: number, h: number) => void;
  setActiveTab: (tab: SidebarTab) => void;
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
  setMode: (mode) => set({ mode }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setZoom: (zoom) => set({ zoom }),
  setPan: (x, y) => set({ panX: x, panY: y }),
  setFillColor: (color) => set({ fillColor: color }),
  setStrokeColor: (color) => set({ strokeColor: color }),
  setCanvasSize: (w, h) => set({ canvasWidth: w, canvasHeight: h }),
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
