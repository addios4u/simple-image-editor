use wasm_bindgen::prelude::*;
use crate::canvas::PixelBuffer;

/// A saved snapshot of a rectangular region for undo/redo.
#[wasm_bindgen]
pub struct RegionSnapshot {
    x: u32,
    y: u32,
    region: PixelBuffer,
}

#[wasm_bindgen]
impl RegionSnapshot {
    pub fn x(&self) -> u32 { self.x }
    pub fn y(&self) -> u32 { self.y }
    pub fn width(&self) -> u32 { self.region.width() }
    pub fn height(&self) -> u32 { self.region.height() }
}

/// Capture a rectangular region from `buffer` into a snapshot.
#[wasm_bindgen]
pub fn capture_region(buffer: &PixelBuffer, x: u32, y: u32, w: u32, h: u32) -> RegionSnapshot {
    RegionSnapshot {
        x,
        y,
        region: buffer.clone_region(x, y, w, h),
    }
}

/// Restore a previously captured region snapshot back onto `buffer`.
#[wasm_bindgen]
pub fn restore_region(buffer: &mut PixelBuffer, snapshot: &RegionSnapshot) {
    buffer.paste(&snapshot.region, snapshot.x, snapshot.y);
}
