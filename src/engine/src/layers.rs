use wasm_bindgen::prelude::*;
use crate::canvas::PixelBuffer;

/// Blend mode for layer compositing.
#[wasm_bindgen]
#[derive(Clone, Copy, Debug)]
pub enum BlendMode {
    Normal,
}

/// A single layer holding a PixelBuffer and metadata.
pub struct Layer {
    pub buffer: PixelBuffer,
    pub opacity: f32,
    pub visible: bool,
    pub blend_mode: BlendMode,
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

    /// Remove a layer by index. Returns true if it was removed.
    pub fn remove_layer(&mut self, index: usize) -> bool {
        if index < self.layers.len() {
            self.layers.remove(index);
            true
        } else {
            false
        }
    }

    /// Composite all visible layers into a new PixelBuffer (normal blend, alpha).
    pub fn composite(&self) -> PixelBuffer {
        let mut out = PixelBuffer::new(self.width, self.height);
        let pixel_count = (self.width * self.height) as usize;

        for layer in &self.layers {
            if !layer.visible {
                continue;
            }
            let src_data = layer.buffer.raw_data();
            let out_data = out.raw_data_mut();

            for i in 0..pixel_count {
                let base = i * 4;
                let sr = src_data[base]     as f32 / 255.0;
                let sg = src_data[base + 1] as f32 / 255.0;
                let sb = src_data[base + 2] as f32 / 255.0;
                let sa = (src_data[base + 3] as f32 / 255.0) * layer.opacity;

                let dr = out_data[base]     as f32 / 255.0;
                let dg = out_data[base + 1] as f32 / 255.0;
                let db = out_data[base + 2] as f32 / 255.0;
                let da = out_data[base + 3] as f32 / 255.0;

                let out_a = sa + da * (1.0 - sa);
                let (or_, og, ob) = if out_a > 0.0 {
                    (
                        (sr * sa + dr * da * (1.0 - sa)) / out_a,
                        (sg * sa + dg * da * (1.0 - sa)) / out_a,
                        (sb * sa + db * da * (1.0 - sa)) / out_a,
                    )
                } else {
                    (0.0, 0.0, 0.0)
                };

                out_data[base]     = (or_   * 255.0 + 0.5) as u8;
                out_data[base + 1] = (og    * 255.0 + 0.5) as u8;
                out_data[base + 2] = (ob    * 255.0 + 0.5) as u8;
                out_data[base + 3] = (out_a * 255.0 + 0.5) as u8;
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
