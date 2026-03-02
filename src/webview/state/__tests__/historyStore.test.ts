import { describe, it, expect, beforeEach } from 'vitest';
import { useHistoryStore } from '../historyStore';

describe('historyStore', () => {
  beforeEach(() => {
    useHistoryStore.setState({
      undoStack: [],
      redoStack: [],
      canUndo: false,
      canRedo: false,
    });
    useHistoryStore.getState()._resetCounter();
  });

  it('has correct initial state: empty stacks, canUndo=false, canRedo=false', () => {
    const state = useHistoryStore.getState();
    expect(state.undoStack).toEqual([]);
    expect(state.redoStack).toEqual([]);
    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(false);
  });

  it('pushEdit adds to undo stack and clears redo stack', () => {
    const { pushEdit } = useHistoryStore.getState();

    pushEdit('Brush Stroke');

    const state = useHistoryStore.getState();
    expect(state.undoStack).toHaveLength(1);
    expect(state.undoStack[0].label).toBe('Brush Stroke');
    expect(state.undoStack[0].id).toBeDefined();
    expect(state.undoStack[0].timestamp).toBeGreaterThan(0);
    expect(state.redoStack).toEqual([]);
  });

  it('undo moves top of undo stack to redo stack and returns the edit', () => {
    const { pushEdit } = useHistoryStore.getState();
    pushEdit('Brush Stroke');
    pushEdit('Fill');

    const entry = useHistoryStore.getState().undo();

    expect(entry).not.toBeNull();
    expect(entry!.label).toBe('Fill');

    const state = useHistoryStore.getState();
    expect(state.undoStack).toHaveLength(1);
    expect(state.undoStack[0].label).toBe('Brush Stroke');
    expect(state.redoStack).toHaveLength(1);
    expect(state.redoStack[0].label).toBe('Fill');
  });

  it('redo moves top of redo stack to undo stack and returns the edit', () => {
    const { pushEdit } = useHistoryStore.getState();
    pushEdit('Brush Stroke');
    pushEdit('Fill');
    useHistoryStore.getState().undo();

    const entry = useHistoryStore.getState().redo();

    expect(entry).not.toBeNull();
    expect(entry!.label).toBe('Fill');

    const state = useHistoryStore.getState();
    expect(state.undoStack).toHaveLength(2);
    expect(state.redoStack).toHaveLength(0);
  });

  it('undo on empty stack returns null', () => {
    const entry = useHistoryStore.getState().undo();
    expect(entry).toBeNull();

    const state = useHistoryStore.getState();
    expect(state.undoStack).toEqual([]);
    expect(state.redoStack).toEqual([]);
  });

  it('redo on empty stack returns null', () => {
    const entry = useHistoryStore.getState().redo();
    expect(entry).toBeNull();

    const state = useHistoryStore.getState();
    expect(state.undoStack).toEqual([]);
    expect(state.redoStack).toEqual([]);
  });

  it('canUndo returns true when undo stack has entries', () => {
    const { pushEdit } = useHistoryStore.getState();

    expect(useHistoryStore.getState().canUndo).toBe(false);

    pushEdit('Brush Stroke');
    expect(useHistoryStore.getState().canUndo).toBe(true);

    useHistoryStore.getState().undo();
    expect(useHistoryStore.getState().canUndo).toBe(false);
  });

  it('canRedo returns true when redo stack has entries', () => {
    const { pushEdit } = useHistoryStore.getState();

    expect(useHistoryStore.getState().canRedo).toBe(false);

    pushEdit('Brush Stroke');
    useHistoryStore.getState().undo();
    expect(useHistoryStore.getState().canRedo).toBe(true);

    useHistoryStore.getState().redo();
    expect(useHistoryStore.getState().canRedo).toBe(false);
  });

  it('undo stack max size is 50 (oldest entry dropped when exceeding)', () => {
    const { pushEdit } = useHistoryStore.getState();

    for (let i = 0; i < 55; i++) {
      pushEdit(`Edit ${i}`);
    }

    const state = useHistoryStore.getState();
    expect(state.undoStack).toHaveLength(50);
    // Oldest entries (0-4) should have been dropped; first entry is Edit 5
    expect(state.undoStack[0].label).toBe('Edit 5');
    expect(state.undoStack[49].label).toBe('Edit 54');
  });

  it('pushEdit after undo clears redo stack (fork behavior)', () => {
    const { pushEdit } = useHistoryStore.getState();
    pushEdit('Edit A');
    pushEdit('Edit B');
    pushEdit('Edit C');

    useHistoryStore.getState().undo(); // undo Edit C
    useHistoryStore.getState().undo(); // undo Edit B

    expect(useHistoryStore.getState().redoStack).toHaveLength(2);

    useHistoryStore.getState().pushEdit('Edit D');

    const state = useHistoryStore.getState();
    expect(state.redoStack).toEqual([]);
    expect(state.undoStack).toHaveLength(2);
    expect(state.undoStack[0].label).toBe('Edit A');
    expect(state.undoStack[1].label).toBe('Edit D');
  });

  it('getHistory returns all undo entries in order', () => {
    const { pushEdit } = useHistoryStore.getState();
    pushEdit('Edit A');
    pushEdit('Edit B');
    pushEdit('Edit C');

    const history = useHistoryStore.getState().getHistory();

    expect(history).toHaveLength(3);
    expect(history[0].label).toBe('Edit A');
    expect(history[1].label).toBe('Edit B');
    expect(history[2].label).toBe('Edit C');
  });

  it('goToEntry jumps to a specific history point', () => {
    const { pushEdit } = useHistoryStore.getState();
    pushEdit('Edit A');
    pushEdit('Edit B');
    pushEdit('Edit C');
    pushEdit('Edit D');

    // Get the id of Edit B (index 1 in undo stack)
    const editBId = useHistoryStore.getState().undoStack[1].id;

    useHistoryStore.getState().goToEntry(editBId);

    const state = useHistoryStore.getState();
    // Undo stack should have entries up to and including Edit B
    expect(state.undoStack).toHaveLength(2);
    expect(state.undoStack[0].label).toBe('Edit A');
    expect(state.undoStack[1].label).toBe('Edit B');
    // Redo stack should have Edit C and Edit D (most recent undone first)
    expect(state.redoStack).toHaveLength(2);
    expect(state.redoStack[0].label).toBe('Edit D');
    expect(state.redoStack[1].label).toBe('Edit C');
  });

  it('goToEntry from redo stack moves entries back to undo stack', () => {
    const { pushEdit } = useHistoryStore.getState();
    pushEdit('Edit A');
    pushEdit('Edit B');
    pushEdit('Edit C');

    // Undo all three
    useHistoryStore.getState().undo();
    useHistoryStore.getState().undo();
    useHistoryStore.getState().undo();

    // Now redo stack has [C, B, A] (most recent undone first)
    // Go to Edit B in redo stack
    const editBId = useHistoryStore.getState().redoStack[1].id;

    useHistoryStore.getState().goToEntry(editBId);

    const state = useHistoryStore.getState();
    // Undo stack should have Edit A and Edit B
    expect(state.undoStack).toHaveLength(2);
    expect(state.undoStack[0].label).toBe('Edit A');
    expect(state.undoStack[1].label).toBe('Edit B');
    // Redo stack should have Edit C
    expect(state.redoStack).toHaveLength(1);
    expect(state.redoStack[0].label).toBe('Edit C');
  });
});
