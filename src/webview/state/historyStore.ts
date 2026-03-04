import { create } from 'zustand';
import type { WasmRegionSnapshot } from '../engine/wasmBridge';
import { restoreLayerRegion, requestRender } from '../engine/engineContext';
import { getSelectionMask } from '../engine/selectionMask';

/** Restore mask state from a snapshot Uint8Array. */
function restoreMaskFromSnapshot(maskData: Uint8Array): void {
  const mask = getSelectionMask();
  if (mask) {
    mask.restore(maskData);
  }
}

const MAX_HISTORY = 50;

export interface HistoryEntry {
  id: string;
  label: string;
  timestamp: number;
}

export interface SnapshotData {
  layerId: string;
  region: { x: number; y: number; w: number; h: number };
  before: WasmRegionSnapshot;
  after?: WasmRegionSnapshot;
  maskBefore?: Uint8Array;
  maskAfter?: Uint8Array;
}

/**
 * External snapshot store — WASM objects are not serializable so they live
 * outside Zustand.  Keyed by HistoryEntry.id.
 */
const snapshotStore = new Map<string, SnapshotData>();

/** Expose the snapshot store for testing only. */
export function _getSnapshotStore(): Map<string, SnapshotData> {
  return snapshotStore;
}

/** Free and remove snapshots for a list of entry ids. */
function freeSnapshots(ids: string[]): void {
  for (const id of ids) {
    const snap = snapshotStore.get(id);
    if (snap) {
      snap.before.free();
      snap.after?.free();
      snapshotStore.delete(id);
    }
  }
}

interface HistoryState {
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  canUndo: boolean;
  canRedo: boolean;
  // Actions
  pushEdit: (label: string) => void;
  pushEditWithSnapshot: (
    label: string,
    layerId: string,
    before: WasmRegionSnapshot,
    region: { x: number; y: number; w: number; h: number },
    maskBefore?: Uint8Array,
  ) => string;
  commitSnapshot: (entryId: string, after: WasmRegionSnapshot, maskAfter?: Uint8Array) => void;
  undo: () => HistoryEntry | null;
  redo: () => HistoryEntry | null;
  getHistory: () => HistoryEntry[];
  goToEntry: (id: string) => void;
  clear: () => void;
  /** Reset the internal ID counter. For test isolation only. */
  _resetCounter: () => void;
}

let nextId = 1;

export const useHistoryStore = create<HistoryState>((set, get) => ({
  undoStack: [],
  redoStack: [],
  canUndo: false,
  canRedo: false,

  pushEdit: (label) =>
    set((state) => {
      const entry: HistoryEntry = {
        id: `history-${nextId++}`,
        label,
        timestamp: Date.now(),
      };
      let undoStack = [...state.undoStack, entry];

      // Free snapshots for entries cleared from redo stack (fork)
      const clearedRedoIds = state.redoStack.map((e) => e.id);
      if (clearedRedoIds.length > 0) {
        freeSnapshots(clearedRedoIds);
      }

      // Handle overflow: free snapshots of oldest dropped entries
      if (undoStack.length > MAX_HISTORY) {
        const dropped = undoStack.slice(0, undoStack.length - MAX_HISTORY);
        freeSnapshots(dropped.map((e) => e.id));
        undoStack = undoStack.slice(undoStack.length - MAX_HISTORY);
      }
      return {
        undoStack,
        redoStack: [],
        canUndo: undoStack.length > 0,
        canRedo: false,
      };
    }),

  pushEditWithSnapshot: (label, layerId, before, region, maskBefore?) => {
    const entryId = `history-${nextId++}`;
    const entry: HistoryEntry = {
      id: entryId,
      label,
      timestamp: Date.now(),
    };

    // Store snapshot externally
    snapshotStore.set(entryId, { layerId, region, before, maskBefore });

    set((state) => {
      let undoStack = [...state.undoStack, entry];

      // Free snapshots for entries cleared from redo stack (fork)
      const clearedRedoIds = state.redoStack.map((e) => e.id);
      if (clearedRedoIds.length > 0) {
        freeSnapshots(clearedRedoIds);
      }

      // Handle overflow
      if (undoStack.length > MAX_HISTORY) {
        const dropped = undoStack.slice(0, undoStack.length - MAX_HISTORY);
        freeSnapshots(dropped.map((e) => e.id));
        undoStack = undoStack.slice(undoStack.length - MAX_HISTORY);
      }
      return {
        undoStack,
        redoStack: [],
        canUndo: undoStack.length > 0,
        canRedo: false,
      };
    });

    return entryId;
  },

  commitSnapshot: (entryId, after, maskAfter?) => {
    const snap = snapshotStore.get(entryId);
    if (snap) {
      snap.after = after;
      if (maskAfter) {
        snap.maskAfter = maskAfter;
      }
    }
  },

  undo: () => {
    const state = get();
    if (state.undoStack.length === 0) return null;

    const undoStack = [...state.undoStack];
    const entry = undoStack.pop()!;
    const redoStack = [entry, ...state.redoStack];

    // Restore before snapshot if available
    const snap = snapshotStore.get(entry.id);
    if (snap) {
      restoreLayerRegion(snap.layerId, snap.before);
      // Restore mask state if available (selection-move undo)
      if (snap.maskBefore) {
        restoreMaskFromSnapshot(snap.maskBefore);
      }
      requestRender();
    }

    set({
      undoStack,
      redoStack,
      canUndo: undoStack.length > 0,
      canRedo: true,
    });

    return entry;
  },

  redo: () => {
    const state = get();
    if (state.redoStack.length === 0) return null;

    const redoStack = [...state.redoStack];
    const entry = redoStack.shift()!;
    const undoStack = [...state.undoStack, entry];

    // Restore after snapshot if available
    const snap = snapshotStore.get(entry.id);
    if (snap?.after) {
      restoreLayerRegion(snap.layerId, snap.after);
      // Restore mask state if available (selection-move redo)
      if (snap.maskAfter) {
        restoreMaskFromSnapshot(snap.maskAfter);
      }
      requestRender();
    }

    set({
      undoStack,
      redoStack,
      canUndo: true,
      canRedo: redoStack.length > 0,
    });

    return entry;
  },

  getHistory: () => {
    return [...get().undoStack];
  },

  goToEntry: (id) =>
    set((state) => {
      // Check if the entry is in the undo stack
      const undoIndex = state.undoStack.findIndex((e) => e.id === id);
      if (undoIndex !== -1) {
        // Keep entries up to and including the target
        const newUndo = state.undoStack.slice(0, undoIndex + 1);
        // Move entries after the target to redo stack (reversed, most recent first)
        const movedToRedo = state.undoStack.slice(undoIndex + 1).reverse();
        const newRedo = [...movedToRedo, ...state.redoStack];
        return {
          undoStack: newUndo,
          redoStack: newRedo,
          canUndo: newUndo.length > 0,
          canRedo: newRedo.length > 0,
        };
      }

      // Check if the entry is in the redo stack
      const redoIndex = state.redoStack.findIndex((e) => e.id === id);
      if (redoIndex !== -1) {
        const movedToUndo = state.redoStack.slice(0, redoIndex + 1);
        const newUndo = [...state.undoStack, ...movedToUndo];
        const newRedo = state.redoStack.slice(redoIndex + 1);
        return {
          undoStack: newUndo,
          redoStack: newRedo,
          canUndo: newUndo.length > 0,
          canRedo: newRedo.length > 0,
        };
      }

      // Entry not found, no change
      return state;
    }),

  clear: () => {
    // Free all snapshots
    const state = get();
    const allIds = [
      ...state.undoStack.map((e) => e.id),
      ...state.redoStack.map((e) => e.id),
    ];
    freeSnapshots(allIds);

    set({
      undoStack: [],
      redoStack: [],
      canUndo: false,
      canRedo: false,
    });
  },

  _resetCounter: () => {
    nextId = 1;
  },
}));
