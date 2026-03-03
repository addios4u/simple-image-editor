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
    it('V key switches to select tool', () => {
      renderHook(() => useKeyboardShortcuts());
      fireKey('v');
      expect(useEditorStore.getState().activeTool).toBe('select');
    });

    it('M key switches to marquee tool', () => {
      renderHook(() => useKeyboardShortcuts());
      fireKey('m');
      expect(useEditorStore.getState().activeTool).toBe('marquee');
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

    it('Z key (without modifier) switches to zoom tool', () => {
      renderHook(() => useKeyboardShortcuts());
      fireKey('z');
      expect(useEditorStore.getState().activeTool).toBe('zoom');
    });

    it('tool shortcuts are ignored when modifier is held', () => {
      renderHook(() => useKeyboardShortcuts());
      fireKey('b', { metaKey: true });
      expect(useEditorStore.getState().activeTool).toBe('select'); // unchanged
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
