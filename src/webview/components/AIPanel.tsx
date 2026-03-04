import React, { useState, useCallback } from 'react';
import { Sparkles, Settings } from 'lucide-react';
import { useAIStore, AIProvider } from '../state/aiStore';
import { useEditorStore } from '../state/editorStore';
import { getBestApiSize } from '../utils/aiSizeUtils';
import vscodeApi from '../vscode';
import AISettingsDialog from './AISettingsDialog';

const AIPanel: React.FC = () => {
  const provider = useAIStore((s) => s.provider);
  const prompt = useAIStore((s) => s.prompt);
  const isGenerating = useAIStore((s) => s.isGenerating);
  const error = useAIStore((s) => s.error);
  const setProvider = useAIStore((s) => s.setProvider);
  const setPrompt = useAIStore((s) => s.setPrompt);
  const startGeneration = useAIStore((s) => s.startGeneration);
  const setGenerationContext = useAIStore((s) => s.setGenerationContext);

  const selection = useEditorStore((s) => s.selection);
  const canvasWidth = useEditorStore((s) => s.canvasWidth);
  const canvasHeight = useEditorStore((s) => s.canvasHeight);

  const [showSettings, setShowSettings] = useState(false);

  // Determine target size from selection or canvas
  const targetWidth = selection ? selection.width : canvasWidth;
  const targetHeight = selection ? selection.height : canvasHeight;
  const sizeSource = selection ? 'selection' : 'canvas';

  const handleGenerate = useCallback(() => {
    const tw = selection ? selection.width : canvasWidth;
    const th = selection ? selection.height : canvasHeight;
    const sx = selection ? selection.x : 0;
    const sy = selection ? selection.y : 0;
    const apiSize = getBestApiSize(tw, th, provider);

    setGenerationContext({
      targetWidth: tw,
      targetHeight: th,
      selectionX: sx,
      selectionY: sy,
      apiSize,
    });

    startGeneration();
    vscodeApi.postMessage({
      type: 'aiGenerate',
      body: {
        prompt,
        provider,
        size: apiSize,
      },
    });
  }, [prompt, provider, startGeneration, setGenerationContext, selection, canvasWidth, canvasHeight]);

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

        <div className="ai-size-info" data-testid="ai-size-info">
          Size: {targetWidth} × {targetHeight} ({sizeSource})
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
