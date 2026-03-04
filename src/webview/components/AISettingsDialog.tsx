import React, { useState, useCallback } from 'react';
import { Settings, X, EyeOff, Eye } from 'lucide-react';
import { AIProvider } from '../state/aiStore';

interface AISettingsDialogProps {
  provider: AIProvider;
  onSave: (key: string) => void;
  onCancel: () => void;
  onRemove: () => void;
}

const AISettingsDialog: React.FC<AISettingsDialogProps> = ({
  provider,
  onSave,
  onCancel,
  onRemove,
}) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  const handleSave = useCallback(() => {
    onSave(apiKey);
  }, [apiKey, onSave]);

  const handleKeyChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setApiKey(e.target.value);
    },
    []
  );

  return (
    <div className="ai-settings-overlay" data-testid="ai-settings-dialog">
      <div className="ai-settings-popup">
        <div className="ai-settings-header">
          <div className="ai-settings-header-left">
            <Settings size={16} />
            <span className="ai-settings-header-title">AI Settings</span>
          </div>
          <button
            className="ai-settings-close-btn"
            onClick={onCancel}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div className="ai-settings-divider" />

        <div className="ai-settings-body">
          <div className="ai-settings-field-group">
            <label className="ai-settings-label">Provider</label>
            <div className="ai-settings-provider-display">
              {provider === 'openai' ? 'OpenAI DALL-E' : 'Google Imagen'}
            </div>
          </div>

          <div className="ai-settings-field-group">
            <label className="ai-settings-label" htmlFor="ai-api-key">API Key</label>
            <div className="ai-settings-input-wrapper">
              <input
                id="ai-api-key"
                data-testid="ai-api-key-input"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={handleKeyChange}
                placeholder="Enter your API key"
                className="ai-settings-input"
              />
              <button
                className="ai-settings-eye-btn"
                onClick={() => setShowKey(!showKey)}
                aria-label={showKey ? 'Hide key' : 'Show key'}
                type="button"
              >
                {showKey ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
            </div>
            <span className="ai-settings-hint">
              Key is stored securely in VSCode SecretStorage
            </span>
          </div>
        </div>

        <div className="ai-settings-divider" />

        <div className="ai-settings-footer">
          <button className="ai-settings-remove-btn" onClick={onRemove}>
            Remove Key
          </button>
          <div className="ai-settings-footer-right">
            <button className="ai-settings-cancel-btn" onClick={onCancel}>
              Cancel
            </button>
            <button className="ai-settings-save-btn" onClick={handleSave}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AISettingsDialog;
