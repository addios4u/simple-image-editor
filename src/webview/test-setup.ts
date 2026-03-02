import '@testing-library/jest-dom';

// Provide a mock acquireVsCodeApi for tests that import vscode.ts
(globalThis as any).acquireVsCodeApi = () => ({
  postMessage: () => {},
  getState: () => undefined,
  setState: (s: any) => s,
});
