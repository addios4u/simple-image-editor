use wasm_bindgen::prelude::*;
use crate::canvas::PixelBuffer;

/// In-WASM clipboard holding a copied pixel region.
#[wasm_bindgen]
pub struct Clipboard {
    buffer: Option<PixelBuffer>,
}

#[wasm_bindgen]
impl Clipboard {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Clipboard {
        Clipboard { buffer: None }
    }

    /// Copy a rectangular region from `src` into the clipboard.
    pub fn copy(&mut self, src: &PixelBuffer, x: u32, y: u32, w: u32, h: u32) {
        self.buffer = Some(src.clone_region(x, y, w, h));
    }

    /// Cut a rectangular region from `src` into the clipboard (fills region with transparent black).
    pub fn cut(&mut self, src: &mut PixelBuffer, x: u32, y: u32, w: u32, h: u32) {
        self.buffer = Some(src.clone_region(x, y, w, h));
        src.fill_rect(x, y, w, h, 0x00000000);
    }

    /// Paste the clipboard contents onto `dst` at (x, y).
    /// No-op if the clipboard is empty.
    pub fn paste(&self, dst: &mut PixelBuffer, x: u32, y: u32) {
        if let Some(ref buf) = self.buffer {
            dst.paste(buf, x, y);
        }
    }

    /// Returns true if the clipboard contains data.
    pub fn has_data(&self) -> bool {
        self.buffer.is_some()
    }
}
