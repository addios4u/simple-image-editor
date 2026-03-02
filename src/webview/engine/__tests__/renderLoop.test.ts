import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RenderLoop } from '../renderLoop';

describe('RenderLoop', () => {
  let renderLoop: RenderLoop;
  let renderCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    renderCallback = vi.fn();
    renderLoop = new RenderLoop(renderCallback);
  });

  it('starts with dirty flag false', () => {
    expect(renderLoop.isDirty()).toBe(false);
  });

  it('requestRender sets dirty flag', () => {
    renderLoop.requestRender();
    expect(renderLoop.isDirty()).toBe(true);
  });

  it('render clears dirty flag', () => {
    renderLoop.requestRender();
    expect(renderLoop.isDirty()).toBe(true);

    renderLoop.flush();
    expect(renderLoop.isDirty()).toBe(false);
  });

  it('flush calls render callback when dirty', () => {
    renderLoop.requestRender();
    renderLoop.flush();
    expect(renderCallback).toHaveBeenCalledOnce();
  });

  it('flush does not call render callback when not dirty', () => {
    renderLoop.flush();
    expect(renderCallback).not.toHaveBeenCalled();
  });

  it('multiple requestRender calls result in single render on flush', () => {
    renderLoop.requestRender();
    renderLoop.requestRender();
    renderLoop.requestRender();

    renderLoop.flush();
    expect(renderCallback).toHaveBeenCalledOnce();
  });
});
