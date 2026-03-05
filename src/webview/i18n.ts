import { config, t as l10nT } from '@vscode/l10n';

declare global {
  interface Window {
    __l10nBundle__: Record<string, string | { message: string; comment: string[] }> | undefined;
  }
}

// Extension host가 HTML에 주입한 번들로 초기화
if (typeof window !== 'undefined' && window.__l10nBundle__) {
  config({ contents: window.__l10nBundle__ });
}

export function t(message: string, ...args: Array<string | number | boolean>): string {
  return l10nT(message, ...args);
}
