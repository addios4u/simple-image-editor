use wasm_bindgen::prelude::*;

/// RGBA pixel buffer backed by a Vec<u8>.
/// Each pixel is 4 bytes: [R, G, B, A].
#[wasm_bindgen]
pub struct PixelBuffer {
    width: u32,
    height: u32,
    data: Vec<u8>,
}

#[wasm_bindgen]
impl PixelBuffer {
    /// Create a new transparent (all-zero) pixel buffer.
    #[wasm_bindgen(constructor)]
    pub fn new(width: u32, height: u32) -> PixelBuffer {
        let data = vec![0u8; (width * height * 4) as usize];
        PixelBuffer { width, height, data }
    }

    /// Width of the buffer in pixels.
    pub fn width(&self) -> u32 {
        self.width
    }

    /// Height of the buffer in pixels.
    pub fn height(&self) -> u32 {
        self.height
    }

    /// Pointer to the start of the pixel data in WASM linear memory.
    /// Used for zero-copy rendering via Uint8ClampedArray view.
    pub fn data_ptr(&self) -> *const u8 {
        self.data.as_ptr()
    }

    /// Length of the pixel data in bytes (width * height * 4).
    pub fn data_len(&self) -> u32 {
        self.data.len() as u32
    }

    /// Get a single pixel as a packed u32: 0xRRGGBBAA.
    /// Returns 0 if coordinates are out of bounds.
    pub fn get_pixel(&self, x: u32, y: u32) -> u32 {
        if x >= self.width || y >= self.height {
            return 0;
        }
        let idx = ((y * self.width + x) * 4) as usize;
        let r = self.data[idx] as u32;
        let g = self.data[idx + 1] as u32;
        let b = self.data[idx + 2] as u32;
        let a = self.data[idx + 3] as u32;
        (r << 24) | (g << 16) | (b << 8) | a
    }

    /// Set a single pixel from a packed u32: 0xRRGGBBAA.
    /// No-op if coordinates are out of bounds.
    pub fn set_pixel(&mut self, x: u32, y: u32, rgba: u32) {
        if x >= self.width || y >= self.height {
            return;
        }
        let idx = ((y * self.width + x) * 4) as usize;
        self.data[idx]     = ((rgba >> 24) & 0xFF) as u8; // R
        self.data[idx + 1] = ((rgba >> 16) & 0xFF) as u8; // G
        self.data[idx + 2] = ((rgba >>  8) & 0xFF) as u8; // B
        self.data[idx + 3] = ( rgba        & 0xFF) as u8; // A
    }

    /// Fill a rectangular region with a solid RGBA color (packed u32: 0xRRGGBBAA).
    /// Clamps to buffer bounds automatically.
    pub fn fill_rect(&mut self, x: u32, y: u32, w: u32, h: u32, rgba: u32) {
        let r = ((rgba >> 24) & 0xFF) as u8;
        let g = ((rgba >> 16) & 0xFF) as u8;
        let b = ((rgba >>  8) & 0xFF) as u8;
        let a = ( rgba        & 0xFF) as u8;

        let x_end = (x + w).min(self.width);
        let y_end = (y + h).min(self.height);

        for py in y..y_end {
            for px in x..x_end {
                let idx = ((py * self.width + px) * 4) as usize;
                self.data[idx]     = r;
                self.data[idx + 1] = g;
                self.data[idx + 2] = b;
                self.data[idx + 3] = a;
            }
        }
    }

    /// Clear the entire buffer to transparent black (all zeros).
    pub fn clear(&mut self) {
        self.data.iter_mut().for_each(|b| *b = 0);
    }

    /// Clone a rectangular region into a new PixelBuffer.
    /// Out-of-bounds pixels are returned as transparent black.
    pub fn clone_region(&self, x: u32, y: u32, w: u32, h: u32) -> PixelBuffer {
        let mut out = PixelBuffer::new(w, h);
        for py in 0..h {
            for px in 0..w {
                let src_x = x + px;
                let src_y = y + py;
                if src_x < self.width && src_y < self.height {
                    let src_idx = ((src_y * self.width + src_x) * 4) as usize;
                    let dst_idx = ((py * w + px) * 4) as usize;
                    out.data[dst_idx]     = self.data[src_idx];
                    out.data[dst_idx + 1] = self.data[src_idx + 1];
                    out.data[dst_idx + 2] = self.data[src_idx + 2];
                    out.data[dst_idx + 3] = self.data[src_idx + 3];
                }
            }
        }
        out
    }

    /// Paste another PixelBuffer into this one at (x, y).
    /// Source pixels that fall outside the destination bounds are clipped.
    pub fn paste(&mut self, src: &PixelBuffer, dst_x: u32, dst_y: u32) {
        for py in 0..src.height {
            for px in 0..src.width {
                let dx = dst_x + px;
                let dy = dst_y + py;
                if dx < self.width && dy < self.height {
                    let src_idx = ((py * src.width + px) * 4) as usize;
                    let dst_idx = ((dy * self.width + dx) * 4) as usize;
                    self.data[dst_idx]     = src.data[src_idx];
                    self.data[dst_idx + 1] = src.data[src_idx + 1];
                    self.data[dst_idx + 2] = src.data[src_idx + 2];
                    self.data[dst_idx + 3] = src.data[src_idx + 3];
                }
            }
        }
    }
}

// Native (non-WASM) helpers used by tests and internal code.
impl PixelBuffer {
    /// Direct access to raw bytes (for tests and internal use).
    pub fn raw_data(&self) -> &[u8] {
        &self.data
    }

    /// Mutable access to raw bytes (for internal compositing and tests).
    pub fn raw_data_mut(&mut self) -> &mut [u8] {
        &mut self.data
    }

    /// Build from existing raw RGBA bytes (for tests and image_io).
    pub fn from_raw(width: u32, height: u32, data: Vec<u8>) -> Self {
        assert_eq!(data.len(), (width * height * 4) as usize);
        PixelBuffer { width, height, data }
    }
}
