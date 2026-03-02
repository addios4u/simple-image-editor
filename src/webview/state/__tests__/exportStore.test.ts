import { describe, it, expect, beforeEach } from 'vitest';
import { useExportStore } from '../exportStore';

describe('exportStore', () => {
  beforeEach(() => {
    useExportStore.setState({
      format: null,
      quality: 85,
      isExporting: false,
    });
  });

  it('initial state: format is null, quality is 85, isExporting is false', () => {
    const state = useExportStore.getState();
    expect(state.format).toBeNull();
    expect(state.quality).toBe(85);
    expect(state.isExporting).toBe(false);
  });

  it('setFormat changes format', () => {
    useExportStore.getState().setFormat('png');
    expect(useExportStore.getState().format).toBe('png');

    useExportStore.getState().setFormat('jpeg');
    expect(useExportStore.getState().format).toBe('jpeg');

    useExportStore.getState().setFormat('gif');
    expect(useExportStore.getState().format).toBe('gif');
  });

  it('setQuality changes quality (clamped 1-100)', () => {
    useExportStore.getState().setQuality(50);
    expect(useExportStore.getState().quality).toBe(50);

    useExportStore.getState().setQuality(0);
    expect(useExportStore.getState().quality).toBe(1);

    useExportStore.getState().setQuality(-10);
    expect(useExportStore.getState().quality).toBe(1);

    useExportStore.getState().setQuality(150);
    expect(useExportStore.getState().quality).toBe(100);

    useExportStore.getState().setQuality(1);
    expect(useExportStore.getState().quality).toBe(1);

    useExportStore.getState().setQuality(100);
    expect(useExportStore.getState().quality).toBe(100);
  });

  it('setExporting toggles isExporting flag', () => {
    useExportStore.getState().setExporting(true);
    expect(useExportStore.getState().isExporting).toBe(true);

    useExportStore.getState().setExporting(false);
    expect(useExportStore.getState().isExporting).toBe(false);
  });

  it('reset returns to initial state', () => {
    useExportStore.getState().setFormat('jpeg');
    useExportStore.getState().setQuality(50);
    useExportStore.getState().setExporting(true);

    useExportStore.getState().reset();

    const state = useExportStore.getState();
    expect(state.format).toBeNull();
    expect(state.quality).toBe(85);
    expect(state.isExporting).toBe(false);
  });

  it('getExportConfig returns current format + quality', () => {
    useExportStore.getState().setFormat('jpeg');
    useExportStore.getState().setQuality(72);

    const config = useExportStore.getState().getExportConfig();
    expect(config).toEqual({ format: 'jpeg', quality: 72 });
  });

  it('getExportConfig returns null format when no format set', () => {
    const config = useExportStore.getState().getExportConfig();
    expect(config).toEqual({ format: null, quality: 85 });
  });
});
