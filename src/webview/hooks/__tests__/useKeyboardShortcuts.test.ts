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
const mockCutSelection = vi.fn();
const mockCopySelectionToBlob = vi.fn().mockResolvedValue(new Blob());
const mockPasteImageAsNewLayer = vi.fn().mockResolvedValue(true);
const mockSetInternalClipboard = vi.fn();
const mockGetInternalClipboard = vi.fn().mockReturnValue(null);

vi.mock('../../engine/engineContext', () => ({
  fillRectLayer: (...args: unknown[]) => mockFillRectLayer(...args),
  requestRender: (...args: unknown[]) => mockRequestRender(...args),
  cutSelection: (...args: unknown[]) => mockCutSelection(...args),
  copySelectionToBlob: (...args: unknown[]) => mockCopySelectionToBlob(...args),
  pasteImageAsNewLayer: (...args: unknown[]) => mockPasteImageAsNewLayer(...args),
  setInternalClipboard: (...args: unknown[]) => mockSetInternalClipboard(...args),
  getInternalClipboard: () => mockGetInternalClipboard(),
  clearMaskedPixels: vi.fn(),
}));

const mockGetSelectionMask = vi.fn();
vi.mock('../../engine/selectionMask', () => ({
  getSelectionMask: () => mockGetSelectionMask(),
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
  // code가 지정되지 않으면 key에서 자동 유추 (단일 문자 → 'KeyX' 형식)
  const code = opts.code ?? (key.length === 1 ? `Key${key.toUpperCase()}` : key);
  window.dispatchEvent(new KeyboardEvent('keydown', { key, code, bubbles: true, ...opts }));
}

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEditorStore.setState({
      activeTool: 'select',
      zoom: 1,
    });
    mockGetSelectionMask.mockReturnValue({ isEmpty: () => true, getBounds: () => null });
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

    it('M key switches to select tool', () => {
      useEditorStore.setState({ activeTool: 'brush' });
      renderHook(() => useKeyboardShortcuts());
      fireKey('m');
      expect(useEditorStore.getState().activeTool).toBe('select');
    });

    it('M key toggles selectionShape when already on select', () => {
      useEditorStore.setState({ activeTool: 'select', selectionShape: 'rectangle' });
      renderHook(() => useKeyboardShortcuts());
      fireKey('m');
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
      // 선택 영역이 있는 마스크를 반환하도록 설정
      mockGetSelectionMask.mockReturnValue({
        isEmpty: () => false,
        getBounds: () => ({ x: 10, y: 20, width: 100, height: 50 }),
      });
    });

    it('Cmd+C calls copySelectionToBlob with selection bounds', () => {
      renderHook(() => useKeyboardShortcuts());
      fireKey('c', { metaKey: true });

      expect(mockCopySelectionToBlob).toHaveBeenCalledWith(
        { x: 10, y: 20, w: 100, h: 50 },
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

    it('Cmd+V does nothing when no clipboard blob available', () => {
      mockGetInternalClipboard.mockReturnValue(null);
      renderHook(() => useKeyboardShortcuts());
      fireKey('v', { metaKey: true });

      // 클립보드가 없으면 pasteImageAsNewLayer 호출 안 됨
      expect(mockPasteImageAsNewLayer).not.toHaveBeenCalled();
    });

    it('Cmd+C does nothing when mask is empty', () => {
      mockGetSelectionMask.mockReturnValue({ isEmpty: () => true, getBounds: () => null });
      renderHook(() => useKeyboardShortcuts());
      fireKey('c', { metaKey: true });

      expect(mockCopySelectionToBlob).not.toHaveBeenCalled();
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
