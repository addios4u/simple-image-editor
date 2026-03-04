import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TextTool, type TextToolConfig } from '../TextTool';
import type { PointerEvent } from '../BaseTool';

function makeEvent(x: number, y: number): PointerEvent {
  return { x, y, button: 0, shiftKey: false, ctrlKey: false, altKey: false };
}

describe('TextTool', () => {
  let tool: TextTool;

  beforeEach(() => {
    tool = new TextTool();
  });

  it('name is "text"', () => {
    expect(tool.name).toBe('text');
  });

  it('cursor is "text"', () => {
    expect(tool.getCursor()).toBe('text');
  });

  it('onPointerDown sets text insertion point', () => {
    tool.onPointerDown(makeEvent(100, 200));
    expect(tool.getInsertionPoint()).toEqual({ x: 100, y: 200 });
  });

  it('getInsertionPoint returns the clicked position', () => {
    tool.onPointerDown(makeEvent(55, 77));
    expect(tool.getInsertionPoint()).toEqual({ x: 55, y: 77 });
  });

  it('getInsertionPoint returns null before any click', () => {
    expect(tool.getInsertionPoint()).toBeNull();
  });

  it('isEditing state tracks whether text input is active', () => {
    expect(tool.isEditing).toBe(false);
    tool.onPointerDown(makeEvent(50, 50));
    expect(tool.isEditing).toBe(true);
  });

  it('second click updates insertion point', () => {
    tool.onPointerDown(makeEvent(10, 20));
    tool.onPointerDown(makeEvent(30, 40));
    expect(tool.getInsertionPoint()).toEqual({ x: 30, y: 40 });
  });

  it('reset clears insertion point and editing state', () => {
    tool.onPointerDown(makeEvent(50, 50));
    expect(tool.isEditing).toBe(true);
    tool.reset();
    expect(tool.isEditing).toBe(false);
    expect(tool.getInsertionPoint()).toBeNull();
  });

  describe('with config', () => {
    let config: TextToolConfig;

    beforeEach(() => {
      config = {
        getActiveLayerId: vi.fn(() => 'layer-1'),
        getLayerTextData: vi.fn(() => undefined),
        getLayerOffset: vi.fn(() => ({ x: 0, y: 0 })),
        openTextEditor: vi.fn(),
      };
      tool = new TextTool(config);
    });

    it('calls openTextEditor at click position for new text', () => {
      tool.onPointerDown(makeEvent(100, 200));
      expect(config.openTextEditor).toHaveBeenCalledWith(100, 200, null);
    });

    it('calls openTextEditor with existing textData when layer has text', () => {
      const existing = {
        text: 'Hello',
        fontFamily: 'sans-serif',
        fontSize: 24,
        bold: false,
        italic: false,
        x: 50,
        y: 80,
      };
      (config.getLayerTextData as ReturnType<typeof vi.fn>).mockReturnValue(existing);
      (config.getLayerOffset as ReturnType<typeof vi.fn>).mockReturnValue({ x: 0, y: 0 });

      tool.onPointerDown(makeEvent(120, 130));

      expect(config.openTextEditor).toHaveBeenCalledWith(50, 80, 'layer-1', existing);
    });

    it('accounts for layer offset when opening editor for existing text', () => {
      const existing = {
        text: 'Moved',
        fontFamily: 'sans-serif',
        fontSize: 24,
        bold: false,
        italic: false,
        x: 50,
        y: 80,
      };
      (config.getLayerTextData as ReturnType<typeof vi.fn>).mockReturnValue(existing);
      (config.getLayerOffset as ReturnType<typeof vi.fn>).mockReturnValue({ x: 100, y: 30 });

      tool.onPointerDown(makeEvent(0, 0));

      // 오버레이는 textData 좌표 + layer offset = (150, 110)에 열려야 함
      expect(config.openTextEditor).toHaveBeenCalledWith(150, 110, 'layer-1', existing);
    });

    it('does not call openTextEditor when config is not set', () => {
      const noConfigTool = new TextTool();
      noConfigTool.onPointerDown(makeEvent(10, 20));
      // No error should occur
      expect(noConfigTool.getInsertionPoint()).toEqual({ x: 10, y: 20 });
    });
  });
});
