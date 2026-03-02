use wasm_bindgen::prelude::*;
use image::{DynamicImage, ImageFormat};
use std::io::Cursor;

use crate::canvas::PixelBuffer;

// --- Internal functions returning Result<_, String> (testable on native) ---

/// Decode raw image bytes (PNG, JPEG, or GIF) into a PixelBuffer.
pub fn decode_image_internal(data: &[u8]) -> Result<PixelBuffer, String> {
    let img = image::load_from_memory(data)
        .map_err(|e| format!("decode_image error: {}", e))?;
    let rgba = img.to_rgba8();
    let (width, height) = rgba.dimensions();
    let raw = rgba.into_raw();
    Ok(PixelBuffer::from_raw(width, height, raw))
}

/// Encode a PixelBuffer into the specified format bytes.
pub fn encode_image_internal(buffer: &PixelBuffer, format: &str) -> Result<Vec<u8>, String> {
    let img = DynamicImage::ImageRgba8(
        image::RgbaImage::from_raw(buffer.width(), buffer.height(), buffer.raw_data().to_vec())
            .ok_or_else(|| "encode_image: invalid buffer dimensions".to_string())?,
    );

    let fmt = match format.to_lowercase().as_str() {
        "png"  => ImageFormat::Png,
        "jpeg" | "jpg" => ImageFormat::Jpeg,
        "gif"  => ImageFormat::Gif,
        other  => return Err(format!("encode_image: unsupported format '{}'", other)),
    };

    let mut out = Vec::new();
    img.write_to(&mut Cursor::new(&mut out), fmt)
        .map_err(|e| format!("encode_image error: {}", e))?;
    Ok(out)
}

// --- WASM wrappers (thin JsValue adapters) ---

/// Decode raw image bytes into a PixelBuffer (WASM API).
#[wasm_bindgen]
pub fn decode_image(data: &[u8]) -> Result<PixelBuffer, JsValue> {
    decode_image_internal(data).map_err(|e| JsValue::from_str(&e))
}

/// Encode a PixelBuffer into the specified format bytes (WASM API).
#[wasm_bindgen]
pub fn encode_image(buffer: &PixelBuffer, format: &str) -> Result<Vec<u8>, JsValue> {
    encode_image_internal(buffer, format).map_err(|e| JsValue::from_str(&e))
}
