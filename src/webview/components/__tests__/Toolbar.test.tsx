import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import Toolbar from '../Toolbar';
import { useEditorStore } from '../../state/editorStore';

vi.mock('../../engine/engineContext', () => ({
  compositeToBytes: vi.fn(() => new Uint8Array([0])),
}));

describe('Toolbar', () => {
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

  it('renders tool buttons for all tools', () => {
    render(<Toolbar />);
    expect(screen.getByRole('button', { name: /move/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /select/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /brush/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /text/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
  });

  it('active tool is highlighted', () => {
    useEditorStore.setState({ activeTool: 'brush' });
    render(<Toolbar />);
    const brushButton = screen.getByRole('button', { name: /brush/i });
    expect(brushButton.className).toContain('active');
  });

  it('clicking a tool button changes active tool', () => {
    render(<Toolbar />);
    const moveButton = screen.getByRole('button', { name: /move/i });

    fireEvent.click(moveButton);
    expect(useEditorStore.getState().activeTool).toBe('move');
  });

  describe('selection shape toggle', () => {
    it('clicking select button when already active toggles shape', () => {
      useEditorStore.setState({ activeTool: 'select', selectionShape: 'rectangle' });
      render(<Toolbar />);
      const selectButton = screen.getByRole('button', { name: /rect/i });

      fireEvent.click(selectButton);
      expect(useEditorStore.getState().selectionShape).toBe('ellipse');
    });

    it('shows ellipse label when selectionShape is ellipse', () => {
      useEditorStore.setState({ activeTool: 'select', selectionShape: 'ellipse' });
      render(<Toolbar />);
      expect(screen.getByRole('button', { name: /ellipse/i })).toBeInTheDocument();
    });

    it('clicking select from another tool activates select without toggling shape', () => {
      useEditorStore.setState({ activeTool: 'brush', selectionShape: 'rectangle' });
      render(<Toolbar />);
      const selectButton = screen.getByRole('button', { name: /rect/i });

      fireEvent.click(selectButton);
      expect(useEditorStore.getState().activeTool).toBe('select');
      expect(useEditorStore.getState().selectionShape).toBe('rectangle');
    });
  });
});
