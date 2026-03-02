import React, { useState } from 'react';
import { ExportFormat } from '../state/exportStore';

interface FormatDialogProps {
  isOpen: boolean;
  defaultFormat?: ExportFormat;
  onConfirm: (format: ExportFormat, quality: number) => void;
  onCancel: () => void;
}

const FormatDialog: React.FC<FormatDialogProps> = ({
  isOpen,
  defaultFormat = 'png',
  onConfirm,
  onCancel,
}) => {
  const [format, setFormat] = useState<ExportFormat>(defaultFormat);
  const [quality, setQuality] = useState(85);

  if (!isOpen) {
    return null;
  }

  const handleSave = () => {
    onConfirm(format, quality);
  };

  const handleQualityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuality(Number(e.target.value));
  };

  return (
    <div className="format-dialog-overlay" data-testid="format-dialog">
      <div className="format-dialog">
        <h3>Export Format</h3>

        <div className="format-options">
          <label>
            <input
              type="radio"
              name="format"
              value="png"
              checked={format === 'png'}
              onChange={() => setFormat('png')}
              aria-label="PNG"
            />
            PNG (lossless)
          </label>
          <label>
            <input
              type="radio"
              name="format"
              value="jpeg"
              checked={format === 'jpeg'}
              onChange={() => setFormat('jpeg')}
              aria-label="JPEG"
            />
            JPEG (lossy)
          </label>
          <label>
            <input
              type="radio"
              name="format"
              value="gif"
              checked={format === 'gif'}
              onChange={() => setFormat('gif')}
              aria-label="GIF"
            />
            GIF
          </label>
        </div>

        {format === 'jpeg' && (
          <div className="quality-control">
            <label>
              Quality
              <input
                type="range"
                min="1"
                max="100"
                value={quality}
                onChange={handleQualityChange}
                aria-label="Quality"
              />
              <span>{quality}</span>
            </label>
          </div>
        )}

        <div className="file-size-estimate">
          <span>File Size Estimate</span>
          <span className="estimate-value">--</span>
        </div>

        <div className="format-dialog-actions">
          <button className="format-save-btn" onClick={handleSave}>
            Save
          </button>
          <button className="format-cancel-btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default FormatDialog;
