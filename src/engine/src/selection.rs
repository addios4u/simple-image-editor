use wasm_bindgen::prelude::*;

/// An axis-aligned rectangular selection region.
#[wasm_bindgen]
pub struct Selection {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

#[wasm_bindgen]
impl Selection {
    #[wasm_bindgen(constructor)]
    pub fn new(x: u32, y: u32, width: u32, height: u32) -> Selection {
        Selection { x, y, width, height }
    }

    /// Returns true if the point (px, py) is inside the selection.
    pub fn contains(&self, px: u32, py: u32) -> bool {
        px >= self.x && px < self.x + self.width
            && py >= self.y && py < self.y + self.height
    }
}
