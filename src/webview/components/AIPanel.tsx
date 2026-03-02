import React, { useState, useCallback } from 'react';
import { useAIStore, AIProvider } from '../state/aiStore';
import vscodeApi from '../vscode';
import AISettingsDialog from './AISettingsDialog';

const AIPanel: React.FC = () => {
  const provider = useAIStore((s) => s.provider);
  const prompt = useAIStore((s) => s.prompt);
  const isGenerating = useAIStore((s) => s.isGenerating);
  const error = useAIStore((s) => s.error);
  const result = useAIStore((s) => s.result);
  const setProvider = useAIStore((s) => s.setProvider);
  const setPrompt = useAIStore((s) => s.setPrompt);
  const startGeneration = useAIStore((s) => s.startGeneration);

  const [showSettings, setShowSettings] = useState(false);

  const handleGenerate = useCallback(() => {
    startGeneration();
    vscodeApi.postMessage({
      type: 'aiGenerate',
      body: {
        prompt,
        provider,
        size: '1024x1024',
      },
    });
  }, [prompt, provider, startGeneration]);

  const handleApplyToCanvas = useCallback(() => {
    if (result) {
      vscodeApi.postMessage({
        type: 'edit',
        body: {
          id: `ai-${Date.now()}`,
          kind: 'addLayer',
          data: { imageData: result },
          timestamp: Date.now(),
        },
      });
    }
  }, [result]);

  const handleProviderChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setProvider(e.target.value as AIProvider);
    },
    [setProvider]
  );

  const handlePromptChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setPrompt(e.target.value);
    },
    [setPrompt]
  );

  const handleSettingsSave = useCallback(
    (key: string) => {
      vscodeApi.postMessage({
        type: 'aiConfigureKey',
        body: { provider, action: 'save', key },
      });
      setShowSettings(false);
    },
    [provider]
  );

  const handleSettingsRemove = useCallback(() => {
    vscodeApi.postMessage({
      type: 'aiConfigureKey',
      body: { provider, action: 'remove' },
    });
    setShowSettings(false);
  }, [provider]);

  return (
    <div className="sidebar-section" data-testid="ai-panel">
      <div className="sidebar-section-title">AI Image Generation</div>

      <div className="ai-controls">
        <label htmlFor="ai-provider">Provider</label>
        <select
          id="ai-provider"
          data-testid="ai-provider-select"
          value={provider}
          onChange={handleProviderChange}
        >
          <option value="openai">OpenAI DALL-E</option>
          <option value="google">Google Imagen</option>
        </select>

        <label htmlFor="ai-prompt">Prompt</label>
        <textarea
          id="ai-prompt"
          data-testid="ai-prompt-input"
          value={prompt}
          onChange={handlePromptChange}
          placeholder="Describe the image you want to generate..."
          rows={4}
        />

        <div className="ai-actions">
          <button
            data-testid="ai-generate-btn"
            onClick={handleGenerate}
            disabled={isGenerating || prompt.trim() === ''}
          >
            {isGenerating ? 'Generating...' : 'Generate'}
          </button>
          <button
            data-testid="ai-settings-btn"
            onClick={() => setShowSettings(true)}
            title="Configure API Key"
          >
            Settings
          </button>
        </div>
      </div>

      {error && (
        <div className="ai-error" data-testid="ai-error">
          {error}
        </div>
      )}

      {result && (
        <div className="ai-result">
          <img
            data-testid="ai-result-preview"
            src={`data:image/png;base64,${result}`}
            alt="AI generated preview"
            className="ai-preview-image"
          />
          <button onClick={handleApplyToCanvas}>Apply to Canvas</button>
        </div>
      )}

      {showSettings && (
        <AISettingsDialog
          provider={provider}
          onSave={handleSettingsSave}
          onCancel={() => setShowSettings(false)}
          onRemove={handleSettingsRemove}
        />
      )}
    </div>
  );
};

export default AIPanel;
