import { describe, it, expect, beforeEach } from 'vitest';
import { useClipboardStore, ClipboardRegion } from '../clipboardStore';

describe('clipboardStore', () => {
  beforeEach(() => {
    useClipboardStore.setState({
      hasData: false,
      region: null,
    });
  });

  it('initial state: hasData is false', () => {
    const state = useClipboardStore.getState();
    expect(state.hasData).toBe(false);
    expect(state.region).toBeNull();
  });

  it('copy sets hasData to true and stores region info', () => {
    const region: ClipboardRegion = {
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      layerId: 'layer-1',
    };

    useClipboardStore.getState().copy(region);

    const state = useClipboardStore.getState();
    expect(state.hasData).toBe(true);
    expect(state.region).toEqual(region);
  });

  it('cut sets hasData to true and stores region info', () => {
    const region: ClipboardRegion = {
      x: 5,
      y: 15,
      width: 200,
      height: 100,
      layerId: 'layer-2',
    };

    useClipboardStore.getState().cut(region);

    const state = useClipboardStore.getState();
    expect(state.hasData).toBe(true);
    expect(state.region).toEqual(region);
  });

  it('paste returns stored region info', () => {
    const region: ClipboardRegion = {
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      layerId: 'layer-1',
    };

    useClipboardStore.getState().copy(region);
    const result = useClipboardStore.getState().paste();

    expect(result).toEqual(region);
  });

  it('paste when empty returns null', () => {
    const result = useClipboardStore.getState().paste();
    expect(result).toBeNull();
  });

  it('clear resets state', () => {
    const region: ClipboardRegion = {
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      layerId: 'layer-1',
    };

    useClipboardStore.getState().copy(region);
    expect(useClipboardStore.getState().hasData).toBe(true);

    useClipboardStore.getState().clear();

    const state = useClipboardStore.getState();
    expect(state.hasData).toBe(false);
    expect(state.region).toBeNull();
  });

  it('copy overwrites previous clipboard data', () => {
    const region1: ClipboardRegion = {
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      layerId: 'layer-1',
    };
    const region2: ClipboardRegion = {
      x: 30,
      y: 40,
      width: 200,
      height: 150,
      layerId: 'layer-2',
    };

    useClipboardStore.getState().copy(region1);
    expect(useClipboardStore.getState().region).toEqual(region1);

    useClipboardStore.getState().copy(region2);
    expect(useClipboardStore.getState().region).toEqual(region2);

    const result = useClipboardStore.getState().paste();
    expect(result).toEqual(region2);
  });
});
