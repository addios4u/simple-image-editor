/**
 * Typed wrapper around the Rust WASM module for the image engine.
 *
 * Provides init(), decode, encode, brush, filter, clipboard, history,
 * and layer compositing functions. All methods delegate to the
 * wasm-bindgen generated bindings loaded at runtime.
 */

/** Shape of the wasm-bindgen generated module after instantiation. */
export interface WasmModule {
  memory: WebAssembly.Memory;
  init(): void;
  PixelBuffer: {
    new (width: number, height: number): WasmPixelBuffer;
  };
  decode_image(data: Uint8Array): WasmPixelBuffer;
  encode_image(buffer: WasmPixelBuffer, format: string): Uint8Array;
  brush_stroke(
    buffer: WasmPixelBuffer,
    cx: number,
    cy: number,
    color: number,
    size: number,
    hardness: number,
  ): void;
  box_blur(buffer: WasmPixelBuffer, radius: number): void;
  gaussian_blur(buffer: WasmPixelBuffer, sigma: number): void;
  motion_blur(buffer: WasmPixelBuffer, angle: number, distance: number): void;
  render_text(
    buffer: WasmPixelBuffer,
    text: string,
    x: number,
    y: number,
    fontSize: number,
    color: number,
  ): void;
  capture_region(
    buffer: WasmPixelBuffer,
    x: number,
    y: number,
    w: number,
    h: number,
  ): WasmRegionSnapshot;
  restore_region(
    buffer: WasmPixelBuffer,
    snapshot: WasmRegionSnapshot,
  ): void;
  LayerCompositor: {
    new (width: number, height: number): WasmLayerCompositor;
  };
  Clipboard: {
    new (): WasmClipboard;
  };
}

export interface WasmPixelBuffer {
  width(): number;
  height(): number;
  data_ptr(): number;
  data_len(): number;
  get_pixel(x: number, y: number): number;
  set_pixel(x: number, y: number, rgba: number): void;
  fill_rect(x: number, y: number, w: number, h: number, rgba: number): void;
  clear(): void;
  clone_region(x: number, y: number, w: number, h: number): WasmPixelBuffer;
  paste(src: WasmPixelBuffer, x: number, y: number): void;
  free(): void;
}

export interface WasmRegionSnapshot {
  x(): number;
  y(): number;
  width(): number;
  height(): number;
  free(): void;
}

export interface WasmLayerCompositor {
  width(): number;
  height(): number;
  add_layer(): number;
  layer_count(): number;
  set_layer_opacity(index: number, opacity: number): void;
  set_layer_visible(index: number, visible: boolean): void;
  set_layer_blend_mode(index: number, mode: number): void;
  remove_layer(index: number): boolean;
  move_layer(from_index: number, to_index: number): boolean;
  composite(): WasmPixelBuffer;
  brush_stroke_layer(
    index: number, cx: number, cy: number,
    color: number, size: number, hardness: number,
  ): void;
  fill_rect_layer(
    index: number, x: number, y: number,
    w: number, h: number, rgba: number,
  ): void;
  get_layer_data_ptr(index: number): number;
  get_layer_data_len(index: number): number;
  set_layer_data(index: number, data: Uint8Array): void;
  box_blur_layer(index: number, radius: number): void;
  gaussian_blur_layer(index: number, sigma: number): void;
  motion_blur_layer(index: number, angle: number, distance: number): void;
  capture_layer_region(
    index: number, x: number, y: number, w: number, h: number,
  ): WasmRegionSnapshot;
  restore_layer_region(index: number, snapshot: WasmRegionSnapshot): void;
  free(): void;
}

export interface WasmClipboard {
  copy(src: WasmPixelBuffer, x: number, y: number, w: number, h: number): void;
  cut(src: WasmPixelBuffer, x: number, y: number, w: number, h: number): void;
  paste(dst: WasmPixelBuffer, x: number, y: number): void;
  has_data(): boolean;
  free(): void;
}

let wasmModule: WasmModule | null = null;

/**
 * Initialize the WASM bridge by loading and instantiating the module.
 * Must be called before any other bridge function.
 *
 * @param loader - An async function that returns the instantiated WasmModule.
 *                 In production this loads the .wasm file; in tests it can
 *                 return a mock.
 */
export async function init(
  loader: () => Promise<WasmModule>,
): Promise<void> {
  wasmModule = await loader();
  wasmModule.init();
}

/** Get the loaded WASM module. Throws if init() has not been called. */
export function getModule(): WasmModule {
  if (!wasmModule) {
    throw new Error('WASM module not initialized. Call init() first.');
  }
  return wasmModule;
}

/** Check whether the WASM module has been initialized. */
export function isInitialized(): boolean {
  return wasmModule !== null;
}

// --- Convenience wrappers ---

export function createPixelBuffer(
  width: number,
  height: number,
): WasmPixelBuffer {
  return new (getModule().PixelBuffer)(width, height);
}

export function decodeImage(data: Uint8Array): WasmPixelBuffer {
  return getModule().decode_image(data);
}

export function encodeImage(
  buffer: WasmPixelBuffer,
  format: string,
): Uint8Array {
  return getModule().encode_image(buffer, format);
}

export function brushStroke(
  buffer: WasmPixelBuffer,
  cx: number,
  cy: number,
  color: number,
  size: number,
  hardness: number,
): void {
  getModule().brush_stroke(buffer, cx, cy, color, size, hardness);
}

export function boxBlur(buffer: WasmPixelBuffer, radius: number): void {
  getModule().box_blur(buffer, radius);
}

export function gaussianBlur(buffer: WasmPixelBuffer, sigma: number): void {
  getModule().gaussian_blur(buffer, sigma);
}

export function motionBlur(
  buffer: WasmPixelBuffer,
  angle: number,
  distance: number,
): void {
  getModule().motion_blur(buffer, angle, distance);
}

export function renderText(
  buffer: WasmPixelBuffer,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  color: number,
): void {
  getModule().render_text(buffer, text, x, y, fontSize, color);
}

export function captureRegion(
  buffer: WasmPixelBuffer,
  x: number,
  y: number,
  w: number,
  h: number,
): WasmRegionSnapshot {
  return getModule().capture_region(buffer, x, y, w, h);
}

export function restoreRegion(
  buffer: WasmPixelBuffer,
  snapshot: WasmRegionSnapshot,
): void {
  getModule().restore_region(buffer, snapshot);
}

export function createLayerCompositor(
  width: number,
  height: number,
): WasmLayerCompositor {
  return new (getModule().LayerCompositor)(width, height);
}

export function createClipboard(): WasmClipboard {
  return new (getModule().Clipboard)();
}
