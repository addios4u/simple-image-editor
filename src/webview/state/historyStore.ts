import { create } from 'zustand';

const MAX_HISTORY = 50;

export interface HistoryEntry {
  id: string;
  label: string;
  timestamp: number;
}

interface HistoryState {
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  canUndo: boolean;
  canRedo: boolean;
  // Actions
  pushEdit: (label: string) => void;
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
      if (undoStack.length > MAX_HISTORY) {
        undoStack = undoStack.slice(undoStack.length - MAX_HISTORY);
      }
      return {
        undoStack,
        redoStack: [],
        canUndo: undoStack.length > 0,
        canRedo: false,
      };
    }),

  undo: () => {
    const state = get();
    if (state.undoStack.length === 0) return null;

    const undoStack = [...state.undoStack];
    const entry = undoStack.pop()!;
    const redoStack = [entry, ...state.redoStack];

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
        // Redo stack after multiple undos is ordered most-recently-undone first.
        // E.g. after pushing A,B,C then undoing 3 times: redo = [A, B, C].
        // To go to entry at redoIndex: entries 0..redoIndex move to undo stack
        // (they are already in chronological order). Entries after redoIndex stay in redo.
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

  clear: () =>
    set({
      undoStack: [],
      redoStack: [],
      canUndo: false,
      canRedo: false,
    }),

  _resetCounter: () => {
    nextId = 1;
  },
}));
