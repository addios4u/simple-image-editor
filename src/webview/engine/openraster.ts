/**
 * OpenRaster (.ora) read/write support.
 *
 * ORA is a ZIP-based format used by GIMP, Krita, MyPaint etc.
 * Structure:
 *   mimetype              — "image/openraster" (stored, not deflated)
 *   stack.xml             — layer stack metadata
 *   data/layer0.png       — individual layer PNGs
 *   mergedimage.png       — flattened composite
 *   Thumbnails/thumbnail.png
 */

import { zipSync, unzipSync } from 'fflate';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OraLayer {
  name: string;
  pngData: Uint8Array;
  opacity: number;
  visible: boolean;
}

export interface OraFile {
  width: number;
  height: number;
  layers: OraLayer[];
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Pack layers into an OpenRaster (.ora) ZIP archive.
 *
 * @param layers       Array of layer descriptors (bottom-to-top order).
 * @param mergedPng    Flattened composite PNG bytes.
 * @param thumbnailPng Thumbnail PNG bytes.
 * @param width        Canvas width in pixels.
 * @param height       Canvas height in pixels.
 * @returns The .ora file as a Uint8Array.
 */
export function writeOra(
  layers: OraLayer[],
  mergedPng: Uint8Array,
  thumbnailPng: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  // Build stack.xml
  const stackLines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<image version="0.0.3" w="${width}" h="${height}">`,
    ' <stack>',
  ];

  for (let i = 0; i < layers.length; i++) {
    const l = layers[i];
    const vis = l.visible ? 'visible' : 'hidden';
    const nameEsc = escapeXml(l.name);
    stackLines.push(
      `  <layer name="${nameEsc}" src="data/layer${i}.png" opacity="${l.opacity}" visibility="${vis}" x="0" y="0" />`,
    );
  }

  stackLines.push(' </stack>', '</image>');
  const stackXml = stackLines.join('\n');

  // Assemble ZIP entries
  const files: Record<string, Uint8Array> = {
    mimetype: encoder.encode('image/openraster'),
    'stack.xml': encoder.encode(stackXml),
    'mergedimage.png': mergedPng,
    'Thumbnails/thumbnail.png': thumbnailPng,
  };

  for (let i = 0; i < layers.length; i++) {
    files[`data/layer${i}.png`] = layers[i].pngData;
  }

  return zipSync(files, { level: 0 });
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Parse an OpenRaster (.ora) archive and extract layers.
 *
 * @param data The .ora file bytes.
 * @returns Parsed ORA file with layers in bottom-to-top order.
 */
export function readOra(data: Uint8Array): OraFile {
  const files = unzipSync(data);

  const stackXmlBytes = files['stack.xml'];
  if (!stackXmlBytes) {
    throw new Error('Invalid ORA: missing stack.xml');
  }
  const stackXml = decoder.decode(stackXmlBytes);

  // Parse image dimensions from <image> tag
  const imageMatch = stackXml.match(/<image[^>]*\bw="(\d+)"[^>]*\bh="(\d+)"/);
  if (!imageMatch) {
    throw new Error('Invalid ORA: cannot parse image dimensions from stack.xml');
  }
  const width = parseInt(imageMatch[1], 10);
  const height = parseInt(imageMatch[2], 10);

  // Parse <layer> tags
  const layerRegex = /<layer\b([^>]*?)\/>/g;
  const layers: OraLayer[] = [];
  let match: RegExpExecArray | null;

  while ((match = layerRegex.exec(stackXml)) !== null) {
    const attrs = match[1];

    const name = parseAttr(attrs, 'name') ?? 'Unnamed';
    const src = parseAttr(attrs, 'src') ?? '';
    const opacity = parseFloat(parseAttr(attrs, 'opacity') ?? '1');
    const visibility = parseAttr(attrs, 'visibility') ?? 'visible';

    const pngData = files[src];
    if (!pngData) {
      throw new Error(`Invalid ORA: missing layer file "${src}"`);
    }

    layers.push({
      name: unescapeXml(name),
      pngData,
      opacity,
      visible: visibility !== 'hidden',
    });
  }

  return { width, height, layers };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseAttr(attrs: string, name: string): string | null {
  const re = new RegExp(`${name}="([^"]*)"`);
  const m = attrs.match(re);
  return m ? m[1] : null;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function unescapeXml(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}
