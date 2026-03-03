import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from '../useKeyboardShortcuts';
import { useEditorStore } from '../../state/editorStore';

const mockUndo = vi.fn();
const mockRedo = vi.fn();

vi.mock('../../state/historyStore', () => ({
  useHistoryStore: {
    getState: () => ({
      undo: mockUndo,
      redo: mockRedo,
    }),
  },
}));

const mockFillRectLayer = vi.fn();
const mockRequestRender = vi.fn();
const mockCopySelection = vi.fn();
const mockCutSelection = vi.fn();
const mockPasteClipboard = vi.fn();

vi.mock('../../engine/engineContext', () => ({
  fillRectLayer: (...args: unknown[]) => mockFillRectLayer(...args),
  requestRender: (...args: unknown[]) => mockRequestRender(...args),
  copySelection: (...args: unknown[]) => mockCopySelection(...args),
  cutSelection: (...args: unknown[]) => mockCutSelection(...args),
  pasteClipboard: (...args: unknown[]) => mockPasteClipboard(...args),
}));

vi.mock('../../engine/helpers', () => ({
  hexToPackedRGBA: (hex: string) => hex === '#ff0000' ? 0xff0000ff : 0x000000ff,
}));

vi.mock('../../state/layerStore', () => ({
  useLayerStore: {
    getState: () => ({ activeLayerId: 'layer-1' }),
  },
}));

function fireKey(key: string, opts: Partial<KeyboardEventInit> = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...opts }));
}

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEditorStore.setState({
      activeTool: 'select',
      zoom: 1,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------
  // Undo / Redo (Cmd+Z, Cmd+Shift+Z)
  // ---------------------------------------------------------------

  describe('Undo/Redo', () => {
    it('Cmd+Z calls undo', () => {
      renderHook(() => useKeyboardShortcuts());
      fireKey('z', { metaKey: true });
      expect(mockUndo).toHaveBeenCalledTimes(1);
    });

    it('Ctrl+Z calls undo', () => {
      renderHook(() => useKeyboardShortcuts());
      fireKey('z', { ctrlKey: true });
      expect(mockUndo).toHaveBeenCalledTimes(1);
    });

    it('Cmd+Shift+Z calls redo', () => {
      renderHook(() => useKeyboardShortcuts());
      fireKey('z', { metaKey: true, shiftKey: true });
      expect(mockRedo).toHaveBeenCalledTimes(1);
      expect(mockUndo).not.toHaveBeenCalled();
    });

    it('Ctrl+Shift+Z calls redo', () => {
      renderHook(() => useKeyboardShortcuts());
      fireKey('z', { ctrlKey: true, shiftKey: true });
      expect(mockRedo).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------
  // Tool switching (single-key, no modifier)
  // ---------------------------------------------------------------

  describe('Tool shortcuts', () => {
    it('V key switches to move tool', () => {
      renderHook(() => useKeyboardShortcuts());
      fireKey('v');
      expect(useEditorStore.getState().activeTool).toBe('move');
    });

    it('S key switches to select tool', () => {
      useEditorStore.setState({ activeTool: 'brush' });
      renderHook(() => useKeyboardShortcuts());
      fireKey('s');
      expect(useEditorStore.getState().activeTool).toBe('select');
    });

    it('S key toggles selectionShape when already on select', () => {
      useEditorStore.setState({ activeTool: 'select', selectionShape: 'rectangle' });
      renderHook(() => useKeyboardShortcuts());
      fireKey('s');
      expect(useEditorStore.getState().selectionShape).toBe('ellipse');
      expect(useEditorStore.getState().activeTool).toBe('select');
    });

    it('B key switches to brush tool', () => {
      renderHook(() => useKeyboardShortcuts());
      fireKey('b');
      expect(useEditorStore.getState().activeTool).toBe('brush');
    });

    it('T key switches to text tool', () => {
      renderHook(() => useKeyboardShortcuts());
      fireKey('t');
      expect(useEditorStore.getState().activeTool).toBe('text');
    });

    it('tool shortcuts are ignored when modifier is held', () => {
      renderHook(() => useKeyboardShortcuts());
      fireKey('b', { metaKey: true });
      expect(useEditorStore.getState().activeTool).toBe('select'); // unchanged
    });
  });

  // ---------------------------------------------------------------
  // Fill (Alt+Backspace)
  // ---------------------------------------------------------------

  describe('Fill shortcut', () => {
    it('Alt+Backspace fills entire canvas when no selection', () => {
      useEditorStore.setState({
        fillColor: '#000000',
        selection: null,
        canvasWidth: 800,
        canvasHeight: 600,
      });

      renderHook(() => useKeyboardShortcuts());
      fireKey('Backspace', { altKey: true });

      expect(mockFillRectLayer).toHaveBeenCalledWith('layer-1', 0, 0, 800, 600, 0x000000ff);
      expect(mockRequestRender).toHaveBeenCalledTimes(1);
    });

    it('Alt+Backspace fills selection rect when selection exists', () => {
      useEditorStore.setState({
        fillColor: '#ff0000',
        selection: { x: 10, y: 20, width: 100, height: 50 },
      });

      renderHook(() => useKeyboardShortcuts());
      fireKey('Backspace', { altKey: true });

      expect(mockFillRectLayer).toHaveBeenCalledWith('layer-1', 10, 20, 100, 50, 0xff0000ff);
      expect(mockRequestRender).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------
  // Clipboard (Cmd+C / Cmd+X / Cmd+V)
  // ---------------------------------------------------------------

  describe('Clipboard shortcuts', () => {
    beforeEach(() => {
      useEditorStore.setState({
        selection: { x: 10, y: 20, width: 100, height: 50 },
      });
    });

    it('Cmd+C calls copySelection with active layer and selection', () => {
      renderHook(() => useKeyboardShortcuts());
      fireKey('c', { metaKey: true });

      expect(mockCopySelection).toHaveBeenCalledWith(
        'layer-1', 10, 20, 100, 50,
      );
    });

    it('Cmd+X calls cutSelection with active layer and selection', () => {
      renderHook(() => useKeyboardShortcuts());
      fireKey('x', { metaKey: true });

      expect(mockCutSelection).toHaveBeenCalledWith(
        'layer-1', 10, 20, 100, 50,
      );
      expect(mockRequestRender).toHaveBeenCalledTimes(1);
    });

    it('Cmd+V calls pasteClipboard with active layer', () => {
      renderHook(() => useKeyboardShortcuts());
      fireKey('v', { metaKey: true });

      expect(mockPasteClipboard).toHaveBeenCalledWith('layer-1', 0, 0);
      expect(mockRequestRender).toHaveBeenCalledTimes(1);
    });

    it('Cmd+C does nothing when no selection', () => {
      useEditorStore.setState({ selection: null });
      renderHook(() => useKeyboardShortcuts());
      fireKey('c', { metaKey: true });

      expect(mockCopySelection).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------
  // Input / textarea focus guard
  // ---------------------------------------------------------------

  describe('Focus guard', () => {
    it('ignores shortcuts when an INPUT is focused', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      renderHook(() => useKeyboardShortcuts());
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true }));

      expect(useEditorStore.getState().activeTool).toBe('select');
      document.body.removeChild(input);
    });
  });
});
