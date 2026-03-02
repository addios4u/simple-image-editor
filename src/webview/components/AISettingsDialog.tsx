import React, { useState, useCallback } from 'react';
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
    <div className="ai-settings-dialog" data-testid="ai-settings-dialog">
      <div className="ai-settings-title">
        Configure {provider} API Key
      </div>

      <label htmlFor="ai-api-key">API Key</label>
      <input
        id="ai-api-key"
        data-testid="ai-api-key-input"
        type="password"
        value={apiKey}
        onChange={handleKeyChange}
        placeholder="Enter your API key"
      />

      <div className="ai-settings-actions">
        <button onClick={handleSave}>Save</button>
        <button onClick={onCancel}>Cancel</button>
        <button onClick={onRemove}>Remove Key</button>
      </div>
    </div>
  );
};

export default AISettingsDialog;
