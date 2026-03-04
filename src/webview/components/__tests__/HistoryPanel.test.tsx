import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import HistoryPanel from '../HistoryPanel';
import { useHistoryStore } from '../../state/historyStore';

describe('HistoryPanel', () => {
  beforeEach(() => {
    useHistoryStore.setState({
      undoStack: [],
      redoStack: [],
      canUndo: false,
      canRedo: false,
    });
    useHistoryStore.getState()._resetCounter();
  });

  it('renders history panel', () => {
    render(<HistoryPanel />);
    expect(screen.getByTestId('history-panel')).toBeInTheDocument();
  });

  it('renders list of history entries', () => {
    const { pushEdit } = useHistoryStore.getState();
    pushEdit('Brush Stroke');
    pushEdit('Fill');

    render(<HistoryPanel />);
    expect(screen.getByText('Brush Stroke')).toBeInTheDocument();
    expect(screen.getByText('Fill')).toBeInTheDocument();
  });

  it('current position is highlighted', () => {
    const { pushEdit } = useHistoryStore.getState();
    pushEdit('Brush Stroke');
    pushEdit('Fill');

    render(<HistoryPanel />);

    const entries = screen.getAllByTestId(/^history-entry-/);
    // The last entry in the undo stack (Fill) should be the current position
    const lastEntry = entries[entries.length - 1];
    expect(lastEntry.className).toContain('active');
  });

  it('clicking entry calls goToEntry', () => {
    const { pushEdit } = useHistoryStore.getState();
    pushEdit('Brush Stroke');
    pushEdit('Fill');
    pushEdit('Eraser');

    render(<HistoryPanel />);

    const firstEntry = screen.getByText('Brush Stroke');
    fireEvent.click(firstEntry);

    const state = useHistoryStore.getState();
    // After clicking "Brush Stroke", undo stack should have 1 entry
    expect(state.undoStack).toHaveLength(1);
    expect(state.undoStack[0].label).toBe('Brush Stroke');
    expect(state.redoStack).toHaveLength(2);
  });

  it('shows undo/redo buttons', () => {
    render(<HistoryPanel />);
    expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /redo/i })).toBeInTheDocument();
  });

  it('undo button disabled when canUndo is false', () => {
    render(<HistoryPanel />);
    const undoBtn = screen.getByRole('button', { name: /undo/i });
    expect(undoBtn).toBeDisabled();
  });

  it('redo button disabled when canRedo is false', () => {
    render(<HistoryPanel />);
    const redoBtn = screen.getByRole('button', { name: /redo/i });
    expect(redoBtn).toBeDisabled();
  });

  it('shows delete and snapshot buttons', () => {
    render(<HistoryPanel />);
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /snapshot/i })).toBeInTheDocument();
  });
});
