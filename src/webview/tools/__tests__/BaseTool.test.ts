import { describe, it, expect } from 'vitest';
import { BaseTool, type PointerEvent, type KeyEvent } from '../BaseTool';

class ConcreteTool extends BaseTool {
  readonly name = 'concrete';
}

describe('BaseTool', () => {
  it('requires subclass to define name', () => {
    const tool = new ConcreteTool();
    expect(tool.name).toBe('concrete');
  });

  it('has onPointerDown method', () => {
    const tool = new ConcreteTool();
    expect(typeof tool.onPointerDown).toBe('function');
  });

  it('has onPointerMove method', () => {
    const tool = new ConcreteTool();
    expect(typeof tool.onPointerMove).toBe('function');
  });

  it('has onPointerUp method', () => {
    const tool = new ConcreteTool();
    expect(typeof tool.onPointerUp).toBe('function');
  });

  it('has onKeyDown method', () => {
    const tool = new ConcreteTool();
    expect(typeof tool.onKeyDown).toBe('function');
  });

  it('has getCursor method', () => {
    const tool = new ConcreteTool();
    expect(typeof tool.getCursor).toBe('function');
  });

  it('default cursor returns "default"', () => {
    const tool = new ConcreteTool();
    expect(tool.getCursor()).toBe('default');
  });

  it('default onPointerDown does nothing without error', () => {
    const tool = new ConcreteTool();
    const event: PointerEvent = { x: 10, y: 20, button: 0, shiftKey: false, ctrlKey: false, altKey: false };
    expect(() => tool.onPointerDown(event)).not.toThrow();
  });

  it('default onPointerMove does nothing without error', () => {
    const tool = new ConcreteTool();
    const event: PointerEvent = { x: 10, y: 20, button: 0, shiftKey: false, ctrlKey: false, altKey: false };
    expect(() => tool.onPointerMove(event)).not.toThrow();
  });

  it('default onPointerUp does nothing without error', () => {
    const tool = new ConcreteTool();
    const event: PointerEvent = { x: 10, y: 20, button: 0, shiftKey: false, ctrlKey: false, altKey: false };
    expect(() => tool.onPointerUp(event)).not.toThrow();
  });

  it('default onKeyDown does nothing without error', () => {
    const tool = new ConcreteTool();
    const event: KeyEvent = { key: 'a', shiftKey: false, ctrlKey: false, altKey: false };
    expect(() => tool.onKeyDown(event)).not.toThrow();
  });

  it('has reset method that does nothing by default', () => {
    const tool = new ConcreteTool();
    expect(() => tool.reset()).not.toThrow();
  });
});
