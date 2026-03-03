import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import LayerPanel from '../LayerPanel';
import { useLayerStore } from '../../state/layerStore';

describe('LayerPanel', () => {
  beforeEach(() => {
    useLayerStore.setState({
      layers: [{ id: 'layer-1', name: 'Background', visible: true, opacity: 1 }],
      activeLayerId: 'layer-1',
    });
    useLayerStore.getState()._resetCounter();
  });

  it('renders list of layers', () => {
    useLayerStore.setState({
      layers: [
        { id: 'layer-1', name: 'Background', visible: true, opacity: 1 },
        { id: 'layer-2', name: 'Layer 2', visible: true, opacity: 1 },
      ],
      activeLayerId: 'layer-1',
    });

    render(<LayerPanel />);
    expect(screen.getByText('Background')).toBeInTheDocument();
    expect(screen.getByText('Layer 2')).toBeInTheDocument();
  });

  it('each layer shows name and visibility icon', () => {
    render(<LayerPanel />);
    const layerItem = screen.getByTestId('layer-item-layer-1');
    expect(layerItem).toBeInTheDocument();
    expect(screen.getByText('Background')).toBeInTheDocument();
    expect(screen.getByTestId('visibility-toggle-layer-1')).toBeInTheDocument();
  });

  it('clicking visibility icon toggles layer visibility', () => {
    render(<LayerPanel />);
    const visibilityBtn = screen.getByTestId('visibility-toggle-layer-1');

    fireEvent.click(visibilityBtn);
    expect(useLayerStore.getState().layers[0].visible).toBe(false);

    fireEvent.click(visibilityBtn);
    expect(useLayerStore.getState().layers[0].visible).toBe(true);
  });

  it('clicking layer selects it (active layer highlighted)', () => {
    useLayerStore.setState({
      layers: [
        { id: 'layer-1', name: 'Background', visible: true, opacity: 1 },
        { id: 'layer-2', name: 'Layer 2', visible: true, opacity: 1 },
      ],
      activeLayerId: 'layer-1',
    });

    render(<LayerPanel />);

    const layer1 = screen.getByTestId('layer-item-layer-1');
    const layer2 = screen.getByTestId('layer-item-layer-2');

    expect(layer1.className).toContain('active');
    expect(layer2.className).not.toContain('active');

    fireEvent.click(layer2);
    expect(useLayerStore.getState().activeLayerId).toBe('layer-2');
  });

  it('Add Layer button creates new layer', () => {
    render(<LayerPanel />);
    const addBtn = screen.getByRole('button', { name: /add layer/i });

    fireEvent.click(addBtn);

    const state = useLayerStore.getState();
    expect(state.layers).toHaveLength(2);
  });

  it('trash button removes the layer', () => {
    useLayerStore.setState({
      layers: [
        { id: 'layer-1', name: 'Background', visible: true, opacity: 1 },
        { id: 'layer-2', name: 'Layer 2', visible: true, opacity: 1 },
      ],
      activeLayerId: 'layer-2',
    });

    render(<LayerPanel />);
    const deleteBtn = screen.getByTestId('delete-layer-layer-2');

    fireEvent.click(deleteBtn);

    const state = useLayerStore.getState();
    expect(state.layers).toHaveLength(1);
    expect(state.layers[0].id).toBe('layer-1');
  });

  it('opacity input changes active layer opacity', () => {
    render(<LayerPanel />);
    const input = screen.getByTestId('layer-opacity-input');

    fireEvent.change(input, { target: { value: '50' } });

    expect(useLayerStore.getState().layers[0].opacity).toBe(0.5);
  });
});
