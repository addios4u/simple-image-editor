/**
 * Singleton engine context that manages WASM instances and the rendering pipeline.
 *
 * Holds the LayerCompositor, Clipboard, and RenderLoop — objects that are not
 * serializable and therefore kept outside of Zustand stores.
 */

import type {
  WasmModule,
  WasmLayerCompositor,
  WasmClipboard,
  WasmRegionSnapshot,
} from './wasmBridge';
import {
  init as wasmInit,
  getModule,
  isInitialized,
  decodeImage,
  encodeImage,
  createLayerCompositor,
  createClipboard,
} from './wasmBridge';
import { RenderLoop } from './renderLoop';
import { readOra } from './openraster';
import { initSelectionMask, destroySelectionMask } from './selectionMask';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let compositor: WasmLayerCompositor | null = null;
let clipboard: WasmClipboard | null = null;
let renderLoop: RenderLoop | null = null;
let canvasCtx: CanvasRenderingContext2D | null = null;
let wasmMemory: WebAssembly.Memory | null = null;
let canvasWidth = 0;
let canvasHeight = 0;

/** Maps UI layer id → WASM compositor layer index. */
const layerIndexMap = new Map<string, number>();

/**
 * Safely free the current compositor, tolerating corrupted borrow state.
 * A previous WASM panic (e.g. detached ArrayBuffer) can leave the
 * wasm-bindgen borrow counter in a bad state, making free() throw.
 */
function safeDisposeCompositor(): void {
  if (!compositor) return;
  try {
    compositor.free();
  } catch (e) {
    console.warn('[engine] compositor.free() failed (likely corrupted borrow state):', e);
  }
  compositor = null;
}

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

/**
 * Load and initialise the WASM module. Must be called once before any other
 * engine function.
 */
export async function initEngine(
  loader: () => Promise<WasmModule>,
): Promise<void> {
  if (isInitialized()) return;
  await wasmInit(loader);
  const mod = getModule();
  wasmMemory = mod.memory;
  clipboard = createClipboard();
}

/**
 * Bind a canvas 2D context to the rendering pipeline.
 */
export function setupCanvas(ctx: CanvasRenderingContext2D): void {
  canvasCtx = ctx;
}

/**
 * Set up (or replace) the render loop with the given callback.
 */
export function setupRenderLoop(loop: RenderLoop): void {
  renderLoop?.stop();
  renderLoop = loop;
}

// ---------------------------------------------------------------------------
// Image loading
// ---------------------------------------------------------------------------

/**
 * Decode image data, create a compositor of the right size, and load pixels
 * into the first layer.
 *
 * @returns The decoded image dimensions.
 */
export function loadImage(
  data: Uint8Array,
  layerId: string,
): { width: number; height: number } {
  const decoded = decodeImage(data);
  const w = decoded.width();
  const h = decoded.height();

  // (Re-)create compositor at the decoded size.
  safeDisposeCompositor();
  compositor = createLayerCompositor(w, h);
  canvasWidth = w;
  canvasHeight = h;

  // Add background layer and paste decoded pixels.
  layerIndexMap.clear();
  const idx = compositor.add_layer();
  layerIndexMap.set(layerId, idx);

  // Copy decoded pixels into the layer via set_layer_data.
  // Must copy to a standalone Uint8Array first — set_layer_data internally
  // allocates (malloc) which can grow WASM memory, detaching the old buffer.
  const ptr = decoded.data_ptr();
  const len = decoded.data_len();
  if (wasmMemory) {
    const copy = new Uint8Array(new Uint8Array(wasmMemory.buffer, ptr, len));
    compositor.set_layer_data(idx, copy);
  }

  decoded.free();

  // Initialize selection mask at the decoded image size.
  initSelectionMask(w, h);

  return { width: w, height: h };
}

export interface OraLayerInfo {
  id: string;
  name: string;
  opacity: number;
  visible: boolean;
}

/**
 * Load an OpenRaster (.ora) archive into the compositor, restoring all layers.
 *
 * @returns The canvas dimensions and layer metadata for updating stores.
 */
export function loadOraData(oraBytes: Uint8Array): {
  width: number;
  height: number;
  layers: OraLayerInfo[];
} {
  const ora = readOra(oraBytes);

  // (Re-)create compositor at ORA dimensions.
  safeDisposeCompositor();
  compositor = createLayerCompositor(ora.width, ora.height);
  canvasWidth = ora.width;
  canvasHeight = ora.height;
  layerIndexMap.clear();

  const layers: OraLayerInfo[] = [];

  for (let i = 0; i < ora.layers.length; i++) {
    const oraLayer = ora.layers[i];
    const layerId = `layer-${i + 1}`;
    const decoded = decodeImage(oraLayer.pngData);
    const idx = compositor.add_layer();
    layerIndexMap.set(layerId, idx);

    // Copy decoded pixels into the compositor layer.
    // Must copy to a standalone Uint8Array first — set_layer_data internally
    // allocates (malloc) which can grow WASM memory, detaching the old buffer.
    if (wasmMemory) {
      const copy = new Uint8Array(new Uint8Array(wasmMemory.buffer, decoded.data_ptr(), decoded.data_len()));
      compositor.set_layer_data(idx, copy);
    }
    decoded.free();

    compositor.set_layer_opacity(idx, oraLayer.opacity);
    compositor.set_layer_visible(idx, oraLayer.visible);

    layers.push({
      id: layerId,
      name: oraLayer.name,
      opacity: oraLayer.opacity,
      visible: oraLayer.visible,
    });
  }

  // Initialize selection mask at the ORA image size.
  initSelectionMask(ora.width, ora.height);

  return { width: ora.width, height: ora.height, layers };
}

// ---------------------------------------------------------------------------
// Layer management
// ---------------------------------------------------------------------------

export function addLayer(layerId: string): number {
  if (!compositor) return -1;
  const idx = compositor.add_layer();
  layerIndexMap.set(layerId, idx);
  return idx;
}

export function removeLayer(layerId: string): void {
  const idx = layerIndexMap.get(layerId);
  if (idx === undefined || !compositor) return;
  compositor.remove_layer(idx);
  layerIndexMap.delete(layerId);

  // Re-index: every layer after the removed one shifts down by 1.
  for (const [id, i] of layerIndexMap) {
    if (i > idx) {
      layerIndexMap.set(id, i - 1);
    }
  }
}

export function getLayerIndex(layerId: string): number {
  return layerIndexMap.get(layerId) ?? -1;
}

export function setLayerOpacity(layerId: string, opacity: number): void {
  const idx = layerIndexMap.get(layerId);
  if (idx === undefined || !compositor) return;
  compositor.set_layer_opacity(idx, opacity);
}

export function setLayerVisible(layerId: string, visible: boolean): void {
  const idx = layerIndexMap.get(layerId);
  if (idx === undefined || !compositor) return;
  compositor.set_layer_visible(idx, visible);
}

export function setLayerBlendMode(layerId: string, mode: number): void {
  const idx = layerIndexMap.get(layerId);
  if (idx === undefined || !compositor) return;
  compositor.set_layer_blend_mode(idx, mode);
}

export function setLayerOffset(layerId: string, x: number, y: number): void {
  const idx = layerIndexMap.get(layerId);
  if (idx === undefined || !compositor) return;
  compositor.set_layer_offset(idx, x, y);
}

export function moveLayer(fromLayerId: string, toLayerId: string): void {
  const fromIdx = layerIndexMap.get(fromLayerId);
  const toIdx = layerIndexMap.get(toLayerId);
  if (fromIdx === undefined || toIdx === undefined || !compositor) return;
  compositor.move_layer(fromIdx, toIdx);
}

export function rebuildLayerIndexMap(orderedLayerIds: string[]): void {
  layerIndexMap.clear();
  orderedLayerIds.forEach((id, i) => layerIndexMap.set(id, i));
}

// ---------------------------------------------------------------------------
// Drawing operations (delegate to compositor layer methods)
// ---------------------------------------------------------------------------

export function brushStrokeLayer(
  layerId: string,
  cx: number, cy: number,
  color: number, size: number, hardness: number,
): void {
  const idx = layerIndexMap.get(layerId);
  if (idx === undefined || !compositor) return;
  compositor.brush_stroke_layer(idx, cx, cy, color, size, hardness);
}

export function fillRectLayer(
  layerId: string,
  x: number, y: number, w: number, h: number,
  rgba: number,
): void {
  const idx = layerIndexMap.get(layerId);
  if (idx === undefined || !compositor) return;
  compositor.fill_rect_layer(idx, x, y, w, h, rgba);
}

// ---------------------------------------------------------------------------
// Clipboard
// ---------------------------------------------------------------------------

export function copySelection(
  layerId: string,
  x: number, y: number, w: number, h: number,
): void {
  const idx = layerIndexMap.get(layerId);
  if (idx === undefined || !compositor || !clipboard || !wasmMemory) return;

  // Build a temporary PixelBuffer from the layer's raw pixels.
  const mod = getModule();
  const cw = compositor.width();
  const ch = compositor.height();
  const tmp = new mod.PixelBuffer(cw, ch);

  const dstPtr = tmp.data_ptr();
  const dstLen = tmp.data_len();
  const srcPtr = compositor.get_layer_data_ptr(idx);
  const srcLen = compositor.get_layer_data_len(idx);

  if (srcPtr && srcLen > 0 && dstLen === srcLen) {
    const dst = new Uint8Array(wasmMemory.buffer, dstPtr, dstLen);
    const src = new Uint8Array(wasmMemory.buffer, srcPtr, srcLen);
    dst.set(src);
  }

  clipboard.copy(tmp, x, y, w, h);
  tmp.free();
}

export function cutSelection(
  layerId: string,
  x: number, y: number, w: number, h: number,
): void {
  const idx = layerIndexMap.get(layerId);
  if (idx === undefined || !compositor || !clipboard || !wasmMemory) return;

  const mod = getModule();
  const cw = compositor.width();
  const ch = compositor.height();
  const tmp = new mod.PixelBuffer(cw, ch);

  const dstPtr = tmp.data_ptr();
  const dstLen = tmp.data_len();
  const srcPtr = compositor.get_layer_data_ptr(idx);
  const srcLen = compositor.get_layer_data_len(idx);

  if (srcPtr && srcLen > 0 && dstLen === srcLen) {
    const dst = new Uint8Array(wasmMemory.buffer, dstPtr, dstLen);
    const src = new Uint8Array(wasmMemory.buffer, srcPtr, srcLen);
    dst.set(src);
  }

  clipboard.cut(tmp, x, y, w, h);

  // Write back the cleared region to the layer.
  // Must copy to a standalone Uint8Array — set_layer_data can grow WASM memory.
  const updated = new Uint8Array(new Uint8Array(wasmMemory.buffer, tmp.data_ptr(), tmp.data_len()));
  compositor.set_layer_data(idx, updated);
  tmp.free();
}

export function pasteClipboard(
  layerId: string,
  x: number, y: number,
): void {
  const idx = layerIndexMap.get(layerId);
  if (idx === undefined || !compositor || !clipboard || !wasmMemory) return;

  const mod = getModule();
  const cw = compositor.width();
  const ch = compositor.height();
  const tmp = new mod.PixelBuffer(cw, ch);

  // Copy current layer pixels into tmp.
  const dstPtr = tmp.data_ptr();
  const dstLen = tmp.data_len();
  const srcPtr = compositor.get_layer_data_ptr(idx);
  const srcLen = compositor.get_layer_data_len(idx);

  if (srcPtr && srcLen > 0 && dstLen === srcLen) {
    const dst = new Uint8Array(wasmMemory.buffer, dstPtr, dstLen);
    const src = new Uint8Array(wasmMemory.buffer, srcPtr, srcLen);
    dst.set(src);
  }

  clipboard.paste(tmp, x, y);

  // Write back pasted result to the layer.
  // Must copy to a standalone Uint8Array — set_layer_data can grow WASM memory.
  const updated = new Uint8Array(new Uint8Array(wasmMemory.buffer, tmp.data_ptr(), tmp.data_len()));
  compositor.set_layer_data(idx, updated);
  tmp.free();
}

// ---------------------------------------------------------------------------
// Masked pixel operations (selection-move)
// ---------------------------------------------------------------------------

/**
 * Extract pixels under the mask from a layer.
 * Returns a standalone Uint8Array of RGBA data (width*height*4 bytes).
 * The masked region in the source layer is cleared to transparent.
 */
export function extractMaskedPixels(
  layerId: string,
  mask: Uint8Array,
): Uint8Array | null {
  const idx = layerIndexMap.get(layerId);
  if (idx === undefined || !compositor || !wasmMemory) return null;

  const extracted = compositor.extract_masked_pixels(idx, mask);
  const ptr = extracted.data_ptr();
  const len = extracted.data_len();

  // Copy to standalone Uint8Array (WASM memory may grow on next allocation)
  const result = new Uint8Array(new Uint8Array(wasmMemory.buffer, ptr, len));
  extracted.free();

  return result;
}

/**
 * Stamp pixel data onto a layer at the given offset with alpha compositing.
 */
export function stampBufferOntoLayer(
  layerId: string,
  srcData: Uint8Array,
  srcWidth: number,
  srcHeight: number,
  offsetX: number,
  offsetY: number,
): void {
  const idx = layerIndexMap.get(layerId);
  if (idx === undefined || !compositor) return;
  compositor.stamp_buffer_onto_layer(idx, srcData, srcWidth, srcHeight, offsetX, offsetY);
}

/**
 * Set floating layer from raw RGBA data for real-time composite rendering.
 */
export function setFloatingLayer(
  data: Uint8Array,
  width: number,
  height: number,
): void {
  if (!compositor) return;
  compositor.set_floating_layer(data, width, height);
}

/**
 * Update the floating layer's offset.
 */
export function setFloatingOffset(x: number, y: number): void {
  if (!compositor) return;
  compositor.set_floating_offset(x, y);
}

/**
 * Remove the floating layer from the compositor.
 */
export function clearFloatingLayer(): void {
  if (!compositor) return;
  compositor.clear_floating_layer();
}

// ---------------------------------------------------------------------------
// Context menu pixel operations
// ---------------------------------------------------------------------------

export function clearMaskedPixels(layerId: string, mask: Uint8Array): void {
  const idx = layerIndexMap.get(layerId);
  if (idx === undefined || !compositor) return;
  compositor.clear_masked_pixels(idx, mask);
}

export function fillMaskedPixels(
  layerId: string,
  mask: Uint8Array,
  r: number,
  g: number,
  b: number,
  a: number,
): void {
  const idx = layerIndexMap.get(layerId);
  if (idx === undefined || !compositor) return;
  compositor.fill_masked_pixels(idx, mask, r, g, b, a);
}

export function strokeMaskedBoundary(
  layerId: string,
  mask: Uint8Array,
  r: number,
  g: number,
  b: number,
  a: number,
  width: number,
): void {
  const idx = layerIndexMap.get(layerId);
  if (idx === undefined || !compositor) return;
  compositor.stroke_masked_boundary(idx, mask, r, g, b, a, width);
}

export function cropCanvas(x: number, y: number, w: number, h: number): void {
  if (!compositor) return;
  compositor.crop_canvas(x, y, w, h);
  canvasWidth = w;
  canvasHeight = h;
}

/**
 * Bilinear resample srcData (srcW×srcH) to dstW×dstH.
 * Returns a standalone Uint8Array of RGBA data (dstW*dstH*4 bytes).
 */
export function resampleBuffer(
  srcData: Uint8Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): Uint8Array | null {
  if (!compositor || !wasmMemory) return null;
  if (dstW <= 0 || dstH <= 0) return null;
  const result = compositor.resample_buffer(srcData, srcW, srcH, dstW, dstH);
  const ptr = result.data_ptr();
  const len = result.data_len();
  const out = new Uint8Array(new Uint8Array(wasmMemory.buffer, ptr, len));
  result.free();
  return out;
}

/**
 * Copy the selection region from the currently rendered canvas to a PNG Blob.
 * Uses the bound canvasCtx to read pixels directly — no WASM extraction needed.
 */
export async function copySelectionToBlob(
  selectionBounds: { x: number; y: number; w: number; h: number },
): Promise<Blob | null> {
  if (!canvasCtx) return null;
  const { x, y, w, h } = selectionBounds;
  if (w <= 0 || h <= 0) return null;

  const imageData = canvasCtx.getImageData(x, y, w, h);
  const offscreen = new OffscreenCanvas(w, h);
  const ctx2 = offscreen.getContext('2d');
  if (!ctx2) return null;
  ctx2.putImageData(imageData, 0, 0);
  return offscreen.convertToBlob({ type: 'image/png' });
}

/**
 * Paste a PNG Blob as a new layer. Returns the new layerId or null on failure.
 * Caller must also call addLayer() on engineContext to register the layer index.
 */
export async function pasteImageAsNewLayer(
  blob: Blob,
  newLayerId: string,
): Promise<boolean> {
  if (!compositor || !wasmMemory) return false;

  const bitmap = await createImageBitmap(blob);
  // 항상 캔버스 크기로 레이어 생성 (붙여넣기 이미지가 다른 크기여도 동일 크기 유지)
  const targetW = canvasWidth > 0 ? canvasWidth : bitmap.width;
  const targetH = canvasHeight > 0 ? canvasHeight : bitmap.height;
  const offscreen = new OffscreenCanvas(targetW, targetH);
  const ctx2 = offscreen.getContext('2d');
  if (!ctx2) {
    bitmap.close();
    return false;
  }
  // 이미지를 좌상단에 그림 (캔버스보다 크면 그대로, 작으면 남은 영역은 투명)
  ctx2.drawImage(bitmap, 0, 0);
  bitmap.close();

  const imageData = ctx2.getImageData(0, 0, targetW, targetH);
  const idx = addLayer(newLayerId);
  if (idx < 0) return false;

  compositor.set_layer_data(idx, new Uint8Array(imageData.data.buffer));
  return true;
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export function boxBlurLayer(layerId: string, radius: number): void {
  const idx = layerIndexMap.get(layerId);
  if (idx === undefined || !compositor) return;
  compositor.box_blur_layer(idx, radius);
}

export function gaussianBlurLayer(layerId: string, sigma: number): void {
  const idx = layerIndexMap.get(layerId);
  if (idx === undefined || !compositor) return;
  compositor.gaussian_blur_layer(idx, sigma);
}

export function motionBlurLayer(
  layerId: string, angle: number, distance: number,
): void {
  const idx = layerIndexMap.get(layerId);
  if (idx === undefined || !compositor) return;
  compositor.motion_blur_layer(idx, angle, distance);
}

// ---------------------------------------------------------------------------
// History (capture / restore)
// ---------------------------------------------------------------------------

export function captureLayerRegion(
  layerId: string,
  x: number, y: number, w: number, h: number,
): WasmRegionSnapshot | null {
  const idx = layerIndexMap.get(layerId);
  if (idx === undefined || !compositor) return null;
  return compositor.capture_layer_region(idx, x, y, w, h);
}

export function restoreLayerRegion(
  layerId: string,
  snapshot: WasmRegionSnapshot,
): void {
  const idx = layerIndexMap.get(layerId);
  if (idx === undefined || !compositor) return;
  compositor.restore_layer_region(idx, snapshot);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/**
 * Mark the canvas as needing a re-render on the next animation frame.
 */
export function requestRender(): void {
  renderLoop?.requestRender();
}

/**
 * Composite all layers and draw the result to the bound canvas context.
 * Called by the RenderLoop callback.
 */
export function compositeAndRender(): void {
  if (!compositor || !canvasCtx || !wasmMemory) {
    console.warn('[engine] compositeAndRender skipped:', {
      compositor: !!compositor,
      canvasCtx: !!canvasCtx,
      wasmMemory: !!wasmMemory,
    });
    return;
  }

  const composited = compositor.composite();
  const ptr = composited.data_ptr();
  const len = composited.data_len();
  const w = composited.width();
  const h = composited.height();

  // Zero-copy: create a typed-array view directly over WASM linear memory.
  const pixels = new Uint8ClampedArray(wasmMemory.buffer, ptr, len);
  const imageData = new ImageData(pixels, w, h);
  canvasCtx.putImageData(imageData, 0, 0);

  composited.free();
}

/**
 * Composite all layers and encode to the specified format.
 * Used by the save pipeline.
 */
export function compositeToBytes(format: string): Uint8Array {
  if (!compositor) return new Uint8Array(0);
  const composited = compositor.composite();
  const encoded = encodeImage(composited, format);
  composited.free();
  return encoded;
}

/**
 * Get raw RGBA pixel data for a layer as ImageData.
 * Returns null if the layer or compositor is not available.
 */
export function getLayerImageData(layerId: string): ImageData | null {
  const idx = layerIndexMap.get(layerId);
  if (idx === undefined || !compositor || !wasmMemory) return null;

  const w = compositor.width();
  const h = compositor.height();
  if (w === 0 || h === 0) return null;

  const layerPtr = compositor.get_layer_data_ptr(idx);
  const layerLen = compositor.get_layer_data_len(idx);
  if (!layerPtr || layerLen === 0) return null;

  // Copy to standalone array to avoid detached buffer issues
  const rgba = new Uint8ClampedArray(
    new Uint8Array(new Uint8Array(wasmMemory.buffer, layerPtr, layerLen)),
  );
  return new ImageData(rgba, w, h);
}

/**
 * Encode a single layer to PNG bytes (for OpenRaster export).
 */
export function encodeLayerToPng(layerId: string): Uint8Array {
  const idx = layerIndexMap.get(layerId);
  if (idx === undefined || !compositor || !wasmMemory) return new Uint8Array(0);

  const w = compositor.width();
  const h = compositor.height();
  const mod = getModule();

  // Create a temporary PixelBuffer and copy the layer's raw pixels into it.
  const tmpBuf = new mod.PixelBuffer(w, h);

  // After allocation, WASM memory may have grown — read pointers fresh.
  const dstPtr = tmpBuf.data_ptr();
  const dstLen = tmpBuf.data_len();
  const layerPtr = compositor.get_layer_data_ptr(idx);
  const layerLen = compositor.get_layer_data_len(idx);

  if (layerPtr && layerLen > 0 && dstLen === layerLen) {
    const dst = new Uint8Array(wasmMemory.buffer, dstPtr, dstLen);
    const src = new Uint8Array(wasmMemory.buffer, layerPtr, layerLen);
    dst.set(src);
  }

  const encoded = encodeImage(tmpBuf, 'png');
  tmpBuf.free();
  return encoded;
}

// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------

export function getCompositor(): WasmLayerCompositor | null {
  return compositor;
}

export function getClipboard(): WasmClipboard | null {
  return clipboard;
}

export function getWasmMemory(): WebAssembly.Memory | null {
  return wasmMemory;
}

export function getCanvasSize(): { width: number; height: number } {
  return { width: canvasWidth, height: canvasHeight };
}

export function isEngineReady(): boolean {
  return isInitialized() && compositor !== null;
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

export function destroy(): void {
  renderLoop?.stop();
  renderLoop = null;
  safeDisposeCompositor();
  clipboard?.free();
  clipboard = null;
  canvasCtx = null;
  wasmMemory = null;
  canvasWidth = 0;
  canvasHeight = 0;
  layerIndexMap.clear();
  destroySelectionMask();
}
