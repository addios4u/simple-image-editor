import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import ViewerMode from '../ViewerMode';
import { useEditorStore } from '../../state/editorStore';

describe('ViewerMode', () => {
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

  it('renders image canvas element', () => {
    render(<ViewerMode />);
    const canvas = screen.getByTestId('viewer-canvas');
    expect(canvas).toBeInTheDocument();
    expect(canvas.tagName).toBe('CANVAS');
  });

  it('renders Edit button', () => {
    render(<ViewerMode />);
    const editButton = screen.getByRole('button', { name: /edit/i });
    expect(editButton).toBeInTheDocument();
  });

  it('clicking Edit button calls setMode with editor', () => {
    render(<ViewerMode />);
    const editButton = screen.getByRole('button', { name: /edit/i });

    fireEvent.click(editButton);
    expect(useEditorStore.getState().mode).toBe('editor');
  });
});
