/**
 * Simple render loop with dirty-flag optimization.
 *
 * Tracks whether the canvas needs re-rendering and only invokes the
 * render callback when the dirty flag is set. Designed to integrate
 * with requestAnimationFrame for the browser render loop and with
 * the WASM LayerCompositor for layer compositing.
 */
export class RenderLoop {
  private dirty = false;
  private animationFrameId: number | null = null;
  private readonly renderCallback: () => void;

  constructor(renderCallback: () => void) {
    this.renderCallback = renderCallback;
  }

  /** Mark the canvas as needing a re-render. */
  requestRender(): void {
    this.dirty = true;
  }

  /** Returns whether a render is pending. */
  isDirty(): boolean {
    return this.dirty;
  }

  /**
   * Immediately render if dirty, clearing the flag.
   * Useful for testing and synchronous render paths.
   */
  flush(): void {
    if (this.dirty) {
      this.dirty = false;
      this.renderCallback();
    }
  }

  /**
   * Start the requestAnimationFrame loop.
   * Each frame checks the dirty flag and renders if needed.
   */
  start(): void {
    const tick = (): void => {
      this.flush();
      this.animationFrameId = requestAnimationFrame(tick);
    };
    this.animationFrameId = requestAnimationFrame(tick);
  }

  /** Stop the render loop. */
  stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
}
