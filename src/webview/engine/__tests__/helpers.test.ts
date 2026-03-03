import { describe, it, expect } from 'vitest';
import { hexToPackedRGBA } from '../helpers';

describe('hexToPackedRGBA', () => {
  it('converts #FF0000 to red with full alpha', () => {
    // 0xFF0000FF = (255 << 24) | (0 << 16) | (0 << 8) | 255
    expect(hexToPackedRGBA('#FF0000')).toBe(0xFF0000FF >>> 0);
  });

  it('converts #00FF00 to green with full alpha', () => {
    expect(hexToPackedRGBA('#00FF00')).toBe(0x00FF00FF >>> 0);
  });

  it('converts #0000FF to blue with full alpha', () => {
    expect(hexToPackedRGBA('#0000FF')).toBe(0x0000FFFF >>> 0);
  });

  it('converts #000000 to black with full alpha', () => {
    expect(hexToPackedRGBA('#000000')).toBe(0x000000FF >>> 0);
  });

  it('converts #FFFFFF to white with full alpha', () => {
    expect(hexToPackedRGBA('#FFFFFF')).toBe(0xFFFFFFFF >>> 0);
  });

  it('handles 8-digit hex with explicit alpha', () => {
    expect(hexToPackedRGBA('#FF000080')).toBe(0xFF000080 >>> 0);
  });

  it('handles lowercase hex', () => {
    expect(hexToPackedRGBA('#ff0000')).toBe(0xFF0000FF >>> 0);
  });
});
