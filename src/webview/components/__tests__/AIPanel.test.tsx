import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import AIPanel from '../AIPanel';
import { useAIStore } from '../../state/aiStore';

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

  it('renders result preview when result exists', () => {
    useAIStore.setState({ result: 'base64TestData' });
    render(<AIPanel />);
    const img = screen.getByTestId('ai-result-preview') as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.src).toContain('base64TestData');
  });

  it('renders "Apply to Canvas" button when result exists', () => {
    useAIStore.setState({ result: 'base64TestData' });
    render(<AIPanel />);
    expect(screen.getByRole('button', { name: /apply to canvas/i })).toBeInTheDocument();
  });

  it('does not render "Apply to Canvas" button when no result', () => {
    render(<AIPanel />);
    expect(screen.queryByRole('button', { name: /apply to canvas/i })).not.toBeInTheDocument();
  });

  it('renders settings/configure button for API key', () => {
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
});
