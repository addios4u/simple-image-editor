/**
 * Convert a CSS hex color string to a packed RGBA u32.
 *
 * The Rust WASM engine uses packed RGBA in the format 0xRRGGBBAA.
 * Accepts 6-digit (#RRGGBB) or 8-digit (#RRGGBBAA) hex strings.
 */
export function hexToPackedRGBA(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const a = hex.length >= 9 ? parseInt(hex.slice(7, 9), 16) : 255;
  return ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
}
