import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { useEditorStore } from '../../state/editorStore';

// Mock engine modules before importing Canvas
const mockSetupCanvas = vi.fn();
const mockSetupRenderLoop = vi.fn();
const mockCompositeAndRender = vi.fn();

vi.mock('../../engine/engineContext', () => ({
  setupCanvas: (...args: unknown[]) => mockSetupCanvas(...args),
  setupRenderLoop: (...args: unknown[]) => mockSetupRenderLoop(...args),
  compositeAndRender: (...args: unknown[]) => mockCompositeAndRender(...args),
  brushStrokeLayer: vi.fn(),
  requestRender: vi.fn(),
  getCanvasSize: vi.fn(() => ({ width: 0, height: 0 })),
}));

vi.mock('../../engine/helpers', () => ({
  hexToPackedRGBA: vi.fn(() => 0x000000FF),
}));

const mockLoopStart = vi.fn();
const mockLoopStop = vi.fn();

vi.mock('../../engine/renderLoop', () => ({
  RenderLoop: vi.fn().mockImplementation(() => ({
    start: mockLoopStart,
    stop: mockLoopStop,
    requestRender: vi.fn(),
    isDirty: vi.fn(() => false),
    flush: vi.fn(),
  })),
}));

import Canvas from '../Canvas';

describe('Canvas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEditorStore.setState({
      mode: 'editor',
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

  it('renders canvas element', () => {
    render(<Canvas />);
    const canvas = screen.getByTestId('editor-canvas');
    expect(canvas).toBeInTheDocument();
    expect(canvas.tagName).toBe('CANVAS');
  });

  it('canvas has correct dimensions from store', () => {
    useEditorStore.setState({ canvasWidth: 1024, canvasHeight: 768 });
    render(<Canvas />);
    const canvas = screen.getByTestId('editor-canvas') as HTMLCanvasElement;
    expect(canvas.width).toBe(1024);
    expect(canvas.height).toBe(768);
  });

  describe('render loop', () => {
    beforeEach(() => {
      // jsdom doesn't implement canvas 2D context, mock it
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        putImageData: vi.fn(),
      } as unknown as CanvasRenderingContext2D);
    });

    it('sets up canvas context and render loop on mount', () => {
      render(<Canvas />);
      expect(mockSetupCanvas).toHaveBeenCalledTimes(1);
      expect(mockSetupRenderLoop).toHaveBeenCalledTimes(1);
      expect(mockLoopStart).toHaveBeenCalledTimes(1);
    });

    it('stops render loop on unmount', () => {
      const { unmount } = render(<Canvas />);
      unmount();
      expect(mockLoopStop).toHaveBeenCalledTimes(1);
    });
  });
});
