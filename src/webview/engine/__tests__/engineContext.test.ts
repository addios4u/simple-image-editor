import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  WasmModule,
  WasmPixelBuffer,
  WasmRegionSnapshot,
  WasmLayerCompositor,
  WasmClipboard,
} from '../wasmBridge';

// We test engineContext by mocking wasmBridge. engineContext re-exports
// wasmBridge helpers, so we mock the module at the vitest level.

// Track compositor calls
let mockCompositor: WasmLayerCompositor;
let mockClipboard: WasmClipboard;
let mockPixelBuffer: WasmPixelBuffer;
let layerIndexCounter: number;

function createMockPixelBuffer(w = 10, h = 10): WasmPixelBuffer {
  return {
    width: vi.fn(() => w),
    height: vi.fn(() => h),
    data_ptr: vi.fn(() => 100),
    data_len: vi.fn(() => w * h * 4),
    get_pixel: vi.fn(() => 0),
    set_pixel: vi.fn(),
    fill_rect: vi.fn(),
    clear: vi.fn(),
    clone_region: vi.fn(),
    paste: vi.fn(),
    free: vi.fn(),
  };
}

function createMockSnapshot(): WasmRegionSnapshot {
  return {
    x: vi.fn(() => 0),
    y: vi.fn(() => 0),
    width: vi.fn(() => 10),
    height: vi.fn(() => 10),
    free: vi.fn(),
  };
}

function resetMocks() {
  layerIndexCounter = 0;
  mockPixelBuffer = createMockPixelBuffer();
  mockCompositor = {
    width: vi.fn(() => 10),
    height: vi.fn(() => 10),
    add_layer: vi.fn(() => layerIndexCounter++),
    layer_count: vi.fn(() => layerIndexCounter),
    set_layer_opacity: vi.fn(),
    set_layer_visible: vi.fn(),
    remove_layer: vi.fn(() => true),
    composite: vi.fn(() => createMockPixelBuffer()),
    brush_stroke_layer: vi.fn(),
    fill_rect_layer: vi.fn(),
    get_layer_data_ptr: vi.fn(() => 200),
    get_layer_data_len: vi.fn(() => 400),
    set_layer_data: vi.fn(),
    box_blur_layer: vi.fn(),
    gaussian_blur_layer: vi.fn(),
    motion_blur_layer: vi.fn(),
    capture_layer_region: vi.fn(() => createMockSnapshot()),
    restore_layer_region: vi.fn(),
    free: vi.fn(),
  };
  mockClipboard = {
    copy: vi.fn(),
    cut: vi.fn(),
    paste: vi.fn(),
    has_data: vi.fn(() => false),
    free: vi.fn(),
  };
}

// Mock wasmBridge module
vi.mock('../wasmBridge', () => {
  let initialized = false;
  let module: WasmModule | null = null;

  return {
    init: vi.fn(async (loader: () => Promise<WasmModule>) => {
      module = await loader();
      module.init();
      initialized = true;
    }),
    getModule: vi.fn(() => {
      if (!module) throw new Error('Not initialized');
      return module;
    }),
    isInitialized: vi.fn(() => initialized),
    decodeImage: vi.fn(() => mockPixelBuffer),
    encodeImage: vi.fn((_buf: WasmPixelBuffer, _fmt: string) => new Uint8Array([0x89, 0x50])),
    createLayerCompositor: vi.fn(() => mockCompositor),
    createClipboard: vi.fn(() => mockClipboard),
    createPixelBuffer: vi.fn(() => createMockPixelBuffer()),
  };
});

// Import after mocking
import {
  initEngine,
  setupCanvas,
  setupRenderLoop,
  loadImage,
  addLayer,
  removeLayer,
  getLayerIndex,
  setLayerOpacity,
  setLayerVisible,
  brushStrokeLayer,
  fillRectLayer,
  boxBlurLayer,
  gaussianBlurLayer,
  motionBlurLayer,
  captureLayerRegion,
  restoreLayerRegion,
  requestRender,
  compositeAndRender,
  compositeToBytes,
  getCompositor,
  getClipboard,
  isEngineReady,
  destroy,
} from '../engineContext';
import { RenderLoop } from '../renderLoop';

function createMockModule(): WasmModule {
  return {
    memory: { buffer: new ArrayBuffer(4096) } as WebAssembly.Memory,
    init: vi.fn(),
    PixelBuffer: vi.fn(() => createMockPixelBuffer()) as unknown as WasmModule['PixelBuffer'],
    decode_image: vi.fn(() => mockPixelBuffer),
    encode_image: vi.fn(() => new Uint8Array([0x89])),
    brush_stroke: vi.fn(),
    box_blur: vi.fn(),
    gaussian_blur: vi.fn(),
    motion_blur: vi.fn(),
    render_text: vi.fn(),
    capture_region: vi.fn(() => createMockSnapshot()),
    restore_region: vi.fn(),
    LayerCompositor: vi.fn(() => mockCompositor) as unknown as WasmModule['LayerCompositor'],
    Clipboard: vi.fn(() => mockClipboard) as unknown as WasmModule['Clipboard'],
  };
}

describe('engineContext', () => {
  beforeEach(() => {
    resetMocks();
    destroy(); // clean up previous state
  });

  afterEach(() => {
    destroy();
  });

  describe('initEngine', () => {
    it('initialises WASM and creates clipboard', async () => {
      const mod = createMockModule();
      await initEngine(() => Promise.resolve(mod));
      expect(getClipboard()).toBe(mockClipboard);
    });
  });

  describe('loadImage', () => {
    it('decodes image and creates compositor with correct dimensions', async () => {
      const mod = createMockModule();
      await initEngine(() => Promise.resolve(mod));

      const data = new Uint8Array([1, 2, 3]);
      const { width, height } = loadImage(data, 'bg');

      expect(width).toBe(10);
      expect(height).toBe(10);
      expect(getCompositor()).toBe(mockCompositor);
      expect(mockCompositor.add_layer).toHaveBeenCalledOnce();
    });

    it('maps layerId to wasm index', async () => {
      const mod = createMockModule();
      await initEngine(() => Promise.resolve(mod));
      loadImage(new Uint8Array([1]), 'bg');

      expect(getLayerIndex('bg')).toBe(0);
    });
  });

  describe('layer management', () => {
    beforeEach(async () => {
      const mod = createMockModule();
      await initEngine(() => Promise.resolve(mod));
      loadImage(new Uint8Array([1]), 'bg');
    });

    it('addLayer creates new layer and maps id', () => {
      const idx = addLayer('layer-1');
      expect(idx).toBe(1);
      expect(getLayerIndex('layer-1')).toBe(1);
      expect(mockCompositor.add_layer).toHaveBeenCalledTimes(2); // bg + layer-1
    });

    it('removeLayer removes mapping and re-indexes', () => {
      addLayer('layer-1');
      addLayer('layer-2');

      removeLayer('layer-1');
      expect(getLayerIndex('layer-1')).toBe(-1);
      // layer-2 had index 2, after removing index 1 it becomes 1
      expect(getLayerIndex('layer-2')).toBe(1);
    });

    it('setLayerOpacity delegates to compositor', () => {
      setLayerOpacity('bg', 0.5);
      expect(mockCompositor.set_layer_opacity).toHaveBeenCalledWith(0, 0.5);
    });

    it('setLayerVisible delegates to compositor', () => {
      setLayerVisible('bg', false);
      expect(mockCompositor.set_layer_visible).toHaveBeenCalledWith(0, false);
    });

    it('operations on unknown layerId are no-ops', () => {
      setLayerOpacity('nonexistent', 0.5);
      expect(mockCompositor.set_layer_opacity).not.toHaveBeenCalled();
    });
  });

  describe('drawing operations', () => {
    beforeEach(async () => {
      const mod = createMockModule();
      await initEngine(() => Promise.resolve(mod));
      loadImage(new Uint8Array([1]), 'bg');
    });

    it('brushStrokeLayer delegates to compositor', () => {
      brushStrokeLayer('bg', 5, 5, 0xFF0000FF, 3, 1.0);
      expect(mockCompositor.brush_stroke_layer).toHaveBeenCalledWith(
        0, 5, 5, 0xFF0000FF, 3, 1.0,
      );
    });

    it('fillRectLayer delegates to compositor', () => {
      fillRectLayer('bg', 0, 0, 10, 10, 0x00FF00FF);
      expect(mockCompositor.fill_rect_layer).toHaveBeenCalledWith(
        0, 0, 0, 10, 10, 0x00FF00FF,
      );
    });
  });

  describe('filters', () => {
    beforeEach(async () => {
      const mod = createMockModule();
      await initEngine(() => Promise.resolve(mod));
      loadImage(new Uint8Array([1]), 'bg');
    });

    it('boxBlurLayer delegates to compositor', () => {
      boxBlurLayer('bg', 3);
      expect(mockCompositor.box_blur_layer).toHaveBeenCalledWith(0, 3);
    });

    it('gaussianBlurLayer delegates to compositor', () => {
      gaussianBlurLayer('bg', 1.5);
      expect(mockCompositor.gaussian_blur_layer).toHaveBeenCalledWith(0, 1.5);
    });

    it('motionBlurLayer delegates to compositor', () => {
      motionBlurLayer('bg', 45, 10);
      expect(mockCompositor.motion_blur_layer).toHaveBeenCalledWith(0, 45, 10);
    });
  });

  describe('history', () => {
    beforeEach(async () => {
      const mod = createMockModule();
      await initEngine(() => Promise.resolve(mod));
      loadImage(new Uint8Array([1]), 'bg');
    });

    it('captureLayerRegion delegates to compositor', () => {
      const snap = captureLayerRegion('bg', 0, 0, 10, 10);
      expect(snap).not.toBeNull();
      expect(mockCompositor.capture_layer_region).toHaveBeenCalledWith(0, 0, 0, 10, 10);
    });

    it('restoreLayerRegion delegates to compositor', () => {
      const snap = createMockSnapshot();
      restoreLayerRegion('bg', snap);
      expect(mockCompositor.restore_layer_region).toHaveBeenCalledWith(0, snap);
    });

    it('captureLayerRegion returns null for unknown layer', () => {
      const snap = captureLayerRegion('nonexistent', 0, 0, 10, 10);
      expect(snap).toBeNull();
    });
  });

  describe('rendering', () => {
    it('requestRender sets dirty flag on render loop', async () => {
      const mod = createMockModule();
      await initEngine(() => Promise.resolve(mod));

      const mockCallback = vi.fn();
      const loop = new RenderLoop(mockCallback);
      setupRenderLoop(loop);

      requestRender();
      expect(loop.isDirty()).toBe(true);
    });

    it('compositeToBytes returns encoded bytes', async () => {
      const mod = createMockModule();
      await initEngine(() => Promise.resolve(mod));
      loadImage(new Uint8Array([1]), 'bg');

      const bytes = compositeToBytes('png');
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(mockCompositor.composite).toHaveBeenCalled();
    });
  });

  describe('isEngineReady', () => {
    it('returns false before init', () => {
      expect(isEngineReady()).toBe(false);
    });

    it('returns true after init + loadImage', async () => {
      const mod = createMockModule();
      await initEngine(() => Promise.resolve(mod));
      loadImage(new Uint8Array([1]), 'bg');
      expect(isEngineReady()).toBe(true);
    });
  });

  describe('destroy', () => {
    it('cleans up all state', async () => {
      const mod = createMockModule();
      await initEngine(() => Promise.resolve(mod));
      loadImage(new Uint8Array([1]), 'bg');

      destroy();

      expect(getCompositor()).toBeNull();
      expect(getClipboard()).toBeNull();
      expect(getLayerIndex('bg')).toBe(-1);
    });
  });
});
