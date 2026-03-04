import { create } from 'zustand';

export type AIProvider = 'openai' | 'google';

export interface GenerationContext {
  targetWidth: number;
  targetHeight: number;
  selectionX: number;
  selectionY: number;
  apiSize: string;
}

interface AIState {
  provider: AIProvider;
  prompt: string;
  isGenerating: boolean;
  error: string | null;
  result: string | null;
  generationContext: GenerationContext | null;
  // Actions
  setProvider: (provider: AIProvider) => void;
  setPrompt: (prompt: string) => void;
  setGenerating: (generating: boolean) => void;
  setResult: (result: string | null) => void;
  setError: (error: string | null) => void;
  clearResult: () => void;
  startGeneration: () => void;
  setGenerationContext: (ctx: GenerationContext | null) => void;
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
  clearResult: () => set({ result: null, error: null, generationContext: null }),
  startGeneration: () => set({ isGenerating: true, error: null }),
  generationContext: null,
  setGenerationContext: (ctx) => set({ generationContext: ctx }),
}));
