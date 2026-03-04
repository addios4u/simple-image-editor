import type { AIProvider } from '../state/aiStore';

/** DALL-E 3 supported sizes */
const OPENAI_SIZES = ['1024x1024', '1024x1792', '1792x1024'] as const;

/**
 * Pick the best API-compatible image size for the given target dimensions.
 *
 * - OpenAI DALL-E: picks from fixed supported sizes based on aspect ratio.
 * - Google Imagen: passes through the exact dimensions.
 */
export function getBestApiSize(
  targetW: number,
  targetH: number,
  provider: AIProvider,
): string {
  if (provider === 'google') {
    return `${targetW}x${targetH}`;
  }

  // OpenAI: choose by aspect ratio
  // 1792/1024 ≈ 1.75, so use 1.5 as threshold to distinguish square vs landscape/portrait
  const ratio = targetW / targetH;
  if (ratio > 1.5) {
    return '1792x1024'; // landscape
  } else if (ratio < 1 / 1.5) {
    return '1024x1792'; // portrait
  }
  return '1024x1024'; // square-ish
}

/**
 * Parse an API size string like "1024x1024" into {width, height}.
 */
export function parseApiSize(size: string): { width: number; height: number } {
  const [w, h] = size.split('x').map(Number);
  return { width: w, height: h };
}
