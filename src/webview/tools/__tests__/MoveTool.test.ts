import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MoveTool, type MoveToolConfig } from '../MoveTool';
import { SelectionMask } from '../../engine/selectionMask';

const ev = (x: number, y: number, opts?: Partial<{ shiftKey: boolean; ctrlKey: boolean; altKey: boolean }>) => ({
  x, y, button: 0, shiftKey: false, ctrlKey: false, altKey: false, ...opts,
});

describe('MoveTool', () => {
  let tool: MoveTool;

  beforeEach(() => {
    tool = new MoveTool();
  });

  it('name is "move"', () => {
    expect(tool.name).toBe('move');
  });

  it('cursor is "move"', () => {
    expect(tool.getCursor()).toBe('move');
  });

  it('tracks drag delta', () => {
    tool.onPointerDown(ev(10, 20));
    tool.onPointerMove(ev(30, 50));

    const delta = tool.getDragDelta();
    expect(delta.dx).toBe(20);
    expect(delta.dy).toBe(30);
  });

  it('returns zero delta when not dragging', () => {
    const delta = tool.getDragDelta();
    expect(delta.dx).toBe(0);
    expect(delta.dy).toBe(0);
  });

  it('stops dragging on pointer up', () => {
    tool.onPointerDown(ev(10, 20));
    expect(tool.isDragging).toBe(true);

    tool.onPointerUp(ev(30, 50));
    expect(tool.isDragging).toBe(false);
  });

  it('reset clears state', () => {
    tool.onPointerDown(ev(10, 20));
    tool.reset();

    expect(tool.isDragging).toBe(false);
    expect(tool.getDragDelta()).toEqual({ dx: 0, dy: 0 });
  });

  describe('with config (layer-move)', () => {
    let configTool: MoveTool;
    const mockSetOffset = vi.fn();
    const mockRender = vi.fn();
    const config: MoveToolConfig = {
      getActiveLayerId: () => 'layer-1',
      getLayerOffset: () => ({ x: 10, y: 20 }),
      isLayerLocked: () => false,
      setLayerOffset: mockSetOffset,
      requestRender: mockRender,
    };

    beforeEach(() => {
      vi.clearAllMocks();
      configTool = new MoveTool(config);
    });

    it('calls setLayerOffset on drag', () => {
      configTool.onPointerDown(ev(0, 0));
      configTool.onPointerMove(ev(5, 10));

      expect(mockSetOffset).toHaveBeenCalledWith('layer-1', 15, 30);
      expect(mockRender).toHaveBeenCalled();
    });

    it('does not drag when layer is locked', () => {
      const lockedConfig: MoveToolConfig = { ...config, isLayerLocked: () => true };
      const lockedTool = new MoveTool(lockedConfig);

      lockedTool.onPointerDown(ev(0, 0));
      expect(lockedTool.isDragging).toBe(false);
    });

    it('uses layer-move when no mask is provided', () => {
      // Config without getMask — should fall back to layer-move
      configTool.onPointerDown(ev(5, 5));
      configTool.onPointerMove(ev(10, 15));

      expect(mockSetOffset).toHaveBeenCalled();
    });
  });

  describe('selection-move mode', () => {
    let selTool: MoveTool;
    let mask: SelectionMask;
    const mockSetOffset = vi.fn();
    const mockRender = vi.fn();
    const mockExtract = vi.fn();
    const mockStamp = vi.fn();
    const mockSetFloating = vi.fn();
    const mockSetFloatingOffset = vi.fn();
    const mockClearFloating = vi.fn();
    const mockCaptureRegion = vi.fn();
    const mockRestoreRegion = vi.fn();
    const mockOnContourChange = vi.fn();

    function makeConfig(overrides?: Partial<MoveToolConfig>): MoveToolConfig {
      return {
        getActiveLayerId: () => 'layer-1',
        getLayerOffset: () => ({ x: 0, y: 0 }),
        isLayerLocked: () => false,
        setLayerOffset: mockSetOffset,
        requestRender: mockRender,
        getMask: () => mask,
        getCanvasSize: () => ({ width: 10, height: 10 }),
        extractMaskedPixels: mockExtract,
        stampBufferOntoLayer: mockStamp,
        setFloatingLayer: mockSetFloating,
        setFloatingOffset: mockSetFloatingOffset,
        clearFloatingLayer: mockClearFloating,
        captureLayerRegion: mockCaptureRegion,
        restoreLayerRegion: mockRestoreRegion,
        onContourChange: mockOnContourChange,
        ...overrides,
      };
    }

    beforeEach(() => {
      vi.clearAllMocks();
      mask = new SelectionMask(10, 10);
      // Create a 4x4 selection at (3,3)
      mask.addRect(3, 3, 4, 4);
      // extractMaskedPixels returns fake pixel data
      mockExtract.mockReturnValue(new Uint8Array(10 * 10 * 4));
      mockCaptureRegion.mockReturnValue({ x: () => 0, y: () => 0, width: () => 10, height: () => 10, free: vi.fn() });
      selTool = new MoveTool(makeConfig());
    });

    it('enters selection-move when clicking inside mask', () => {
      selTool.onPointerDown(ev(5, 5)); // inside the 3..7 selection

      expect(selTool.isDragging).toBe(true);
      expect(mockExtract).toHaveBeenCalledWith('layer-1', mask.getMaskData());
      expect(mockSetFloating).toHaveBeenCalled();
      expect(mockCaptureRegion).toHaveBeenCalled();
      // Should NOT call setLayerOffset (that's layer-move)
      expect(mockSetOffset).not.toHaveBeenCalled();
    });

    it('uses layer-move when clicking outside mask', () => {
      selTool.onPointerDown(ev(0, 0)); // outside the 3..7 selection

      expect(selTool.isDragging).toBe(true);
      expect(mockExtract).not.toHaveBeenCalled();
      expect(mockSetFloating).not.toHaveBeenCalled();
    });

    it('uses layer-move when mask is empty', () => {
      mask.clear();
      selTool.onPointerDown(ev(5, 5));

      expect(mockExtract).not.toHaveBeenCalled();
    });

    it('updates floating offset and contour on drag', () => {
      selTool.onPointerDown(ev(5, 5));
      vi.clearAllMocks();

      selTool.onPointerMove(ev(8, 7));

      expect(mockSetFloatingOffset).toHaveBeenCalledWith(3, 2);
      expect(mockRender).toHaveBeenCalled();
      expect(mockOnContourChange).toHaveBeenCalled();
      // Should NOT call setLayerOffset
      expect(mockSetOffset).not.toHaveBeenCalled();
    });

    it('stamps pixels and clears floating on pointer up', () => {
      selTool.onPointerDown(ev(5, 5));
      selTool.onPointerMove(ev(8, 7));
      vi.clearAllMocks();

      selTool.onPointerUp(ev(8, 7));

      expect(mockClearFloating).toHaveBeenCalled();
      expect(mockStamp).toHaveBeenCalledWith(
        'layer-1',
        expect.any(Uint8Array),
        10, 10,
        3, 2,
      );
      expect(mockRender).toHaveBeenCalled();
      expect(selTool.isDragging).toBe(false);
    });

    it('does nothing when layer is locked', () => {
      const lockedTool = new MoveTool(makeConfig({ isLayerLocked: () => true }));

      lockedTool.onPointerDown(ev(5, 5));
      expect(lockedTool.isDragging).toBe(false);
      expect(mockExtract).not.toHaveBeenCalled();
    });

    it('handles zero-distance drag', () => {
      selTool.onPointerDown(ev(5, 5));
      selTool.onPointerUp(ev(5, 5));

      expect(mockStamp).toHaveBeenCalledWith(
        'layer-1',
        expect.any(Uint8Array),
        10, 10,
        0, 0,
      );
      expect(selTool.isDragging).toBe(false);
    });

    it('reset cancels selection-move cleanly', () => {
      selTool.onPointerDown(ev(5, 5));
      vi.clearAllMocks();

      selTool.reset();

      expect(mockClearFloating).toHaveBeenCalled();
      expect(mockStamp).not.toHaveBeenCalled(); // should not stamp
      expect(selTool.isDragging).toBe(false);
    });
  });
});
