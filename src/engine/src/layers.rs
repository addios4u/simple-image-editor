use wasm_bindgen::prelude::*;
use crate::canvas::PixelBuffer;
use crate::history::RegionSnapshot;

/// Blend mode for layer compositing.
#[wasm_bindgen]
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum BlendMode {
    Normal,
    Multiply,
    Screen,
    Overlay,
    Darken,
    Lighten,
    ColorDodge,
    ColorBurn,
    SoftLight,
    HardLight,
    Difference,
    Exclusion,
}

/// Apply blend mode formula to a single channel.
/// `s` = source, `d` = destination, both in 0.0–1.0 range.
fn blend_channel(mode: BlendMode, s: f32, d: f32) -> f32 {
    match mode {
        BlendMode::Normal => s,
        BlendMode::Multiply => s * d,
        BlendMode::Screen => 1.0 - (1.0 - s) * (1.0 - d),
        BlendMode::Overlay => {
            if d < 0.5 {
                2.0 * s * d
            } else {
                1.0 - 2.0 * (1.0 - s) * (1.0 - d)
            }
        }
        BlendMode::Darken => s.min(d),
        BlendMode::Lighten => s.max(d),
        BlendMode::ColorDodge => {
            if s >= 1.0 { 1.0 } else { (d / (1.0 - s)).min(1.0) }
        }
        BlendMode::ColorBurn => {
            if s <= 0.0 { 0.0 } else { (1.0 - (1.0 - d) / s).max(0.0) }
        }
        BlendMode::SoftLight => {
            if s <= 0.5 {
                d - (1.0 - 2.0 * s) * d * (1.0 - d)
            } else {
                let g = if d <= 0.25 {
                    ((16.0 * d - 12.0) * d + 4.0) * d
                } else {
                    d.sqrt()
                };
                d + (2.0 * s - 1.0) * (g - d)
            }
        }
        BlendMode::HardLight => {
            if s < 0.5 {
                2.0 * s * d
            } else {
                1.0 - 2.0 * (1.0 - s) * (1.0 - d)
            }
        }
        BlendMode::Difference => (s - d).abs(),
        BlendMode::Exclusion => s + d - 2.0 * s * d,
    }
}

/// A single layer holding a PixelBuffer and metadata.
pub struct Layer {
    pub buffer: PixelBuffer,
    pub opacity: f32,
    pub visible: bool,
    pub blend_mode: BlendMode,
    pub offset_x: i32,
    pub offset_y: i32,
}

/// Composites multiple layers into a single output PixelBuffer.
#[wasm_bindgen]
pub struct LayerCompositor {
    width: u32,
    height: u32,
    layers: Vec<Layer>,
}

#[wasm_bindgen]
impl LayerCompositor {
    /// Create a new compositor for images of the given dimensions.
    #[wasm_bindgen(constructor)]
    pub fn new(width: u32, height: u32) -> LayerCompositor {
        LayerCompositor {
            width,
            height,
            layers: Vec::new(),
        }
    }

    /// Add a new transparent layer and return its index.
    pub fn add_layer(&mut self) -> usize {
        self.layers.push(Layer {
            buffer: PixelBuffer::new(self.width, self.height),
            opacity: 1.0,
            visible: true,
            blend_mode: BlendMode::Normal,
            offset_x: 0,
            offset_y: 0,
        });
        self.layers.len() - 1
    }

    /// Return the number of layers.
    pub fn layer_count(&self) -> usize {
        self.layers.len()
    }

    /// Set the opacity of a layer by index (0.0 to 1.0).
    pub fn set_layer_opacity(&mut self, index: usize, opacity: f32) {
        if let Some(layer) = self.layers.get_mut(index) {
            layer.opacity = opacity.clamp(0.0, 1.0);
        }
    }

    /// Set the visibility of a layer by index.
    pub fn set_layer_visible(&mut self, index: usize, visible: bool) {
        if let Some(layer) = self.layers.get_mut(index) {
            layer.visible = visible;
        }
    }

    /// Set the blend mode of a layer by index.
    pub fn set_layer_blend_mode(&mut self, index: usize, mode: BlendMode) {
        if let Some(layer) = self.layers.get_mut(index) {
            layer.blend_mode = mode;
        }
    }

    /// Set the offset of a layer by index.
    pub fn set_layer_offset(&mut self, index: usize, x: i32, y: i32) {
        if let Some(layer) = self.layers.get_mut(index) {
            layer.offset_x = x;
            layer.offset_y = y;
        }
    }

    /// Get the x offset of a layer.
    pub fn get_layer_offset_x(&self, index: usize) -> i32 {
        self.layers.get(index).map(|l| l.offset_x).unwrap_or(0)
    }

    /// Get the y offset of a layer.
    pub fn get_layer_offset_y(&self, index: usize) -> i32 {
        self.layers.get(index).map(|l| l.offset_y).unwrap_or(0)
    }

    /// Remove a layer by index. Returns true if it was removed.
    pub fn remove_layer(&mut self, index: usize) -> bool {
        if index < self.layers.len() {
            self.layers.remove(index);
            true
        } else {
            false
        }
    }

    /// Move a layer from one index to another. Returns true if successful.
    pub fn move_layer(&mut self, from_index: usize, to_index: usize) -> bool {
        if from_index >= self.layers.len() || to_index >= self.layers.len() {
            return false;
        }
        let layer = self.layers.remove(from_index);
        self.layers.insert(to_index, layer);
        true
    }

    /// Get the width of the compositor canvas.
    pub fn width(&self) -> u32 {
        self.width
    }

    /// Get the height of the compositor canvas.
    pub fn height(&self) -> u32 {
        self.height
    }

    /// Apply a brush stroke directly to a layer's buffer.
    pub fn brush_stroke_layer(
        &mut self,
        index: usize,
        cx: f32,
        cy: f32,
        color: u32,
        size: f32,
        hardness: f32,
    ) {
        if let Some(layer) = self.layers.get_mut(index) {
            crate::brush::brush_stroke(&mut layer.buffer, cx, cy, color, size, hardness);
        }
    }

    /// Fill a rectangular region on a layer's buffer.
    pub fn fill_rect_layer(
        &mut self,
        index: usize,
        x: u32,
        y: u32,
        w: u32,
        h: u32,
        rgba: u32,
    ) {
        if let Some(layer) = self.layers.get_mut(index) {
            layer.buffer.fill_rect(x, y, w, h, rgba);
        }
    }

    /// Get the pointer to a layer's pixel data for zero-copy rendering.
    /// Returns 0 if the index is invalid.
    pub fn get_layer_data_ptr(&self, index: usize) -> *const u8 {
        self.layers
            .get(index)
            .map(|l| l.buffer.data_ptr())
            .unwrap_or(std::ptr::null())
    }

    /// Get the byte length of a layer's pixel data.
    /// Returns 0 if the index is invalid.
    pub fn get_layer_data_len(&self, index: usize) -> u32 {
        self.layers
            .get(index)
            .map(|l| l.buffer.data_len())
            .unwrap_or(0)
    }

    /// Copy raw pixel data from JS into a layer's buffer.
    /// Data must be exactly width*height*4 bytes.
    pub fn set_layer_data(&mut self, index: usize, data: &[u8]) {
        if let Some(layer) = self.layers.get_mut(index) {
            let buf = layer.buffer.raw_data_mut();
            if data.len() == buf.len() {
                buf.copy_from_slice(data);
            }
        }
    }

    /// Apply box blur to a specific layer.
    pub fn box_blur_layer(&mut self, index: usize, radius: u32) {
        if let Some(layer) = self.layers.get_mut(index) {
            crate::filters::box_blur(&mut layer.buffer, radius);
        }
    }

    /// Apply gaussian blur to a specific layer.
    pub fn gaussian_blur_layer(&mut self, index: usize, sigma: f32) {
        if let Some(layer) = self.layers.get_mut(index) {
            crate::filters::gaussian_blur(&mut layer.buffer, sigma);
        }
    }

    /// Apply motion blur to a specific layer.
    pub fn motion_blur_layer(&mut self, index: usize, angle: f32, distance: u32) {
        if let Some(layer) = self.layers.get_mut(index) {
            crate::filters::motion_blur(&mut layer.buffer, angle, distance);
        }
    }

    /// Capture a rectangular region snapshot from a layer for undo/redo.
    /// Returns a snapshot of a 0x0 region if the index is invalid.
    pub fn capture_layer_region(
        &self,
        index: usize,
        x: u32,
        y: u32,
        w: u32,
        h: u32,
    ) -> RegionSnapshot {
        if let Some(layer) = self.layers.get(index) {
            crate::history::capture_region(&layer.buffer, x, y, w, h)
        } else {
            crate::history::capture_region(
                &PixelBuffer::new(0, 0),
                0, 0, 0, 0,
            )
        }
    }

    /// Restore a previously captured region snapshot onto a layer.
    pub fn restore_layer_region(&mut self, index: usize, snapshot: &RegionSnapshot) {
        if let Some(layer) = self.layers.get_mut(index) {
            crate::history::restore_region(&mut layer.buffer, snapshot);
        }
    }

    /// Composite all visible layers into a new PixelBuffer (normal blend, alpha).
    pub fn composite(&self) -> PixelBuffer {
        let mut out = PixelBuffer::new(self.width, self.height);
        let w = self.width as i32;
        let h = self.height as i32;

        for layer in &self.layers {
            if !layer.visible {
                continue;
            }
            let src_data = layer.buffer.raw_data();
            let out_data = out.raw_data_mut();

            for dy in 0..h {
                for dx in 0..w {
                    // Source pixel in layer's local coordinate
                    let sx = dx - layer.offset_x;
                    let sy = dy - layer.offset_y;

                    if sx < 0 || sx >= w || sy < 0 || sy >= h {
                        continue;
                    }

                    let src_base = (sy as usize * self.width as usize + sx as usize) * 4;
                    let dst_base = (dy as usize * self.width as usize + dx as usize) * 4;

                    let sr = src_data[src_base]     as f32 / 255.0;
                    let sg = src_data[src_base + 1] as f32 / 255.0;
                    let sb = src_data[src_base + 2] as f32 / 255.0;
                    let sa = (src_data[src_base + 3] as f32 / 255.0) * layer.opacity;

                    let dr = out_data[dst_base]     as f32 / 255.0;
                    let dg = out_data[dst_base + 1] as f32 / 255.0;
                    let db = out_data[dst_base + 2] as f32 / 255.0;
                    let da = out_data[dst_base + 3] as f32 / 255.0;

                    // Apply blend mode to get blended RGB
                    let br = blend_channel(layer.blend_mode, sr, dr);
                    let bg = blend_channel(layer.blend_mode, sg, dg);
                    let bb = blend_channel(layer.blend_mode, sb, db);

                    let out_a = sa + da * (1.0 - sa);
                    let (or_, og, ob) = if out_a > 0.0 {
                        (
                            (br * sa + dr * da * (1.0 - sa)) / out_a,
                            (bg * sa + dg * da * (1.0 - sa)) / out_a,
                            (bb * sa + db * da * (1.0 - sa)) / out_a,
                        )
                    } else {
                        (0.0, 0.0, 0.0)
                    };

                    out_data[dst_base]     = (or_   * 255.0 + 0.5) as u8;
                    out_data[dst_base + 1] = (og    * 255.0 + 0.5) as u8;
                    out_data[dst_base + 2] = (ob    * 255.0 + 0.5) as u8;
                    out_data[dst_base + 3] = (out_a * 255.0 + 0.5) as u8;
                }
            }
        }
        out
    }
}

// Non-WASM helpers for tests and internal code.
impl LayerCompositor {
    /// Get mutable access to a layer's PixelBuffer by index.
    pub fn get_layer_buffer_mut(&mut self, index: usize) -> Option<&mut PixelBuffer> {
        self.layers.get_mut(index).map(|l| &mut l.buffer)
    }
}
