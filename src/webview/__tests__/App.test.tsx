import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import React from 'react';

// Mock child components to isolate App logic
vi.mock('../components/ViewerMode', () => ({
  default: () => <div data-testid="viewer-mode" />,
}));
vi.mock('../components/EditorMode', () => ({
  default: () => <div data-testid="editor-mode" />,
}));

// Mock vscode API
const mockPostMessage = vi.fn();
vi.mock('../vscode', () => ({
  default: {
    postMessage: (...args: unknown[]) => mockPostMessage(...args),
    getState: vi.fn(),
    setState: vi.fn(),
  },
}));

// Mock keyboard shortcuts hook
vi.mock('../hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: vi.fn(),
}));

// Mock historyStore
const mockHistoryUndo = vi.fn();
const mockHistoryRedo = vi.fn();

vi.mock('../state/historyStore', () => ({
  useHistoryStore: {
    getState: () => ({
      undo: mockHistoryUndo,
      redo: mockHistoryRedo,
    }),
  },
}));

// Mock engine context
const mockInitEngine = vi.fn(async () => {});
const mockLoadImage = vi.fn(() => ({ width: 640, height: 480 }));
const mockRequestRender = vi.fn();
const mockCompositeToBytes = vi.fn(() => new Uint8Array([0x89, 0x50]));
const mockEncodeLayerToPng = vi.fn(() => new Uint8Array([0x89, 0x50, 0x4e, 0x47]));

vi.mock('../engine/engineContext', () => ({
  initEngine: (...args: unknown[]) => mockInitEngine(...args),
  loadImage: (...args: unknown[]) => mockLoadImage(...args),
  requestRender: (...args: unknown[]) => mockRequestRender(...args),
  compositeToBytes: (...args: unknown[]) => mockCompositeToBytes(...args),
  encodeLayerToPng: (...args: unknown[]) => mockEncodeLayerToPng(...args),
}));

// Mock openraster
const mockWriteOra = vi.fn(() => new Uint8Array([0x50, 0x4b, 0x03, 0x04]));
vi.mock('../engine/openraster', () => ({
  writeOra: (...args: unknown[]) => mockWriteOra(...args),
}));

// Mock WASM loader
const mockLoadWasmModule = vi.fn();
vi.mock('../engine/loadWasm', () => ({
  loadWasmModule: (...args: unknown[]) => mockLoadWasmModule(...args),
}));

import App from '../App';
import { useEditorStore } from '../state/editorStore';
import { useAIStore } from '../state/aiStore';

function dispatchMessage(data: unknown): void {
  window.dispatchEvent(new MessageEvent('message', { data }));
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEditorStore.setState({
      mode: 'viewer',
      fileName: '',
      imageData: null,
      canvasWidth: 800,
      canvasHeight: 600,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends ready message on mount', () => {
    render(<App />);
    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'ready' });
  });

  describe('init message', () => {
    it('initializes WASM engine and loads image on init message', async () => {
      render(<App />);

      await act(async () => {
        dispatchMessage({
          type: 'init',
          body: { data: [1, 2, 3], fileName: 'photo.png', isUntitled: false },
        });
        // Allow async initEngine to complete
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(mockInitEngine).toHaveBeenCalledTimes(1);
      expect(mockLoadImage).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        'layer-1',
      );
      expect(mockRequestRender).toHaveBeenCalledTimes(1);

      // Canvas size should be updated from loadImage result
      const state = useEditorStore.getState();
      expect(state.canvasWidth).toBe(640);
      expect(state.canvasHeight).toBe(480);
    });

    it('stores image data and fileName in editor store', async () => {
      render(<App />);

      await act(async () => {
        dispatchMessage({
          type: 'init',
          body: { data: [10, 20], fileName: 'test.jpg', isUntitled: false },
        });
        await new Promise((r) => setTimeout(r, 0));
      });

      const state = useEditorStore.getState();
      expect(state.fileName).toBe('test.jpg');
      expect(state.imageData).toBeInstanceOf(Uint8Array);
    });

    it('skips engine initialization for SVG files', async () => {
      render(<App />);

      await act(async () => {
        dispatchMessage({
          type: 'init',
          body: { data: [1], fileName: 'icon.svg', isUntitled: false },
        });
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(mockInitEngine).not.toHaveBeenCalled();
      expect(mockLoadImage).not.toHaveBeenCalled();

      // imageData and fileName should still be stored
      const state = useEditorStore.getState();
      expect(state.fileName).toBe('icon.svg');
    });

    it('handles engine initialization failure gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockInitEngine.mockRejectedValueOnce(new Error('WASM load failed'));

      render(<App />);

      await act(async () => {
        dispatchMessage({
          type: 'init',
          body: { data: [1], fileName: 'photo.png', isUntitled: false },
        });
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to initialize WASM engine:',
        expect.any(Error),
      );
    });
  });

  describe('getFileData message', () => {
    it('composites image and responds with encoded bytes', async () => {
      render(<App />);

      await act(async () => {
        dispatchMessage({
          type: 'getFileData',
          body: { requestId: 'req-1', format: 'png' },
        });
      });

      expect(mockCompositeToBytes).toHaveBeenCalledWith('png');
      expect(mockPostMessage).toHaveBeenCalledWith({
        type: 'getFileDataResponse',
        body: {
          requestId: 'req-1',
          data: Array.from(new Uint8Array([0x89, 0x50])),
        },
      });
    });

    it('responds with error when composite fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockCompositeToBytes.mockImplementationOnce(() => {
        throw new Error('No compositor');
      });

      render(<App />);

      await act(async () => {
        dispatchMessage({
          type: 'getFileData',
          body: { requestId: 'req-2', format: 'jpg' },
        });
      });

      expect(mockPostMessage).toHaveBeenCalledWith({
        type: 'getFileDataResponse',
        body: {
          requestId: 'req-2',
          data: [],
          error: 'Error: No compositor',
        },
      });
      consoleSpy.mockRestore();
    });
  });

  describe('getOraData message', () => {
    it('responds with ORA bytes and layer count', async () => {
      render(<App />);

      await act(async () => {
        dispatchMessage({
          type: 'getOraData',
          body: { requestId: 'ora-1' },
        });
      });

      expect(mockWriteOra).toHaveBeenCalledTimes(1);
      expect(mockPostMessage).toHaveBeenCalledWith({
        type: 'getOraDataResponse',
        body: {
          requestId: 'ora-1',
          data: Array.from(new Uint8Array([0x50, 0x4b, 0x03, 0x04])),
          layerCount: 1,
        },
      });
    });
  });

  describe('aiGenerateResult message', () => {
    beforeEach(() => {
      useAIStore.setState({ isGenerating: true, result: null, error: null });
    });

    it('updates aiStore with result on success', async () => {
      render(<App />);

      await act(async () => {
        dispatchMessage({
          type: 'aiGenerateResult',
          body: { imageData: 'iVBORw0KGgoAAAANS' },
        });
      });

      const state = useAIStore.getState();
      expect(state.isGenerating).toBe(false);
      expect(state.result).toBe('iVBORw0KGgoAAAANS');
      expect(state.error).toBeNull();
    });

    it('updates aiStore with error on failure', async () => {
      render(<App />);

      await act(async () => {
        dispatchMessage({
          type: 'aiGenerateResult',
          body: { error: 'No API key configured for openai' },
        });
      });

      const state = useAIStore.getState();
      expect(state.isGenerating).toBe(false);
      expect(state.result).toBeNull();
      expect(state.error).toBe('No API key configured for openai');
    });
  });

  describe('triggerUndo / triggerRedo messages', () => {
    it('triggerUndo calls historyStore.undo()', async () => {
      render(<App />);

      await act(async () => {
        dispatchMessage({ type: 'triggerUndo' });
      });

      expect(mockHistoryUndo).toHaveBeenCalledTimes(1);
    });

    it('triggerRedo calls historyStore.redo()', async () => {
      render(<App />);

      await act(async () => {
        dispatchMessage({ type: 'triggerRedo' });
      });

      expect(mockHistoryRedo).toHaveBeenCalledTimes(1);
    });
  });
});
