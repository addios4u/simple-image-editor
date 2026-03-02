use wasm_bindgen::prelude::*;
use crate::canvas::PixelBuffer;

/// Paint a circular brush stroke onto `buffer` at pixel (cx, cy).
///
/// - `color`: packed RGBA u32 (0xRRGGBBAA)
/// - `size`: diameter of the brush in pixels
/// - `hardness`: 0.0 = fully soft (feathered), 1.0 = fully hard
#[wasm_bindgen]
pub fn brush_stroke(
    buffer: &mut PixelBuffer,
    cx: f32,
    cy: f32,
    color: u32,
    size: f32,
    hardness: f32,
) {
    let radius = size / 2.0;
    let r = ((color >> 24) & 0xFF) as f32 / 255.0;
    let g = ((color >> 16) & 0xFF) as f32 / 255.0;
    let b = ((color >>  8) & 0xFF) as f32 / 255.0;
    let a = ( color        & 0xFF) as f32 / 255.0;

    let x_start = ((cx - radius).floor() as i64).max(0) as u32;
    let y_start = ((cy - radius).floor() as i64).max(0) as u32;
    let x_end   = ((cx + radius).ceil()  as u64).min(buffer.width()  as u64) as u32;
    let y_end   = ((cy + radius).ceil()  as u64).min(buffer.height() as u64) as u32;

    for py in y_start..y_end {
        for px in x_start..x_end {
            let dx = px as f32 + 0.5 - cx;
            let dy = py as f32 + 0.5 - cy;
            let dist = (dx * dx + dy * dy).sqrt();
            if dist > radius {
                continue;
            }
            // Feather: 1.0 inside hard edge, fades to 0 at radius.
            let t = if radius > 0.0 { (dist / radius - hardness) / (1.0 - hardness + 1e-6) } else { 0.0 };
            let alpha = a * (1.0 - t.clamp(0.0, 1.0));

            // Simple src-over blend.
            let existing = buffer.get_pixel(px, py);
            let dr = ((existing >> 24) & 0xFF) as f32 / 255.0;
            let dg = ((existing >> 16) & 0xFF) as f32 / 255.0;
            let db = ((existing >>  8) & 0xFF) as f32 / 255.0;
            let da = ( existing        & 0xFF) as f32 / 255.0;

            let out_a = alpha + da * (1.0 - alpha);
            let (or_, og, ob) = if out_a > 0.0 {
                (
                    (r * alpha + dr * da * (1.0 - alpha)) / out_a,
                    (g * alpha + dg * da * (1.0 - alpha)) / out_a,
                    (b * alpha + db * da * (1.0 - alpha)) / out_a,
                )
            } else {
                (0.0, 0.0, 0.0)
            };

            let packed = ((or_ * 255.0) as u32) << 24
                | ((og  * 255.0) as u32) << 16
                | ((ob  * 255.0) as u32) <<  8
                | ((out_a * 255.0) as u32);

            buffer.set_pixel(px, py, packed);
        }
    }
}
