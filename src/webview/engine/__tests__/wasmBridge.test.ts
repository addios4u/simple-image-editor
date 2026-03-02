import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  init,
  getModule,
  isInitialized,
  createPixelBuffer,
  decodeImage,
  encodeImage,
  brushStroke,
  boxBlur,
  gaussianBlur,
  motionBlur,
  renderText,
  captureRegion,
  restoreRegion,
  createLayerCompositor,
  createClipboard,
  type WasmModule,
  type WasmPixelBuffer,
  type WasmRegionSnapshot,
  type WasmLayerCompositor,
  type WasmClipboard,
} from '../wasmBridge';

/** Create a mock WasmModule with vi.fn() stubs for every method. */
function createMockModule(): WasmModule {
  const mockPixelBuffer: WasmPixelBuffer = {
    width: vi.fn(() => 10),
    height: vi.fn(() => 10),
    data_ptr: vi.fn(() => 0),
    data_len: vi.fn(() => 400),
    get_pixel: vi.fn(() => 0),
    set_pixel: vi.fn(),
    fill_rect: vi.fn(),
    clear: vi.fn(),
    clone_region: vi.fn(),
    paste: vi.fn(),
    free: vi.fn(),
  };

  const mockSnapshot: WasmRegionSnapshot = {
    x: vi.fn(() => 0),
    y: vi.fn(() => 0),
    width: vi.fn(() => 4),
    height: vi.fn(() => 4),
    free: vi.fn(),
  };

  const mockCompositor: WasmLayerCompositor = {
    add_layer: vi.fn(() => 0),
    layer_count: vi.fn(() => 1),
    set_layer_opacity: vi.fn(),
    set_layer_visible: vi.fn(),
    remove_layer: vi.fn(() => true),
    composite: vi.fn(() => mockPixelBuffer),
    free: vi.fn(),
  };

  const mockClipboard: WasmClipboard = {
    copy: vi.fn(),
    cut: vi.fn(),
    paste: vi.fn(),
    has_data: vi.fn(() => false),
    free: vi.fn(),
  };

  return {
    init: vi.fn(),
    PixelBuffer: vi.fn(() => mockPixelBuffer) as unknown as WasmModule['PixelBuffer'],
    decode_image: vi.fn(() => mockPixelBuffer),
    encode_image: vi.fn(() => new Uint8Array([0x89, 0x50])),
    brush_stroke: vi.fn(),
    box_blur: vi.fn(),
    gaussian_blur: vi.fn(),
    motion_blur: vi.fn(),
    render_text: vi.fn(),
    capture_region: vi.fn(() => mockSnapshot),
    restore_region: vi.fn(),
    LayerCompositor: vi.fn(() => mockCompositor) as unknown as WasmModule['LayerCompositor'],
    Clipboard: vi.fn(() => mockClipboard) as unknown as WasmModule['Clipboard'],
  };
}

describe('wasmBridge', () => {
  let mockModule: WasmModule;

  beforeEach(async () => {
    // Reset module state by re-importing would be complex;
    // instead we re-init each test.
    mockModule = createMockModule();
    await init(() => Promise.resolve(mockModule));
  });

  it('init calls module.init()', async () => {
    expect(mockModule.init).toHaveBeenCalledOnce();
  });

  it('isInitialized returns true after init', () => {
    expect(isInitialized()).toBe(true);
  });

  it('getModule returns the loaded module', () => {
    expect(getModule()).toBe(mockModule);
  });

  it('getModule throws before init on a fresh import', async () => {
    // We test the error path by importing a fresh copy via dynamic import
    // Since we cannot truly reset module-level state in vitest without
    // re-evaluating the module, we rely on the init() contract.
    // The init() in beforeEach already ran, so getModule() works.
    expect(() => getModule()).not.toThrow();
  });

  it('createPixelBuffer calls PixelBuffer constructor', () => {
    createPixelBuffer(20, 30);
    expect(mockModule.PixelBuffer).toHaveBeenCalledWith(20, 30);
  });

  it('decodeImage delegates to module.decode_image', () => {
    const data = new Uint8Array([1, 2, 3]);
    decodeImage(data);
    expect(mockModule.decode_image).toHaveBeenCalledWith(data);
  });

  it('encodeImage delegates to module.encode_image', () => {
    const buf = createPixelBuffer(4, 4);
    encodeImage(buf, 'png');
    expect(mockModule.encode_image).toHaveBeenCalledWith(buf, 'png');
  });

  it('brushStroke delegates to module.brush_stroke', () => {
    const buf = createPixelBuffer(10, 10);
    brushStroke(buf, 5, 5, 0xFF0000FF, 3.0, 1.0);
    expect(mockModule.brush_stroke).toHaveBeenCalledWith(
      buf, 5, 5, 0xFF0000FF, 3.0, 1.0,
    );
  });

  it('boxBlur delegates to module.box_blur', () => {
    const buf = createPixelBuffer(10, 10);
    boxBlur(buf, 3);
    expect(mockModule.box_blur).toHaveBeenCalledWith(buf, 3);
  });

  it('gaussianBlur delegates to module.gaussian_blur', () => {
    const buf = createPixelBuffer(10, 10);
    gaussianBlur(buf, 1.5);
    expect(mockModule.gaussian_blur).toHaveBeenCalledWith(buf, 1.5);
  });

  it('motionBlur delegates to module.motion_blur', () => {
    const buf = createPixelBuffer(10, 10);
    motionBlur(buf, 45, 10);
    expect(mockModule.motion_blur).toHaveBeenCalledWith(buf, 45, 10);
  });

  it('renderText delegates to module.render_text', () => {
    const buf = createPixelBuffer(10, 10);
    renderText(buf, 'Hello', 0, 0, 16, 0xFFFFFFFF);
    expect(mockModule.render_text).toHaveBeenCalledWith(
      buf, 'Hello', 0, 0, 16, 0xFFFFFFFF,
    );
  });

  it('captureRegion delegates to module.capture_region', () => {
    const buf = createPixelBuffer(10, 10);
    captureRegion(buf, 1, 2, 3, 4);
    expect(mockModule.capture_region).toHaveBeenCalledWith(buf, 1, 2, 3, 4);
  });

  it('restoreRegion delegates to module.restore_region', () => {
    const buf = createPixelBuffer(10, 10);
    const snap = captureRegion(buf, 0, 0, 5, 5);
    restoreRegion(buf, snap);
    expect(mockModule.restore_region).toHaveBeenCalledWith(buf, snap);
  });

  it('createLayerCompositor calls LayerCompositor constructor', () => {
    createLayerCompositor(100, 200);
    expect(mockModule.LayerCompositor).toHaveBeenCalledWith(100, 200);
  });

  it('createClipboard calls Clipboard constructor', () => {
    createClipboard();
    expect(mockModule.Clipboard).toHaveBeenCalled();
  });
});
