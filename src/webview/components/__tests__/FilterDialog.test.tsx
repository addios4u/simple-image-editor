import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// engineContext 모킹
const mockGaussianBlurLayer = vi.fn();
const mockMotionBlurLayer = vi.fn();
const mockGaussianBlurLayerRegion = vi.fn();
const mockMotionBlurLayerRegion = vi.fn();
const mockCaptureLayerRegion = vi.fn(() => ({ free: vi.fn() }));
const mockRequestRender = vi.fn();
const mockGetLayerImageData = vi.fn(() => null);
const mockApplyFilterPreview = vi.fn(() => null);

vi.mock('../../engine/engineContext', () => ({
  gaussianBlurLayer: (...args: any[]) => mockGaussianBlurLayer(...args),
  motionBlurLayer: (...args: any[]) => mockMotionBlurLayer(...args),
  gaussianBlurLayerRegion: (...args: any[]) => mockGaussianBlurLayerRegion(...args),
  motionBlurLayerRegion: (...args: any[]) => mockMotionBlurLayerRegion(...args),
  captureLayerRegion: (...args: any[]) => mockCaptureLayerRegion(...args),
  requestRender: (...args: any[]) => mockRequestRender(...args),
  getLayerImageData: (...args: any[]) => mockGetLayerImageData(...args),
  applyFilterPreview: (...args: any[]) => mockApplyFilterPreview(...args),
}));

// historyStore 모킹
const mockPushEditWithSnapshot = vi.fn(() => 'entry-1');
const mockCommitSnapshot = vi.fn();
vi.mock('../../state/historyStore', () => ({
  useHistoryStore: {
    getState: () => ({
      pushEditWithSnapshot: mockPushEditWithSnapshot,
      commitSnapshot: mockCommitSnapshot,
    }),
  },
}));

// layerStore 모킹
vi.mock('../../state/layerStore', () => ({
  useLayerStore: (selector: any) => selector({
    activeLayerId: 'layer-1',
    layers: [{ id: 'layer-1', offsetX: 0, offsetY: 0 }],
  }),
}));

// editorStore 모킹 — 기본: 선택 영역 없음
let mockSelection: { x: number; y: number; w: number; h: number } | null = null;
vi.mock('../../state/editorStore', () => ({
  useEditorStore: (selector: any) =>
    selector({
      selection: mockSelection,
      canvasWidth: 800,
      canvasHeight: 600,
    }),
}));

import FilterDialog from '../FilterDialog';

describe('FilterDialog - Gaussian Blur', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSelection = null;
  });

  it('renders gaussian blur dialog with title and slider', () => {
    render(<FilterDialog filterType="gaussian" onClose={onClose} />);
    expect(screen.getByText('Gaussian Blur')).toBeInTheDocument();
    expect(screen.getByText(/Strength \(Sigma\)/)).toBeInTheDocument();
  });

  it('shows "Apply to entire layer" when no selection', () => {
    render(<FilterDialog filterType="gaussian" onClose={onClose} />);
    expect(screen.getByText('Apply to entire layer')).toBeInTheDocument();
  });

  it('shows "Apply to selection" when selection exists', () => {
    mockSelection = { x: 10, y: 20, width: 100, height: 80 };
    render(<FilterDialog filterType="gaussian" onClose={onClose} />);
    expect(screen.getByText(/Apply to selection/)).toBeInTheDocument();
    expect(screen.getByText(/100×80px/)).toBeInTheDocument();
  });

  it('calls gaussianBlurLayer when Apply clicked without selection', () => {
    render(<FilterDialog filterType="gaussian" onClose={onClose} />);
    fireEvent.click(screen.getByText('Apply'));
    expect(mockGaussianBlurLayer).toHaveBeenCalledWith('layer-1', expect.any(Number));
    expect(mockGaussianBlurLayerRegion).not.toHaveBeenCalled();
    expect(mockRequestRender).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('calls gaussianBlurLayerRegion when selection exists', () => {
    mockSelection = { x: 10, y: 20, width: 100, height: 80 };
    render(<FilterDialog filterType="gaussian" onClose={onClose} />);
    fireEvent.click(screen.getByText('Apply'));
    expect(mockGaussianBlurLayerRegion).toHaveBeenCalledWith(
      'layer-1', expect.any(Number), 10, 20, 100, 80,
    );
    expect(mockGaussianBlurLayer).not.toHaveBeenCalled();
  });

  it('calls onClose without applying filter when Cancel clicked', () => {
    render(<FilterDialog filterType="gaussian" onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
    expect(mockGaussianBlurLayer).not.toHaveBeenCalled();
  });

  it('records history snapshot when Apply clicked', () => {
    render(<FilterDialog filterType="gaussian" onClose={onClose} />);
    fireEvent.click(screen.getByText('Apply'));
    expect(mockCaptureLayerRegion).toHaveBeenCalledWith('layer-1', 0, 0, 800, 600);
    expect(mockPushEditWithSnapshot).toHaveBeenCalledWith(
      'Gaussian Blur', 'layer-1', expect.anything(), { x: 0, y: 0, w: 800, h: 600 },
    );
    expect(mockCommitSnapshot).toHaveBeenCalledWith('entry-1', expect.anything());
  });
});

describe('FilterDialog - Motion Blur', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSelection = null;
  });

  it('renders motion blur dialog with direction and distance sliders', () => {
    render(<FilterDialog filterType="motion" onClose={onClose} />);
    expect(screen.getByText('Motion Blur')).toBeInTheDocument();
    expect(screen.getByText(/Direction \(Angle\)/)).toBeInTheDocument();
    expect(screen.getByText(/Distance/)).toBeInTheDocument();
  });

  it('calls motionBlurLayer when Apply clicked without selection', () => {
    render(<FilterDialog filterType="motion" onClose={onClose} />);
    fireEvent.click(screen.getByText('Apply'));
    expect(mockMotionBlurLayer).toHaveBeenCalledWith(
      'layer-1', expect.any(Number), expect.any(Number),
    );
    expect(mockMotionBlurLayerRegion).not.toHaveBeenCalled();
    expect(mockRequestRender).toHaveBeenCalled();
  });

  it('calls motionBlurLayerRegion when selection exists', () => {
    mockSelection = { x: 5, y: 10, width: 200, height: 150 };
    render(<FilterDialog filterType="motion" onClose={onClose} />);
    fireEvent.click(screen.getByText('Apply'));
    expect(mockMotionBlurLayerRegion).toHaveBeenCalledWith(
      'layer-1', expect.any(Number), expect.any(Number), 5, 10, 200, 150,
    );
    expect(mockMotionBlurLayer).not.toHaveBeenCalled();
  });

  it('includes "(selection)" in history label when selection exists', () => {
    mockSelection = { x: 0, y: 0, width: 50, height: 50 };
    render(<FilterDialog filterType="motion" onClose={onClose} />);
    fireEvent.click(screen.getByText('Apply'));
    expect(mockPushEditWithSnapshot).toHaveBeenCalledWith(
      expect.stringContaining('Motion Blur'), 'layer-1', expect.anything(), expect.anything(),
    );
  });
});
