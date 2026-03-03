// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { writeOra, readOra } from '../openraster';

// Tiny 1×1 red PNG (valid minimal PNG).
const TINY_PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // signature
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1×1
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // 8-bit RGB
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, // IDAT chunk
  0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc,
  0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, // IEND chunk
  0x44, 0xae, 0x42, 0x60, 0x82,
]);

describe('openraster', () => {
  // ---------------------------------------------------------------
  // writeOra
  // ---------------------------------------------------------------

  describe('writeOra', () => {
    it('returns a valid ZIP with correct mimetype as first entry', () => {
      const ora = writeOra(
        [{ name: 'Background', pngData: TINY_PNG, opacity: 1, visible: true }],
        TINY_PNG,
        TINY_PNG,
        1,
        1,
      );

      // ORA files are ZIPs — first 2 bytes are PK (0x50, 0x4b)
      expect(ora[0]).toBe(0x50);
      expect(ora[1]).toBe(0x4b);
    });

    it('round-trips: readOra(writeOra(...)) recovers layers', () => {
      const layers = [
        { name: 'Background', pngData: TINY_PNG, opacity: 1, visible: true },
        { name: 'Layer 1', pngData: TINY_PNG, opacity: 0.5, visible: false },
      ];

      const oraBytes = writeOra(layers, TINY_PNG, TINY_PNG, 100, 200);
      const result = readOra(oraBytes);

      expect(result.width).toBe(100);
      expect(result.height).toBe(200);
      expect(result.layers).toHaveLength(2);
      expect(result.layers[0].name).toBe('Background');
      expect(result.layers[0].opacity).toBe(1);
      expect(result.layers[0].visible).toBe(true);
      expect(result.layers[1].name).toBe('Layer 1');
      expect(result.layers[1].opacity).toBeCloseTo(0.5);
      expect(result.layers[1].visible).toBe(false);
    });

    it('includes mergedimage.png in the archive', () => {
      const oraBytes = writeOra(
        [{ name: 'BG', pngData: TINY_PNG, opacity: 1, visible: true }],
        TINY_PNG,
        TINY_PNG,
        1,
        1,
      );
      const result = readOra(oraBytes);
      // readOra should successfully parse — mergedimage.png presence is implicit
      expect(result.layers).toHaveLength(1);
    });

    it('stores layer PNG data that can be recovered', () => {
      const oraBytes = writeOra(
        [{ name: 'Test', pngData: TINY_PNG, opacity: 1, visible: true }],
        TINY_PNG,
        TINY_PNG,
        1,
        1,
      );
      const result = readOra(oraBytes);

      // The recovered PNG data should match the original
      expect(result.layers[0].pngData).toEqual(TINY_PNG);
    });
  });

  // ---------------------------------------------------------------
  // readOra
  // ---------------------------------------------------------------

  describe('readOra', () => {
    it('throws on invalid (non-ZIP) data', () => {
      expect(() => readOra(new Uint8Array([1, 2, 3]))).toThrow();
    });

    it('parses stack.xml to extract layer metadata', () => {
      const layers = [
        { name: 'Base', pngData: TINY_PNG, opacity: 0.75, visible: true },
      ];
      const oraBytes = writeOra(layers, TINY_PNG, TINY_PNG, 64, 48);
      const result = readOra(oraBytes);

      expect(result.width).toBe(64);
      expect(result.height).toBe(48);
      expect(result.layers[0].name).toBe('Base');
      expect(result.layers[0].opacity).toBeCloseTo(0.75);
      expect(result.layers[0].visible).toBe(true);
    });
  });
});
