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

/// Temporary floating layer for selection-move operations.
/// Not part of the regular layer stack — invisible to layer_count().
struct FloatingLayer {
    buffer: PixelBuffer,
    offset_x: i32,
    offset_y: i32,
}

/// Composites multiple layers into a single output PixelBuffer.
#[wasm_bindgen]
pub struct LayerCompositor {
    width: u32,
    height: u32,
    layers: Vec<Layer>,
    floating: Option<FloatingLayer>,
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
            floating: None,
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

    /// Bake the layer's offset into its pixel buffer and reset offset to (0, 0).
    /// After this call, pixels that were at layer-local (lx, ly) will be at
    /// layer-local (lx + offset_x, ly + offset_y), and offset becomes (0, 0).
    /// This makes canvas coordinates equal to layer-local coordinates.
    pub fn bake_layer_offset(&mut self, index: usize) {
        if let Some(layer) = self.layers.get_mut(index) {
            let off_x = layer.offset_x;
            let off_y = layer.offset_y;
            if off_x == 0 && off_y == 0 {
                return;
            }
            let w = self.width as i32;
            let h = self.height as i32;
            let mut new_buf = vec![0u8; (w * h * 4) as usize];
            let src = layer.buffer.raw_data();
            for sy in 0..h {
                for sx in 0..w {
                    let dx = sx + off_x;
                    let dy = sy + off_y;
                    if dx < 0 || dx >= w || dy < 0 || dy >= h {
                        continue;
                    }
                    let si = (sy * w + sx) as usize * 4;
                    let di = (dy * w + dx) as usize * 4;
                    new_buf[di]     = src[si];
                    new_buf[di + 1] = src[si + 1];
                    new_buf[di + 2] = src[si + 2];
                    new_buf[di + 3] = src[si + 3];
                }
            }
            layer.buffer = PixelBuffer::from_raw(self.width, self.height, new_buf);
            layer.offset_x = 0;
            layer.offset_y = 0;
        }
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

    // -----------------------------------------------------------------
    // Masked pixel extraction & floating layer
    // -----------------------------------------------------------------

    /// Extract pixels from a layer where mask[y*width + x] != 0.
    /// Returns a new PixelBuffer containing only the masked pixels.
    /// The masked pixels in the source layer are cleared to transparent.
    /// Mask must be exactly width*height bytes.
    pub fn extract_masked_pixels(&mut self, layer_index: usize, mask: &[u8]) -> PixelBuffer {
        let w = self.width as usize;
        let h = self.height as usize;
        let mut result = PixelBuffer::new(self.width, self.height);

        if mask.len() != w * h {
            return result;
        }

        if let Some(layer) = self.layers.get_mut(layer_index) {
            let src = layer.buffer.raw_data_mut();
            let dst = result.raw_data_mut();

            for i in 0..(w * h) {
                if mask[i] != 0 {
                    let px = i * 4;
                    dst[px]     = src[px];
                    dst[px + 1] = src[px + 1];
                    dst[px + 2] = src[px + 2];
                    dst[px + 3] = src[px + 3];
                    src[px]     = 0;
                    src[px + 1] = 0;
                    src[px + 2] = 0;
                    src[px + 3] = 0;
                }
            }
        }
        result
    }

    /// Stamp pixel data onto a layer at the given offset with alpha compositing.
    /// src_data must be src_width * src_height * 4 bytes (RGBA).
    pub fn stamp_buffer_onto_layer(
        &mut self,
        layer_index: usize,
        src_data: &[u8],
        src_width: u32,
        src_height: u32,
        offset_x: i32,
        offset_y: i32,
    ) {
        let expected = (src_width * src_height * 4) as usize;
        if src_data.len() != expected {
            return;
        }

        if let Some(layer) = self.layers.get_mut(layer_index) {
            let dst = layer.buffer.raw_data_mut();
            let dw = self.width as i32;
            let dh = self.height as i32;

            for sy in 0..src_height as i32 {
                for sx in 0..src_width as i32 {
                    let dx = sx + offset_x;
                    let dy = sy + offset_y;
                    if dx < 0 || dx >= dw || dy < 0 || dy >= dh {
                        continue;
                    }

                    let si = (sy as usize * src_width as usize + sx as usize) * 4;
                    let sa = src_data[si + 3];
                    if sa == 0 {
                        continue;
                    }

                    let di = (dy as usize * self.width as usize + dx as usize) * 4;

                    if sa == 255 {
                        dst[di]     = src_data[si];
                        dst[di + 1] = src_data[si + 1];
                        dst[di + 2] = src_data[si + 2];
                        dst[di + 3] = 255;
                    } else {
                        let sf = sa as f32 / 255.0;
                        let df = dst[di + 3] as f32 / 255.0;
                        let out_a = sf + df * (1.0 - sf);
                        if out_a > 0.0 {
                            for c in 0..3 {
                                let s = src_data[si + c] as f32 / 255.0;
                                let d = dst[di + c] as f32 / 255.0;
                                dst[di + c] =
                                    ((s * sf + d * df * (1.0 - sf)) / out_a * 255.0 + 0.5) as u8;
                            }
                            dst[di + 3] = (out_a * 255.0 + 0.5) as u8;
                        }
                    }
                }
            }
        }
    }

    /// Set a floating layer from raw RGBA data. Used during selection-move drag.
    pub fn set_floating_layer(&mut self, data: &[u8], width: u32, height: u32) {
        let expected = (width * height * 4) as usize;
        if data.len() != expected {
            return;
        }
        let mut buffer = PixelBuffer::new(width, height);
        buffer.raw_data_mut().copy_from_slice(data);
        self.floating = Some(FloatingLayer {
            buffer,
            offset_x: 0,
            offset_y: 0,
        });
    }

    /// Update the floating layer's offset.
    pub fn set_floating_offset(&mut self, x: i32, y: i32) {
        if let Some(ref mut f) = self.floating {
            f.offset_x = x;
            f.offset_y = y;
        }
    }

    /// Remove the floating layer.
    pub fn clear_floating_layer(&mut self) {
        self.floating = None;
    }

    /// Check whether a floating layer exists.
    pub fn has_floating_layer(&self) -> bool {
        self.floating.is_some()
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

        // Render floating layer on top (Normal blend, full opacity)
        if let Some(ref floating) = self.floating {
            let src_data = floating.buffer.raw_data();
            let out_data = out.raw_data_mut();
            let fw = floating.buffer.width() as i32;
            let fh = floating.buffer.height() as i32;

            for dy in 0..h {
                for dx in 0..w {
                    let sx = dx - floating.offset_x;
                    let sy = dy - floating.offset_y;

                    if sx < 0 || sx >= fw || sy < 0 || sy >= fh {
                        continue;
                    }

                    let src_base = (sy as usize * fw as usize + sx as usize) * 4;
                    let sa = src_data[src_base + 3] as f32 / 255.0;
                    if sa == 0.0 {
                        continue;
                    }

                    let dst_base = (dy as usize * self.width as usize + dx as usize) * 4;

                    let sr = src_data[src_base] as f32 / 255.0;
                    let sg = src_data[src_base + 1] as f32 / 255.0;
                    let sb = src_data[src_base + 2] as f32 / 255.0;

                    let dr = out_data[dst_base] as f32 / 255.0;
                    let dg = out_data[dst_base + 1] as f32 / 255.0;
                    let db = out_data[dst_base + 2] as f32 / 255.0;
                    let da = out_data[dst_base + 3] as f32 / 255.0;

                    let out_a = sa + da * (1.0 - sa);
                    if out_a > 0.0 {
                        out_data[dst_base]     = ((sr * sa + dr * da * (1.0 - sa)) / out_a * 255.0 + 0.5) as u8;
                        out_data[dst_base + 1] = ((sg * sa + dg * da * (1.0 - sa)) / out_a * 255.0 + 0.5) as u8;
                        out_data[dst_base + 2] = ((sb * sa + db * da * (1.0 - sa)) / out_a * 255.0 + 0.5) as u8;
                        out_data[dst_base + 3] = (out_a * 255.0 + 0.5) as u8;
                    }
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

#[wasm_bindgen]
impl LayerCompositor {
    /// Clear pixels in the masked area to transparent (RGBA 0,0,0,0).
    /// mask must be exactly width*height bytes; mask[i] != 0 means clear that pixel.
    pub fn clear_masked_pixels(&mut self, layer_idx: usize, mask: &[u8]) {
        let w = self.width as usize;
        let h = self.height as usize;
        if mask.len() != w * h {
            return;
        }
        if let Some(layer) = self.layers.get_mut(layer_idx) {
            let data = layer.buffer.raw_data_mut();
            for i in 0..(w * h) {
                if mask[i] != 0 {
                    let px = i * 4;
                    data[px]     = 0;
                    data[px + 1] = 0;
                    data[px + 2] = 0;
                    data[px + 3] = 0;
                }
            }
        }
    }

    /// Fill pixels in the masked area with the given RGBA color.
    /// mask must be exactly width*height bytes; mask[i] != 0 means fill that pixel.
    pub fn fill_masked_pixels(
        &mut self,
        layer_idx: usize,
        mask: &[u8],
        r: u8,
        g: u8,
        b: u8,
        a: u8,
    ) {
        let w = self.width as usize;
        let h = self.height as usize;
        if mask.len() != w * h {
            return;
        }
        if let Some(layer) = self.layers.get_mut(layer_idx) {
            let data = layer.buffer.raw_data_mut();
            let src_a = a as f32 / 255.0;
            for i in 0..(w * h) {
                if mask[i] != 0 {
                    let px = i * 4;
                    if a == 255 {
                        // 완전 불투명: 직접 교체 (빠른 경로)
                        data[px]     = r;
                        data[px + 1] = g;
                        data[px + 2] = b;
                        data[px + 3] = 255;
                    } else {
                        // 부분 투명: Porter-Duff src-over 합성
                        let dst_a = data[px + 3] as f32 / 255.0;
                        let out_a = src_a + dst_a * (1.0 - src_a);
                        if out_a > 0.0 {
                            data[px]     = ((r as f32 * src_a + data[px]     as f32 * dst_a * (1.0 - src_a)) / out_a) as u8;
                            data[px + 1] = ((g as f32 * src_a + data[px + 1] as f32 * dst_a * (1.0 - src_a)) / out_a) as u8;
                            data[px + 2] = ((b as f32 * src_a + data[px + 2] as f32 * dst_a * (1.0 - src_a)) / out_a) as u8;
                            data[px + 3] = (out_a * 255.0) as u8;
                        }
                    }
                }
            }
        }
    }

    /// Draw an inner stroke along the boundary of the masked selection.
    /// "Boundary pixels" are masked pixels that have at least one non-masked
    /// (or out-of-bounds) neighbour in the 4 cardinal directions.
    /// All masked pixels within `width` pixels of a boundary pixel receive the stroke color.
    pub fn stroke_masked_boundary(
        &mut self,
        layer_idx: usize,
        mask: &[u8],
        r: u8,
        g: u8,
        b: u8,
        a: u8,
        width: u32,
    ) {
        let cw = self.width as usize;
        let ch = self.height as usize;
        if mask.len() != cw * ch {
            return;
        }
        if self.layers.get(layer_idx).is_none() {
            return;
        }

        // Step 1: find boundary pixels (masked pixels adjacent to non-masked or edge).
        let mut is_boundary = vec![false; cw * ch];
        for y in 0..ch {
            for x in 0..cw {
                let i = y * cw + x;
                if mask[i] == 0 {
                    continue;
                }
                let boundary = (x == 0)
                    || (x + 1 == cw)
                    || (y == 0)
                    || (y + 1 == ch)
                    || mask[y * cw + (x - 1)] == 0
                    || mask[y * cw + (x + 1)] == 0
                    || mask[(y - 1) * cw + x] == 0
                    || mask[(y + 1) * cw + x] == 0;
                if boundary {
                    is_boundary[i] = true;
                }
            }
        }

        // Step 2: BFS from boundary pixels, staying within mask, up to `width` steps.
        // Mark pixels to stroke.
        let mut stroke_mask = vec![false; cw * ch];
        let mut queue: std::collections::VecDeque<(usize, usize, u32)> = std::collections::VecDeque::new();

        for i in 0..(cw * ch) {
            if is_boundary[i] {
                stroke_mask[i] = true;
                queue.push_back((i % cw, i / cw, 0));
            }
        }

        while let Some((x, y, dist)) = queue.pop_front() {
            if dist + 1 >= width {
                continue;
            }
            let neighbors: [(isize, isize); 4] = [(-1, 0), (1, 0), (0, -1), (0, 1)];
            for (dx, dy) in neighbors {
                let nx = x as isize + dx;
                let ny = y as isize + dy;
                if nx < 0 || ny < 0 || nx >= cw as isize || ny >= ch as isize {
                    continue;
                }
                let ni = ny as usize * cw + nx as usize;
                if mask[ni] != 0 && !stroke_mask[ni] {
                    stroke_mask[ni] = true;
                    queue.push_back((nx as usize, ny as usize, dist + 1));
                }
            }
        }

        // Step 3: apply stroke color to all marked pixels.
        if let Some(layer) = self.layers.get_mut(layer_idx) {
            let data = layer.buffer.raw_data_mut();
            for i in 0..(cw * ch) {
                if stroke_mask[i] {
                    let px = i * 4;
                    data[px]     = r;
                    data[px + 1] = g;
                    data[px + 2] = b;
                    data[px + 3] = a;
                }
            }
        }
    }

    /// Bilinear resampling: resample src_data (src_w×src_h) to dst_w×dst_h.
    pub fn resample_buffer(&self, src: &[u8], src_w: u32, src_h: u32, dst_w: u32, dst_h: u32) -> PixelBuffer {
        let sw = src_w as usize;
        let sh = src_h as usize;
        let dw = dst_w as usize;
        let dh = dst_h as usize;
        let mut out = vec![0u8; dw * dh * 4];

        for dy in 0..dh {
            for dx in 0..dw {
                let sx = (dx as f32 + 0.5) * sw as f32 / dw as f32 - 0.5;
                let sy = (dy as f32 + 0.5) * sh as f32 / dh as f32 - 0.5;
                let x0 = sx.floor() as i64;
                let y0 = sy.floor() as i64;
                let fx = sx - sx.floor();
                let fy = sy - sy.floor();

                let mut rgba = [0f32; 4];
                for &(ky, wby) in &[(y0, 1.0 - fy), (y0 + 1, fy)] {
                    for &(kx, wbx) in &[(x0, 1.0 - fx), (x0 + 1, fx)] {
                        let w = wby * wbx;
                        let cx = kx.clamp(0, (sw as i64) - 1) as usize;
                        let cy = ky.clamp(0, (sh as i64) - 1) as usize;
                        let p = (cy * sw + cx) * 4;
                        if p + 3 < src.len() {
                            for c in 0..4 {
                                rgba[c] += src[p + c] as f32 * w;
                            }
                        }
                    }
                }

                let dp = (dy * dw + dx) * 4;
                for c in 0..4 {
                    out[dp + c] = rgba[c].round().clamp(0.0, 255.0) as u8;
                }
            }
        }
        PixelBuffer::from_raw(dst_w, dst_h, out)
    }

    /// Crop the canvas to the rectangle (x, y, w, h).
    /// All layers are re-created with the new dimensions.
    /// Each layer's offset is taken into account when copying pixels.
    pub fn crop_canvas(&mut self, x: u32, y: u32, w: u32, h: u32) {
        if w == 0 || h == 0 {
            return;
        }

        for layer in &mut self.layers {
            let mut new_buf = PixelBuffer::new(w, h);
            {
                let dst = new_buf.raw_data_mut();
                let src = layer.buffer.raw_data();
                let old_w = self.width as i32;
                let old_h = self.height as i32;
                let off_x = layer.offset_x;
                let off_y = layer.offset_y;

                for ny in 0..h {
                    for nx in 0..w {
                        // Position in old canvas coordinates
                        let old_canvas_x = x as i32 + nx as i32;
                        let old_canvas_y = y as i32 + ny as i32;
                        // Position in layer-local coordinates
                        let lx = old_canvas_x - off_x;
                        let ly = old_canvas_y - off_y;

                        if lx < 0 || ly < 0 || lx >= old_w || ly >= old_h {
                            continue;
                        }

                        let si = (ly as usize * self.width as usize + lx as usize) * 4;
                        let di = (ny as usize * w as usize + nx as usize) * 4;
                        dst[di]     = src[si];
                        dst[di + 1] = src[si + 1];
                        dst[di + 2] = src[si + 2];
                        dst[di + 3] = src[si + 3];
                    }
                }
            }
            layer.buffer = new_buf;
            // Reset offset since the canvas origin has shifted
            layer.offset_x = 0;
            layer.offset_y = 0;
        }

        self.width = w;
        self.height = h;
    }
}
