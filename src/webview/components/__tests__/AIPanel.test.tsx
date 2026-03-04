import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import AIPanel from '../AIPanel';
import { useAIStore } from '../../state/aiStore';
import { useEditorStore } from '../../state/editorStore';

// Mock vscode postMessage
const mockPostMessage = vi.fn();
vi.mock('../../vscode', () => ({
  default: {
    postMessage: (...args: unknown[]) => mockPostMessage(...args),
  },
}));

describe('AIPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAIStore.setState({
      provider: 'openai',
      prompt: '',
      isGenerating: false,
      error: null,
      result: null,
      generationContext: null,
    });
    useEditorStore.setState({
      selection: null,
      canvasWidth: 800,
      canvasHeight: 600,
    });
  });

  it('renders "AI Image Generation" title', () => {
    render(<AIPanel />);
    expect(screen.getByText('AI Image Generation')).toBeInTheDocument();
  });

  it('renders provider selector with OpenAI DALL-E and Google Imagen options', () => {
    render(<AIPanel />);
    const selector = screen.getByTestId('ai-provider-select');
    expect(selector).toBeInTheDocument();

    const options = selector.querySelectorAll('option');
    const optionTexts = Array.from(options).map((o) => o.textContent);
    expect(optionTexts).toContain('OpenAI DALL-E');
    expect(optionTexts).toContain('Google Imagen');
  });

  it('renders prompt textarea', () => {
    render(<AIPanel />);
    const textarea = screen.getByTestId('ai-prompt-input');
    expect(textarea).toBeInTheDocument();
    expect(textarea.tagName.toLowerCase()).toBe('textarea');
  });

  it('renders Generate button', () => {
    render(<AIPanel />);
    expect(screen.getByRole('button', { name: /generate/i })).toBeInTheDocument();
  });

  it('Generate button shows loading state when isGenerating', () => {
    useAIStore.setState({ isGenerating: true });
    render(<AIPanel />);
    const btn = screen.getByTestId('ai-generate-btn');
    expect(btn).toHaveTextContent(/generating/i);
    expect(btn).toBeDisabled();
  });

  it('shows spinner progress indicator when isGenerating', () => {
    useAIStore.setState({ isGenerating: true });
    render(<AIPanel />);
    expect(screen.getByTestId('ai-progress')).toBeInTheDocument();
    expect(screen.getByTestId('ai-progress')).toHaveTextContent('Generating image...');
  });

  it('hides spinner when not generating', () => {
    useAIStore.setState({ isGenerating: false });
    render(<AIPanel />);
    expect(screen.queryByTestId('ai-progress')).not.toBeInTheDocument();
  });

  it('Generate button disabled when prompt is empty', () => {
    useAIStore.setState({ prompt: '' });
    render(<AIPanel />);
    const btn = screen.getByRole('button', { name: /generate/i });
    expect(btn).toBeDisabled();
  });

  it('Generate button enabled when prompt is not empty', () => {
    useAIStore.setState({ prompt: 'a cat' });
    render(<AIPanel />);
    const btn = screen.getByRole('button', { name: /generate/i });
    expect(btn).not.toBeDisabled();
  });

  it('renders error message when error exists', () => {
    useAIStore.setState({ error: 'API key missing' });
    render(<AIPanel />);
    expect(screen.getByTestId('ai-error')).toHaveTextContent('API key missing');
  });

  it('does not render result preview or Apply button (auto-apply mode)', () => {
    useAIStore.setState({ result: 'base64TestData' });
    render(<AIPanel />);
    expect(screen.queryByTestId('ai-result-preview')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /apply to canvas/i })).not.toBeInTheDocument();
  });

  it('renders settings button', () => {
    render(<AIPanel />);
    expect(screen.getByTestId('ai-settings-btn')).toBeInTheDocument();
  });

  it('clicking Generate sends aiGenerate message via postMessage', () => {
    useAIStore.setState({ prompt: 'a beautiful sunset', provider: 'openai' });
    render(<AIPanel />);

    const btn = screen.getByRole('button', { name: /generate/i });
    fireEvent.click(btn);

    expect(mockPostMessage).toHaveBeenCalledWith({
      type: 'aiGenerate',
      body: expect.objectContaining({
        prompt: 'a beautiful sunset',
        provider: 'openai',
        size: expect.any(String),
      }),
    });
  });

  it('changing provider updates the store', () => {
    render(<AIPanel />);
    const selector = screen.getByTestId('ai-provider-select');
    fireEvent.change(selector, { target: { value: 'google' } });
    expect(useAIStore.getState().provider).toBe('google');
  });

  it('typing in prompt textarea updates the store', () => {
    render(<AIPanel />);
    const textarea = screen.getByTestId('ai-prompt-input');
    fireEvent.change(textarea, { target: { value: 'hello world' } });
    expect(useAIStore.getState().prompt).toBe('hello world');
  });

  describe('size display and selection integration', () => {
    it('shows canvas size when no selection', () => {
      useEditorStore.setState({ selection: null, canvasWidth: 800, canvasHeight: 600 });
      render(<AIPanel />);
      expect(screen.getByTestId('ai-size-info')).toHaveTextContent('800 × 600');
      expect(screen.getByTestId('ai-size-info')).toHaveTextContent('canvas');
    });

    it('shows selection size when selection exists', () => {
      useEditorStore.setState({
        selection: { x: 100, y: 50, width: 300, height: 200 },
      });
      render(<AIPanel />);
      expect(screen.getByTestId('ai-size-info')).toHaveTextContent('300 × 200');
      expect(screen.getByTestId('ai-size-info')).toHaveTextContent('selection');
    });

    it('clicking Generate sets generationContext with canvas size when no selection', () => {
      useEditorStore.setState({ selection: null, canvasWidth: 800, canvasHeight: 600 });
      useAIStore.setState({ prompt: 'a cat' });
      render(<AIPanel />);

      fireEvent.click(screen.getByRole('button', { name: /generate/i }));

      const ctx = useAIStore.getState().generationContext;
      expect(ctx).not.toBeNull();
      expect(ctx!.targetWidth).toBe(800);
      expect(ctx!.targetHeight).toBe(600);
      expect(ctx!.selectionX).toBe(0);
      expect(ctx!.selectionY).toBe(0);
    });

    it('clicking Generate sets generationContext with selection info when selection exists', () => {
      useEditorStore.setState({
        selection: { x: 100, y: 50, width: 300, height: 200 },
        canvasWidth: 800,
        canvasHeight: 600,
      });
      useAIStore.setState({ prompt: 'a cat' });
      render(<AIPanel />);

      fireEvent.click(screen.getByRole('button', { name: /generate/i }));

      const ctx = useAIStore.getState().generationContext;
      expect(ctx).not.toBeNull();
      expect(ctx!.targetWidth).toBe(300);
      expect(ctx!.targetHeight).toBe(200);
      expect(ctx!.selectionX).toBe(100);
      expect(ctx!.selectionY).toBe(50);
    });

    it('sends computed apiSize in aiGenerate message', () => {
      useEditorStore.setState({ selection: null, canvasWidth: 800, canvasHeight: 600 });
      useAIStore.setState({ prompt: 'a cat', provider: 'openai' });
      render(<AIPanel />);

      fireEvent.click(screen.getByRole('button', { name: /generate/i }));

      expect(mockPostMessage).toHaveBeenCalledWith({
        type: 'aiGenerate',
        body: expect.objectContaining({
          prompt: 'a cat',
          provider: 'openai',
          size: '1024x1024',
        }),
      });
    });
  });
});
