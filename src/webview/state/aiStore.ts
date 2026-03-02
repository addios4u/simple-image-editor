import { create } from 'zustand';

export type AIProvider = 'openai' | 'google';

interface AIState {
  provider: AIProvider;
  prompt: string;
  isGenerating: boolean;
  error: string | null;
  result: string | null;
  // Actions
  setProvider: (provider: AIProvider) => void;
  setPrompt: (prompt: string) => void;
  setGenerating: (generating: boolean) => void;
  setResult: (result: string | null) => void;
  setError: (error: string | null) => void;
  clearResult: () => void;
  startGeneration: () => void;
}

export const useAIStore = create<AIState>((set) => ({
  provider: 'openai',
  prompt: '',
  isGenerating: false,
  error: null,
  result: null,

  setProvider: (provider) => set({ provider }),
  setPrompt: (prompt) => set({ prompt }),
  setGenerating: (generating) => set({ isGenerating: generating }),
  setResult: (result) => set({ result }),
  setError: (error) => set({ error }),
  clearResult: () => set({ result: null, error: null }),
  startGeneration: () => set({ isGenerating: true, error: null }),
}));
