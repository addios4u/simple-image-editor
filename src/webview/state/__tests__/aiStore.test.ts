import { describe, it, expect, beforeEach } from 'vitest';
import { useAIStore } from '../aiStore';

describe('aiStore', () => {
  beforeEach(() => {
    useAIStore.setState({
      provider: 'openai',
      prompt: '',
      isGenerating: false,
      error: null,
      result: null,
    });
  });

  it('initial state: provider is openai, prompt is empty, isGenerating is false, error is null, result is null', () => {
    const state = useAIStore.getState();
    expect(state.provider).toBe('openai');
    expect(state.prompt).toBe('');
    expect(state.isGenerating).toBe(false);
    expect(state.error).toBeNull();
    expect(state.result).toBeNull();
  });

  it('setProvider changes provider', () => {
    useAIStore.getState().setProvider('google');
    expect(useAIStore.getState().provider).toBe('google');

    useAIStore.getState().setProvider('openai');
    expect(useAIStore.getState().provider).toBe('openai');
  });

  it('setPrompt updates prompt text', () => {
    useAIStore.getState().setPrompt('a cat in space');
    expect(useAIStore.getState().prompt).toBe('a cat in space');

    useAIStore.getState().setPrompt('');
    expect(useAIStore.getState().prompt).toBe('');
  });

  it('setGenerating toggles loading state', () => {
    useAIStore.getState().setGenerating(true);
    expect(useAIStore.getState().isGenerating).toBe(true);

    useAIStore.getState().setGenerating(false);
    expect(useAIStore.getState().isGenerating).toBe(false);
  });

  it('setResult stores generated image data', () => {
    useAIStore.getState().setResult('base64ImageData');
    expect(useAIStore.getState().result).toBe('base64ImageData');
  });

  it('setError stores error message', () => {
    useAIStore.getState().setError('Something went wrong');
    expect(useAIStore.getState().error).toBe('Something went wrong');
  });

  it('clearResult resets result and error', () => {
    useAIStore.getState().setResult('someData');
    useAIStore.getState().setError('someError');

    useAIStore.getState().clearResult();

    const state = useAIStore.getState();
    expect(state.result).toBeNull();
    expect(state.error).toBeNull();
  });

  it('startGeneration sets isGenerating=true and clears previous error', () => {
    useAIStore.getState().setError('old error');
    expect(useAIStore.getState().error).toBe('old error');

    useAIStore.getState().startGeneration();

    const state = useAIStore.getState();
    expect(state.isGenerating).toBe(true);
    expect(state.error).toBeNull();
  });
});
