import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// FilterDialog를 모킹해서 외부 의존성 격리
vi.mock('../FilterDialog', () => ({
  default: ({ filterType, onClose }: { filterType: string; onClose: () => void }) => (
    <div data-testid="filter-dialog-mock">
      <span data-testid="filter-dialog-type">{filterType}</span>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

import FilterMenu from '../FilterMenu';

describe('FilterMenu', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('렌더링 시 가우시안 블러, 모션 블러 항목이 표시된다', () => {
    render(<FilterMenu onClose={onClose} />);
    expect(screen.getByTestId('filter-btn-gaussian')).toBeInTheDocument();
    expect(screen.getByTestId('filter-btn-motion')).toBeInTheDocument();
  });

  it('가우시안 블러 클릭 시 FilterDialog가 gaussian 타입으로 열린다', () => {
    render(<FilterMenu onClose={onClose} />);
    fireEvent.click(screen.getByTestId('filter-btn-gaussian'));
    expect(screen.getByTestId('filter-dialog-mock')).toBeInTheDocument();
    expect(screen.getByTestId('filter-dialog-type')).toHaveTextContent('gaussian');
  });

  it('모션 블러 클릭 시 FilterDialog가 motion 타입으로 열린다', () => {
    render(<FilterMenu onClose={onClose} />);
    fireEvent.click(screen.getByTestId('filter-btn-motion'));
    expect(screen.getByTestId('filter-dialog-mock')).toBeInTheDocument();
    expect(screen.getByTestId('filter-dialog-type')).toHaveTextContent('motion');
  });

  it('FilterDialog의 onClose 호출 시 FilterMenu의 onClose도 호출된다', () => {
    render(<FilterMenu onClose={onClose} />);
    fireEvent.click(screen.getByTestId('filter-btn-gaussian'));
    fireEvent.click(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalled();
  });
});
