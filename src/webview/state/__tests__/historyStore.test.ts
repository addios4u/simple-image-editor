import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockRestoreLayerRegion = vi.fn();
const mockRequestRender = vi.fn();

vi.mock('../../engine/engineContext', () => ({
  restoreLayerRegion: (...args: unknown[]) => mockRestoreLayerRegion(...args),
  requestRender: (...args: unknown[]) => mockRequestRender(...args),
}));

import { useHistoryStore, _getSnapshotStore } from '../historyStore';

describe('historyStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useHistoryStore.getState().clear();
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

  // ---------------------------------------------------------------
  // Snapshot-aware undo/redo (Phase D-1)
  // ---------------------------------------------------------------

  function mockSnapshot(tag: string) {
    return {
      x: () => 0,
      y: () => 0,
      width: () => 10,
      height: () => 10,
      free: vi.fn(),
      _tag: tag,
    } as any;
  }

  describe('pushEditWithSnapshot / commitSnapshot', () => {
    it('stores before and after snapshots externally', () => {
      const before = mockSnapshot('before-1');
      const after = mockSnapshot('after-1');

      const id = useHistoryStore.getState().pushEditWithSnapshot(
        'Brush Stroke', 'layer-1', before,
        { x: 0, y: 0, w: 10, h: 10 },
      );
      useHistoryStore.getState().commitSnapshot(id, after);

      const snapshots = _getSnapshotStore();
      expect(snapshots.has(id)).toBe(true);
      const snap = snapshots.get(id)!;
      expect(snap.before).toBe(before);
      expect(snap.after).toBe(after);
      expect(snap.layerId).toBe('layer-1');
    });

    it('pushEditWithSnapshot adds entry to undo stack', () => {
      const before = mockSnapshot('before-1');

      useHistoryStore.getState().pushEditWithSnapshot(
        'Fill', 'layer-1', before,
        { x: 0, y: 0, w: 10, h: 10 },
      );

      const state = useHistoryStore.getState();
      expect(state.undoStack).toHaveLength(1);
      expect(state.undoStack[0].label).toBe('Fill');
      expect(state.canUndo).toBe(true);
    });
  });

  describe('undo with snapshots', () => {
    it('restores before snapshot and calls requestRender', () => {
      const before = mockSnapshot('before-1');
      const after = mockSnapshot('after-1');

      const id = useHistoryStore.getState().pushEditWithSnapshot(
        'Brush', 'layer-1', before, { x: 0, y: 0, w: 10, h: 10 },
      );
      useHistoryStore.getState().commitSnapshot(id, after);

      useHistoryStore.getState().undo();

      expect(mockRestoreLayerRegion).toHaveBeenCalledWith('layer-1', before);
      expect(mockRequestRender).toHaveBeenCalledTimes(1);
    });

    it('does not call engine when entry has no snapshot', () => {
      useHistoryStore.getState().pushEdit('Simple edit');

      useHistoryStore.getState().undo();

      expect(mockRestoreLayerRegion).not.toHaveBeenCalled();
      expect(mockRequestRender).not.toHaveBeenCalled();
    });
  });

  describe('redo with snapshots', () => {
    it('restores after snapshot and calls requestRender', () => {
      const before = mockSnapshot('before-1');
      const after = mockSnapshot('after-1');

      const id = useHistoryStore.getState().pushEditWithSnapshot(
        'Brush', 'layer-1', before, { x: 0, y: 0, w: 10, h: 10 },
      );
      useHistoryStore.getState().commitSnapshot(id, after);

      useHistoryStore.getState().undo();
      vi.clearAllMocks();

      useHistoryStore.getState().redo();

      expect(mockRestoreLayerRegion).toHaveBeenCalledWith('layer-1', after);
      expect(mockRequestRender).toHaveBeenCalledTimes(1);
    });
  });

  describe('clear with snapshots', () => {
    it('frees all snapshots and empties the external store', () => {
      const before1 = mockSnapshot('b1');
      const after1 = mockSnapshot('a1');
      const before2 = mockSnapshot('b2');
      const after2 = mockSnapshot('a2');

      const id1 = useHistoryStore.getState().pushEditWithSnapshot(
        'Edit 1', 'layer-1', before1, { x: 0, y: 0, w: 10, h: 10 },
      );
      useHistoryStore.getState().commitSnapshot(id1, after1);

      const id2 = useHistoryStore.getState().pushEditWithSnapshot(
        'Edit 2', 'layer-1', before2, { x: 0, y: 0, w: 10, h: 10 },
      );
      useHistoryStore.getState().commitSnapshot(id2, after2);

      useHistoryStore.getState().clear();

      expect(before1.free).toHaveBeenCalled();
      expect(after1.free).toHaveBeenCalled();
      expect(before2.free).toHaveBeenCalled();
      expect(after2.free).toHaveBeenCalled();

      const snapshots = _getSnapshotStore();
      expect(snapshots.size).toBe(0);
    });
  });

  describe('pushEditWithSnapshot overflow frees oldest snapshots', () => {
    it('frees snapshots of dropped entries when undo stack exceeds MAX_HISTORY', () => {
      const droppedBefore = mockSnapshot('dropped-before');
      const droppedAfter = mockSnapshot('dropped-after');

      // Push the first entry with snapshot (this will be dropped later)
      const id = useHistoryStore.getState().pushEditWithSnapshot(
        'Edit 0', 'layer-1', droppedBefore, { x: 0, y: 0, w: 10, h: 10 },
      );
      useHistoryStore.getState().commitSnapshot(id, droppedAfter);

      // Push 50 more (metadata-only) to overflow the stack
      for (let i = 1; i <= 50; i++) {
        useHistoryStore.getState().pushEdit(`Edit ${i}`);
      }

      // The first entry should have been dropped, and its snapshots freed
      expect(droppedBefore.free).toHaveBeenCalled();
      expect(droppedAfter.free).toHaveBeenCalled();

      const snapshots = _getSnapshotStore();
      expect(snapshots.has(id)).toBe(false);
    });
  });

  describe('pushEdit after undo frees orphaned redo snapshots', () => {
    it('frees snapshots of entries cleared from redo stack on fork', () => {
      const before = mockSnapshot('before-fork');
      const after = mockSnapshot('after-fork');

      const id = useHistoryStore.getState().pushEditWithSnapshot(
        'Will be undone', 'layer-1', before, { x: 0, y: 0, w: 10, h: 10 },
      );
      useHistoryStore.getState().commitSnapshot(id, after);

      // Undo moves entry to redo stack
      useHistoryStore.getState().undo();
      expect(before.free).not.toHaveBeenCalled();
      expect(after.free).not.toHaveBeenCalled();

      // New edit forks: redo stack cleared → orphaned snapshots freed
      useHistoryStore.getState().pushEdit('Fork edit');

      expect(before.free).toHaveBeenCalled();
      expect(after.free).toHaveBeenCalled();
      expect(_getSnapshotStore().has(id)).toBe(false);
    });
  });
});
