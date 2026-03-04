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
  useLayerStore: (selector: any) => selector({ activeLayerId: 'layer-1', layers: [] }),
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

describe('FilterDialog - 가우시안 블러', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSelection = null;
  });

  it('가우시안 블러 다이얼로그가 제목과 슬라이더를 렌더링한다', () => {
    render(<FilterDialog filterType="gaussian" onClose={onClose} />);
    expect(screen.getByText('가우시안 블러')).toBeInTheDocument();
    expect(screen.getByText(/강도 \(Sigma\)/)).toBeInTheDocument();
  });

  it('선택 영역이 없으면 "레이어 전체에 적용" 표시', () => {
    render(<FilterDialog filterType="gaussian" onClose={onClose} />);
    expect(screen.getByText('레이어 전체에 적용')).toBeInTheDocument();
  });

  it('선택 영역이 있으면 "선택 영역에 적용" 표시', () => {
    mockSelection = { x: 10, y: 20, width: 100, height: 80 };
    render(<FilterDialog filterType="gaussian" onClose={onClose} />);
    expect(screen.getByText(/선택 영역에 적용/)).toBeInTheDocument();
    expect(screen.getByText(/100×80px/)).toBeInTheDocument();  // selection.width×selection.height
  });

  it('적용 버튼 클릭 시 선택 영역 없으면 gaussianBlurLayer 호출', () => {
    render(<FilterDialog filterType="gaussian" onClose={onClose} />);
    fireEvent.click(screen.getByText('적용'));
    expect(mockGaussianBlurLayer).toHaveBeenCalledWith('layer-1', expect.any(Number));
    expect(mockGaussianBlurLayerRegion).not.toHaveBeenCalled();
    expect(mockRequestRender).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('선택 영역이 있으면 gaussianBlurLayerRegion 호출', () => {
    mockSelection = { x: 10, y: 20, width: 100, height: 80 };
    render(<FilterDialog filterType="gaussian" onClose={onClose} />);
    fireEvent.click(screen.getByText('적용'));
    expect(mockGaussianBlurLayerRegion).toHaveBeenCalledWith(
      'layer-1', expect.any(Number), 10, 20, 100, 80,
    );
    expect(mockGaussianBlurLayer).not.toHaveBeenCalled();
  });

  it('취소 버튼 클릭 시 onClose 호출, 필터 미적용', () => {
    render(<FilterDialog filterType="gaussian" onClose={onClose} />);
    fireEvent.click(screen.getByText('취소'));
    expect(onClose).toHaveBeenCalled();
    expect(mockGaussianBlurLayer).not.toHaveBeenCalled();
  });

  it('적용 시 history 스냅샷이 기록된다', () => {
    render(<FilterDialog filterType="gaussian" onClose={onClose} />);
    fireEvent.click(screen.getByText('적용'));
    expect(mockCaptureLayerRegion).toHaveBeenCalledWith('layer-1', 0, 0, 800, 600);
    expect(mockPushEditWithSnapshot).toHaveBeenCalledWith(
      '가우시안 블러', 'layer-1', expect.anything(), { x: 0, y: 0, w: 800, h: 600 },
    );
    expect(mockCommitSnapshot).toHaveBeenCalledWith('entry-1', expect.anything());
  });
});

describe('FilterDialog - 모션 블러', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSelection = null;
  });

  it('모션 블러 다이얼로그가 방향과 거리 슬라이더를 렌더링한다', () => {
    render(<FilterDialog filterType="motion" onClose={onClose} />);
    expect(screen.getByText('모션 블러')).toBeInTheDocument();
    expect(screen.getByText(/방향 \(Angle\)/)).toBeInTheDocument();
    expect(screen.getByText(/거리 \(Distance\)/)).toBeInTheDocument();
  });

  it('적용 버튼 클릭 시 선택 영역 없으면 motionBlurLayer 호출', () => {
    render(<FilterDialog filterType="motion" onClose={onClose} />);
    fireEvent.click(screen.getByText('적용'));
    expect(mockMotionBlurLayer).toHaveBeenCalledWith(
      'layer-1', expect.any(Number), expect.any(Number),
    );
    expect(mockMotionBlurLayerRegion).not.toHaveBeenCalled();
    expect(mockRequestRender).toHaveBeenCalled();
  });

  it('선택 영역이 있으면 motionBlurLayerRegion 호출', () => {
    mockSelection = { x: 5, y: 10, width: 200, height: 150 };
    render(<FilterDialog filterType="motion" onClose={onClose} />);
    fireEvent.click(screen.getByText('적용'));
    expect(mockMotionBlurLayerRegion).toHaveBeenCalledWith(
      'layer-1', expect.any(Number), expect.any(Number), 5, 10, 200, 150,
    );
    expect(mockMotionBlurLayer).not.toHaveBeenCalled();
  });

  it('선택 영역 있을 때 history label에 "(선택 영역)" 포함', () => {
    mockSelection = { x: 0, y: 0, width: 50, height: 50 };
    render(<FilterDialog filterType="motion" onClose={onClose} />);
    fireEvent.click(screen.getByText('적용'));
    expect(mockPushEditWithSnapshot).toHaveBeenCalledWith(
      '모션 블러 (선택 영역)', 'layer-1', expect.anything(), expect.anything(),
    );
  });
});
