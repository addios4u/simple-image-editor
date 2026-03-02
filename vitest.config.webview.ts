import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: [
      'src/webview/**/*.test.ts',
      'src/webview/**/*.test.tsx'
    ],
    globals: true,
    setupFiles: ['./src/webview/test-setup.ts']
  }
});
