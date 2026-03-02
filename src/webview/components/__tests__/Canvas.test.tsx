import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import Canvas from '../Canvas';
import { useEditorStore } from '../../state/editorStore';

describe('Canvas', () => {
  beforeEach(() => {
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

  it('displays zoom level', () => {
    useEditorStore.setState({ zoom: 1.5 });
    render(<Canvas />);
    expect(screen.getByText('150%')).toBeInTheDocument();
  });
});
