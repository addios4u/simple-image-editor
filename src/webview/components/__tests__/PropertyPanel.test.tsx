import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import PropertyPanel from '../PropertyPanel';
import { useEditorStore } from '../../state/editorStore';

describe('PropertyPanel', () => {
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
      activeTab: 'properties',
    });
  });

  it('renders "Properties" title', () => {
    render(<PropertyPanel />);
    expect(screen.getByText('Properties')).toBeInTheDocument();
  });

  it('renders fill color section with color input', () => {
    render(<PropertyPanel />);
    expect(screen.getAllByText('Fill').length).toBeGreaterThanOrEqual(1);
    const fillInput = screen.getByTestId('fill-color-input');
    expect(fillInput).toBeInTheDocument();
    expect(fillInput).toHaveAttribute('type', 'color');
  });

  it('renders stroke color section with color input', () => {
    render(<PropertyPanel />);
    expect(screen.getAllByText('Stroke').length).toBeGreaterThanOrEqual(1);
    const strokeInput = screen.getByTestId('stroke-color-input');
    expect(strokeInput).toBeInTheDocument();
    expect(strokeInput).toHaveAttribute('type', 'color');
  });

  it('renders stroke width slider', () => {
    render(<PropertyPanel />);
    const slider = screen.getByTestId('stroke-width-slider');
    expect(slider).toBeInTheDocument();
    expect(slider).toHaveAttribute('type', 'range');
    expect(slider).toHaveAttribute('min', '1');
    expect(slider).toHaveAttribute('max', '50');
  });

  it('fill color change updates editorStore fillColor', () => {
    render(<PropertyPanel />);
    const fillInput = screen.getByTestId('fill-color-input');

    fireEvent.input(fillInput, { target: { value: '#ff0000' } });

    expect(useEditorStore.getState().fillColor).toBe('#ff0000');
  });

  it('stroke color change updates editorStore strokeColor', () => {
    render(<PropertyPanel />);
    const strokeInput = screen.getByTestId('stroke-color-input');

    fireEvent.input(strokeInput, { target: { value: '#00ff00' } });

    expect(useEditorStore.getState().strokeColor).toBe('#00ff00');
  });

  it('renders Fill button with Alt+Backspace shortcut hint', () => {
    render(<PropertyPanel />);
    const fillBtn = screen.getByRole('button', { name: /fill/i });
    expect(fillBtn).toBeInTheDocument();
    expect(screen.getByText(/Alt\+Backspace/)).toBeInTheDocument();
  });

  it('renders Stroke button', () => {
    render(<PropertyPanel />);
    const strokeBtn = screen.getByRole('button', { name: /stroke/i });
    expect(strokeBtn).toBeInTheDocument();
  });
});
