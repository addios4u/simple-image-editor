import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock engineContext filter functions
const mockGaussianBlurLayer = vi.fn();
const mockBoxBlurLayer = vi.fn();
const mockMotionBlurLayer = vi.fn();
const mockRequestRender = vi.fn();
const mockCaptureLayerRegion = vi.fn(() => ({ free: vi.fn() }));

vi.mock('../../engine/engineContext', () => ({
  gaussianBlurLayer: (...args: any[]) => mockGaussianBlurLayer(...args),
  boxBlurLayer: (...args: any[]) => mockBoxBlurLayer(...args),
  motionBlurLayer: (...args: any[]) => mockMotionBlurLayer(...args),
  requestRender: (...args: any[]) => mockRequestRender(...args),
  captureLayerRegion: (...args: any[]) => mockCaptureLayerRegion(...args),
}));

// Mock historyStore
const mockPushEditWithSnapshot = vi.fn(() => 'history-1');
const mockCommitSnapshot = vi.fn();

vi.mock('../../state/historyStore', () => ({
  useHistoryStore: {
    getState: () => ({
      pushEditWithSnapshot: mockPushEditWithSnapshot,
      commitSnapshot: mockCommitSnapshot,
    }),
  },
}));

// Mock layerStore
vi.mock('../../state/layerStore', () => ({
  useLayerStore: {
    getState: () => ({
      activeLayerId: 'layer-1',
    }),
  },
}));

// Mock editorStore
vi.mock('../../state/editorStore', () => ({
  useEditorStore: {
    getState: () => ({
      canvasWidth: 800,
      canvasHeight: 600,
    }),
  },
}));

import FilterMenu from '../FilterMenu';

describe('FilterMenu', () => {
  beforeEach(() => {
    // Each test starts fresh
  });

  it('renders "Filters" section', () => {
    render(<FilterMenu />);
    expect(screen.getByText('Filters')).toBeInTheDocument();
  });

  it('renders blur filter options', () => {
    render(<FilterMenu />);
    expect(screen.getByRole('button', { name: /gaussian blur/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /box blur/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /motion blur/i })).toBeInTheDocument();
  });

  it('clicking Gaussian Blur opens parameter dialog', () => {
    render(<FilterMenu />);
    const gaussianBtn = screen.getByRole('button', { name: /gaussian blur/i });
    fireEvent.click(gaussianBtn);

    expect(screen.getByText('Gaussian Blur Settings')).toBeInTheDocument();
    expect(screen.getByLabelText(/sigma/i)).toBeInTheDocument();
  });

  it('clicking Box Blur opens parameter dialog with radius input', () => {
    render(<FilterMenu />);
    const boxBtn = screen.getByRole('button', { name: /box blur/i });
    fireEvent.click(boxBtn);

    expect(screen.getByText('Box Blur Settings')).toBeInTheDocument();
    expect(screen.getByLabelText(/radius/i)).toBeInTheDocument();
  });

  it('clicking Motion Blur opens parameter dialog with angle and distance inputs', () => {
    render(<FilterMenu />);
    const motionBtn = screen.getByRole('button', { name: /motion blur/i });
    fireEvent.click(motionBtn);

    expect(screen.getByText('Motion Blur Settings')).toBeInTheDocument();
    expect(screen.getByLabelText(/angle/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/distance/i)).toBeInTheDocument();
  });

  it('parameter dialog shows Apply and Cancel buttons', () => {
    render(<FilterMenu />);
    const gaussianBtn = screen.getByRole('button', { name: /gaussian blur/i });
    fireEvent.click(gaussianBtn);

    expect(screen.getByRole('button', { name: /apply/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('Cancel button closes the parameter dialog', () => {
    render(<FilterMenu />);
    const gaussianBtn = screen.getByRole('button', { name: /gaussian blur/i });
    fireEvent.click(gaussianBtn);

    expect(screen.getByText('Gaussian Blur Settings')).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtn);

    expect(screen.queryByText('Gaussian Blur Settings')).not.toBeInTheDocument();
  });

  it('Apply button closes the parameter dialog', () => {
    render(<FilterMenu />);
    const boxBtn = screen.getByRole('button', { name: /box blur/i });
    fireEvent.click(boxBtn);

    expect(screen.getByText('Box Blur Settings')).toBeInTheDocument();

    const applyBtn = screen.getByRole('button', { name: /apply/i });
    fireEvent.click(applyBtn);

    expect(screen.queryByText('Box Blur Settings')).not.toBeInTheDocument();
  });

  it('Gaussian Blur sigma input accepts values', () => {
    render(<FilterMenu />);
    fireEvent.click(screen.getByRole('button', { name: /gaussian blur/i }));

    const sigmaInput = screen.getByLabelText(/sigma/i) as HTMLInputElement;
    fireEvent.change(sigmaInput, { target: { value: '5.0' } });
    expect(sigmaInput.value).toBe('5.0');
  });

  it('Box Blur radius input accepts values', () => {
    render(<FilterMenu />);
    fireEvent.click(screen.getByRole('button', { name: /box blur/i }));

    const radiusInput = screen.getByLabelText(/radius/i) as HTMLInputElement;
    fireEvent.change(radiusInput, { target: { value: '10' } });
    expect(radiusInput.value).toBe('10');
  });

  it('Motion Blur angle and distance inputs accept values', () => {
    render(<FilterMenu />);
    fireEvent.click(screen.getByRole('button', { name: /motion blur/i }));

    const angleInput = screen.getByLabelText(/angle/i) as HTMLInputElement;
    fireEvent.change(angleInput, { target: { value: '45' } });
    expect(angleInput.value).toBe('45');

    const distanceInput = screen.getByLabelText(/distance/i) as HTMLInputElement;
    fireEvent.change(distanceInput, { target: { value: '20' } });
    expect(distanceInput.value).toBe('20');
  });

  describe('WASM filter integration', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('Apply Gaussian Blur calls gaussianBlurLayer with sigma', () => {
      render(<FilterMenu />);
      fireEvent.click(screen.getByRole('button', { name: /gaussian blur/i }));

      const sigmaInput = screen.getByLabelText(/sigma/i);
      fireEvent.change(sigmaInput, { target: { value: '3.5' } });

      fireEvent.click(screen.getByRole('button', { name: /apply/i }));

      expect(mockCaptureLayerRegion).toHaveBeenCalledWith('layer-1', 0, 0, 800, 600);
      expect(mockGaussianBlurLayer).toHaveBeenCalledWith('layer-1', 3.5);
      expect(mockRequestRender).toHaveBeenCalled();
      expect(mockPushEditWithSnapshot).toHaveBeenCalledWith(
        'Gaussian Blur',
        'layer-1',
        expect.anything(),
        { x: 0, y: 0, w: 800, h: 600 },
      );
      expect(mockCommitSnapshot).toHaveBeenCalledWith('history-1', expect.anything());
    });

    it('Apply Box Blur calls boxBlurLayer with radius', () => {
      render(<FilterMenu />);
      fireEvent.click(screen.getByRole('button', { name: /box blur/i }));

      const radiusInput = screen.getByLabelText(/radius/i);
      fireEvent.change(radiusInput, { target: { value: '7' } });

      fireEvent.click(screen.getByRole('button', { name: /apply/i }));

      expect(mockBoxBlurLayer).toHaveBeenCalledWith('layer-1', 7);
      expect(mockRequestRender).toHaveBeenCalled();
    });

    it('Apply Motion Blur calls motionBlurLayer with angle and distance', () => {
      render(<FilterMenu />);
      fireEvent.click(screen.getByRole('button', { name: /motion blur/i }));

      fireEvent.change(screen.getByLabelText(/angle/i), { target: { value: '90' } });
      fireEvent.change(screen.getByLabelText(/distance/i), { target: { value: '15' } });

      fireEvent.click(screen.getByRole('button', { name: /apply/i }));

      expect(mockMotionBlurLayer).toHaveBeenCalledWith('layer-1', 90, 15);
      expect(mockRequestRender).toHaveBeenCalled();
    });
  });
});
