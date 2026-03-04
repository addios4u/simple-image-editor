import React, { useState, useCallback } from 'react';
import { Sparkles, Settings, Layers } from 'lucide-react';
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
    <div className="ai-panel" data-testid="ai-panel">
      <div className="ai-body">
        <div className="ai-section-title">AI Image Generation</div>

        <div className="ai-field-group">
          <label className="ai-field-label" htmlFor="ai-provider">Provider</label>
          <select
            id="ai-provider"
            className="ai-select"
            data-testid="ai-provider-select"
            value={provider}
            onChange={handleProviderChange}
          >
            <option value="openai">OpenAI DALL-E</option>
            <option value="google">Google Imagen</option>
          </select>
        </div>

        <div className="ai-field-group">
          <label className="ai-field-label" htmlFor="ai-prompt">Prompt</label>
          <textarea
            id="ai-prompt"
            className="ai-textarea"
            data-testid="ai-prompt-input"
            value={prompt}
            onChange={handlePromptChange}
            placeholder="Describe the image you want to generate..."
            rows={4}
          />
        </div>

        <div className="ai-btn-row">
          <button
            className="ai-generate-btn"
            data-testid="ai-generate-btn"
            onClick={handleGenerate}
            disabled={isGenerating || prompt.trim() === ''}
          >
            <Sparkles size={14} />
            {isGenerating ? 'Generating...' : 'Generate'}
          </button>
          <button
            className="ai-settings-btn"
            data-testid="ai-settings-btn"
            onClick={() => setShowSettings(true)}
            title="Configure API Key"
            aria-label="Settings"
          >
            <Settings size={16} />
          </button>
        </div>

        {error && (
          <div className="ai-error" data-testid="ai-error">
            {error}
          </div>
        )}

        {result && (
          <div className="ai-result">
            <span className="ai-field-label">Result</span>
            <img
              data-testid="ai-result-preview"
              src={`data:image/png;base64,${result}`}
              alt="AI generated preview"
              className="ai-preview-image"
            />
            <button className="ai-apply-btn" onClick={handleApplyToCanvas}>
              <Layers size={14} />
              Apply to Canvas
            </button>
          </div>
        )}
      </div>

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
