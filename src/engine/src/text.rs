use wasm_bindgen::prelude::*;
use crate::canvas::PixelBuffer;

/// Render `text` onto `buffer` at pixel (x, y) using the given font size and RGBA color.
///
/// This is a stub — full fontdue-based rendering will be implemented in a later phase.
#[wasm_bindgen]
pub fn render_text(
    _buffer: &mut PixelBuffer,
    _text: &str,
    _x: u32,
    _y: u32,
    _font_size: f32,
    _color: u32,
) {
    // TODO: implement with fontdue
}
