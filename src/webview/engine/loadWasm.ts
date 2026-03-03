/**
 * WASM module loader for the image engine.
 *
 * Dynamically imports the wasm-pack generated module and initializes it.
 * Separated into its own module for testability — tests mock this module
 * so that no real WASM loading occurs.
 */
import type { WasmModule } from './wasmBridge';

/**
 * Load and initialize the WASM image engine module.
 *
 * wasm-pack `--target web` generates an ES module with:
 *   - A default export: async init function that fetches & instantiates .wasm
 *   - Named exports: all `#[wasm_bindgen]` functions and classes
 *
 * @returns The instantiated WasmModule.
 */
export async function loadWasmModule(): Promise<WasmModule> {
  // wasm-pack builds to dist/wasm/ (via --out-dir ../../dist/wasm)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pkg = await import(
    /* webpackChunkName: "wasm" */ '../../../dist/wasm/image_engine'
  ) as any;
  // __wbg_init returns instance.exports which includes memory.
  // The JS wrapper doesn't re-export memory, so we attach it manually.
  const wasmExports = await pkg.default();
  pkg.memory = wasmExports.memory;
  return pkg as WasmModule;
}
