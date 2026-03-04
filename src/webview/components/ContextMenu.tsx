import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

export type ContextMenuAction = 'copy' | 'paste' | 'clear' | 'crop' | 'freeTransform' | 'fill' | 'stroke';

export interface ContextMenuProps {
  x: number;
  y: number;
  hasSelection: boolean;
  onClose: () => void;
  onAction: (action: ContextMenuAction) => void;
}

interface MenuItem {
  type: 'item';
  label: string;
  action: ContextMenuAction;
}

interface MenuDivider {
  type: 'divider';
}

type MenuEntry = MenuItem | MenuDivider;

const MENU_WIDTH = 160;
const ITEM_HEIGHT = 28; // padding 6px top + bottom + font line
const DIVIDER_HEIGHT = 9;

function buildMenuItems(hasSelection: boolean): MenuEntry[] {
  if (hasSelection) {
    return [
      { type: 'item', label: 'Copy', action: 'copy' },
      { type: 'item', label: 'Paste', action: 'paste' },
      { type: 'divider' },
      { type: 'item', label: 'Clear', action: 'clear' },
      { type: 'item', label: 'Crop', action: 'crop' },
      { type: 'item', label: 'Free Transform', action: 'freeTransform' },
      { type: 'divider' },
      { type: 'item', label: 'Fill', action: 'fill' },
      { type: 'item', label: 'Stroke', action: 'stroke' },
    ];
  }
  return [{ type: 'item', label: 'Paste', action: 'paste' }];
}

function estimateMenuHeight(entries: MenuEntry[]): number {
  return entries.reduce((acc, e) => acc + (e.type === 'divider' ? DIVIDER_HEIGHT : ITEM_HEIGHT), 8); // 8px = 4px top + 4px bottom padding
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, hasSelection, onClose, onAction }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const entries = buildMenuItems(hasSelection);

  // Adjust position so the menu stays within the viewport
  const menuHeight = estimateMenuHeight(entries);
  const adjustedX = Math.min(x, window.innerWidth - MENU_WIDTH - 4);
  const adjustedY = Math.min(y, window.innerHeight - menuHeight - 4);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const menu = (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: adjustedX,
        top: adjustedY,
        zIndex: 9999,
        background: '#2d2d2d',
        border: '1px solid #444444',
        borderRadius: 4,
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
        minWidth: MENU_WIDTH,
        padding: '4px 0',
        userSelect: 'none',
      }}
    >
      {entries.map((entry, idx) => {
        if (entry.type === 'divider') {
          return (
            <div
              key={idx}
              style={{
                height: 1,
                background: '#444444',
                margin: '4px 0',
              }}
            />
          );
        }
        return (
          <button
            key={idx}
            onMouseDown={(e) => {
              e.stopPropagation();
              onAction(entry.action);
            }}
            style={{
              display: 'block',
              width: '100%',
              padding: '6px 12px',
              background: 'transparent',
              border: 'none',
              color: '#cccccc',
              fontSize: 12,
              fontFamily: 'inherit',
              textAlign: 'left',
              cursor: 'pointer',
              boxSizing: 'border-box',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#0066cc';
              (e.currentTarget as HTMLButtonElement).style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.color = '#cccccc';
            }}
          >
            {entry.label}
          </button>
        );
      })}
    </div>
  );

  return ReactDOM.createPortal(menu, document.body);
};

export default ContextMenu;
