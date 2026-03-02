import React from 'react';
import { useHistoryStore } from '../state/historyStore';

const HistoryPanel: React.FC = () => {
  const undoStack = useHistoryStore((s) => s.undoStack);
  const redoStack = useHistoryStore((s) => s.redoStack);
  const canUndo = useHistoryStore((s) => s.canUndo);
  const canRedo = useHistoryStore((s) => s.canRedo);
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);
  const goToEntry = useHistoryStore((s) => s.goToEntry);

  // Current position is the last entry in the undo stack
  const currentId = undoStack.length > 0 ? undoStack[undoStack.length - 1].id : null;

  return (
    <div className="sidebar-section" data-testid="history-panel">
      <div className="sidebar-section-title">History</div>
      <div className="history-actions">
        <button
          className="toolbar-btn"
          onClick={undo}
          disabled={!canUndo}
          aria-label="Undo"
        >
          ↩
        </button>
        <button
          className="toolbar-btn"
          onClick={redo}
          disabled={!canRedo}
          aria-label="Redo"
        >
          ↪
        </button>
      </div>
      <div className="history-list">
        {undoStack.map((entry) => (
          <div
            key={entry.id}
            className={`history-entry${entry.id === currentId ? ' active' : ''}`}
            data-testid={`history-entry-${entry.id}`}
            onClick={() => goToEntry(entry.id)}
          >
            <span className="history-entry-label">{entry.label}</span>
          </div>
        ))}
        {redoStack.slice().reverse().map((entry) => (
          <div
            key={entry.id}
            className="history-entry dimmed"
            data-testid={`history-entry-${entry.id}`}
            onClick={() => goToEntry(entry.id)}
          >
            <span className="history-entry-label">{entry.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HistoryPanel;
