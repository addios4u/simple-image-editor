use wasm_bindgen::prelude::*;

#[cfg(feature = "console_error_panic_hook")]
pub use console_error_panic_hook::set_once as set_panic_hook;

pub mod canvas;
pub mod image_io;
pub mod layers;
pub mod brush;
pub mod selection;
pub mod text;
pub mod filters;
pub mod clipboard;
pub mod history;

/// Initialize the WASM module. Call this once after loading.
#[wasm_bindgen]
pub fn init() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}
