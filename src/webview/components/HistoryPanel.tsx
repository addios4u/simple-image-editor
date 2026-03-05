import React from 'react';
import {
  Undo2, Redo2, Trash2, Camera,
  FileImage, Sun, PenLine, Crop, CircleDot,
  BoxSelect, PaintBucket, SlidersHorizontal, Scaling,
  Type, Move, Eraser, RotateCw, FlipHorizontal2, FlipVertical2,
  Palette, Layers, Circle,
} from 'lucide-react';
import { useHistoryStore } from '../state/historyStore';
import { t } from '../i18n';

/** Map history entry labels to lucide icons by keyword matching. */
const iconKeywords: [RegExp, React.FC<{ size?: number }>][] = [
  [/open/i, FileImage],
  [/brightness|contrast/i, Sun],
  [/brush/i, PenLine],
  [/crop/i, Crop],
  [/blur/i, CircleDot],
  [/marquee|select/i, BoxSelect],
  [/fill/i, PaintBucket],
  [/level/i, SlidersHorizontal],
  [/resize|scale/i, Scaling],
  [/text/i, Type],
  [/move/i, Move],
  [/eras/i, Eraser],
  [/rotat/i, RotateCw],
  [/flip.*horiz/i, FlipHorizontal2],
  [/flip.*vert/i, FlipVertical2],
  [/color|hue|saturat/i, Palette],
  [/layer/i, Layers],
];

function getIconForLabel(label: string): React.FC<{ size?: number }> {
  for (const [pattern, Icon] of iconKeywords) {
    if (pattern.test(label)) return Icon;
  }
  return Circle;
}

const HistoryPanel: React.FC = () => {
  const undoStack = useHistoryStore((s) => s.undoStack);
  const redoStack = useHistoryStore((s) => s.redoStack);
  const canUndo = useHistoryStore((s) => s.canUndo);
  const canRedo = useHistoryStore((s) => s.canRedo);
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);
  const goToEntry = useHistoryStore((s) => s.goToEntry);

  const currentId = undoStack.length > 0 ? undoStack[undoStack.length - 1].id : null;

  return (
    <div className="history-panel" data-testid="history-panel">
      <div className="history-list">
        {undoStack.map((entry) => {
          const Icon = getIconForLabel(entry.label);
          const isCurrent = entry.id === currentId;
          return (
            <div
              key={entry.id}
              className={`history-entry${isCurrent ? ' active' : ''}`}
              data-testid={`history-entry-${entry.id}`}
              onClick={() => goToEntry(entry.id)}
            >
              <Icon size={14} />
              <span className="history-entry-label">{entry.label}</span>
            </div>
          );
        })}
        {redoStack.slice().reverse().map((entry) => {
          const Icon = getIconForLabel(entry.label);
          return (
            <div
              key={entry.id}
              className="history-entry dimmed"
              data-testid={`history-entry-${entry.id}`}
              onClick={() => goToEntry(entry.id)}
            >
              <Icon size={14} />
              <span className="history-entry-label">{entry.label}</span>
            </div>
          );
        })}
      </div>
      <div className="history-divider" />
      <div className="history-actions">
        <button
          className="history-action-btn"
          onClick={undo}
          disabled={!canUndo}
          aria-label={t('Undo')}
        >
          <Undo2 size={14} />
        </button>
        <button
          className="history-action-btn"
          onClick={redo}
          disabled={!canRedo}
          aria-label={t('Redo')}
        >
          <Redo2 size={14} />
        </button>
        <div className="history-action-sep" />
        <button
          className="history-action-btn"
          disabled
          aria-label={t('Delete')}
        >
          <Trash2 size={14} />
        </button>
        <button
          className="history-action-btn"
          disabled
          aria-label={t('Snapshot')}
        >
          <Camera size={14} />
        </button>
      </div>
    </div>
  );
};

export default HistoryPanel;
