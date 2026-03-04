import React, { useState } from 'react';
import ReactDOM from 'react-dom';

export interface FillDialogResult {
  color: string;   // hex e.g. '#ff0000'
  opacity: number; // 0–100
}

interface FillDialogProps {
  initialColor: string;
  onConfirm: (result: FillDialogResult) => void;
  onCancel: () => void;
}

const FillDialog: React.FC<FillDialogProps> = ({ initialColor, onConfirm, onCancel }) => {
  const [color, setColor] = useState(initialColor);
  const [opacity, setOpacity] = useState(100);

  const overlay = (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        style={{
          background: '#2d2d2d',
          border: '1px solid #555',
          borderRadius: 6,
          padding: '16px 20px',
          minWidth: 240,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          color: '#ccc',
          fontSize: 12,
          fontFamily: 'inherit',
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14, color: '#eee' }}>Fill</div>

        {/* Color */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ width: 60 }}>Color</span>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            style={{ width: 40, height: 24, padding: 0, border: 'none', cursor: 'pointer', background: 'none' }}
          />
          <input
            type="text"
            value={color}
            onChange={(e) => {
              const v = e.target.value;
              if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setColor(v);
            }}
            style={{
              width: 72, background: '#1e1e1e', border: '1px solid #555',
              borderRadius: 3, color: '#ccc', fontSize: 11, padding: '2px 6px',
            }}
          />
        </label>

        {/* Opacity */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <span style={{ width: 60 }}>Opacity</span>
          <input
            type="range"
            min={0} max={100} value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{ width: 34, textAlign: 'right' }}>{opacity}%</span>
        </label>

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onCancel}
            style={btnStyle('#3c3c3c', '#555')}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm({ color, opacity })}
            style={btnStyle('#0066cc', '#0077ee')}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(overlay, document.body);
};

function btnStyle(bg: string, hover: string): React.CSSProperties {
  return {
    padding: '5px 16px',
    background: bg,
    border: 'none',
    borderRadius: 4,
    color: '#eee',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
  };
}

export default FillDialog;
