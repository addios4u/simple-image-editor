import { describe, it, expect } from 'vitest';
import { getBestApiSize } from '../aiSizeUtils';

describe('getBestApiSize', () => {
  describe('openai provider', () => {
    it('returns 1024x1024 for square-ish canvas', () => {
      expect(getBestApiSize(800, 600, 'openai')).toBe('1024x1024');
    });

    it('returns 1024x1792 for tall portrait aspect ratio', () => {
      // height/width > 1.5 → portrait
      expect(getBestApiSize(400, 800, 'openai')).toBe('1024x1792');
    });

    it('returns 1792x1024 for wide landscape aspect ratio', () => {
      // width/height > 1.5 → landscape
      expect(getBestApiSize(800, 400, 'openai')).toBe('1792x1024');
    });

    it('returns 1024x1024 for exact square', () => {
      expect(getBestApiSize(500, 500, 'openai')).toBe('1024x1024');
    });

    it('returns 1024x1024 for borderline aspect ratio (1.2:1)', () => {
      // Not extreme enough for landscape
      expect(getBestApiSize(600, 500, 'openai')).toBe('1024x1024');
    });

    it('handles very small dimensions', () => {
      expect(getBestApiSize(50, 50, 'openai')).toBe('1024x1024');
    });

    it('handles very large dimensions', () => {
      expect(getBestApiSize(4000, 3000, 'openai')).toBe('1024x1024');
    });
  });

  describe('google provider', () => {
    it('returns WxH string for arbitrary dimensions', () => {
      expect(getBestApiSize(800, 600, 'google')).toBe('800x600');
    });

    it('returns WxH string for small dimensions', () => {
      expect(getBestApiSize(256, 256, 'google')).toBe('256x256');
    });

    it('returns WxH string for portrait dimensions', () => {
      expect(getBestApiSize(400, 700, 'google')).toBe('400x700');
    });
  });
});
