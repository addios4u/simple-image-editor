import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../editorStore';

describe('editorStore', () => {
  beforeEach(() => {
    useEditorStore.setState({
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
    });
  });

  it('has correct initial state', () => {
    const state = useEditorStore.getState();
    expect(state.mode).toBe('viewer');
    expect(state.activeTool).toBe('select');
    expect(state.zoom).toBe(1);
    expect(state.panX).toBe(0);
    expect(state.panY).toBe(0);
  });

  it('setMode switches between viewer and editor', () => {
    const { setMode } = useEditorStore.getState();

    setMode('editor');
    expect(useEditorStore.getState().mode).toBe('editor');

    setMode('viewer');
    expect(useEditorStore.getState().mode).toBe('viewer');
  });

  it('setActiveTool changes tool', () => {
    const { setActiveTool } = useEditorStore.getState();
    const tools = ['select', 'marquee', 'brush', 'text', 'zoom'] as const;

    for (const tool of tools) {
      setActiveTool(tool);
      expect(useEditorStore.getState().activeTool).toBe(tool);
    }
  });

  it('setZoom updates zoom level', () => {
    const { setZoom } = useEditorStore.getState();

    setZoom(2.5);
    expect(useEditorStore.getState().zoom).toBe(2.5);

    setZoom(0.5);
    expect(useEditorStore.getState().zoom).toBe(0.5);
  });

  it('setPan updates panX and panY', () => {
    const { setPan } = useEditorStore.getState();

    setPan(100, 200);
    expect(useEditorStore.getState().panX).toBe(100);
    expect(useEditorStore.getState().panY).toBe(200);
  });

  it('setFillColor updates fill color', () => {
    const { setFillColor } = useEditorStore.getState();

    setFillColor('#ff0000');
    expect(useEditorStore.getState().fillColor).toBe('#ff0000');
  });

  it('setStrokeColor updates stroke color', () => {
    const { setStrokeColor } = useEditorStore.getState();

    setStrokeColor('#00ff00');
    expect(useEditorStore.getState().strokeColor).toBe('#00ff00');
  });
});
