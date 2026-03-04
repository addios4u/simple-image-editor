use wasm_bindgen::prelude::*;
use crate::canvas::PixelBuffer;

/// Apply a box blur with the given radius to the buffer (in-place).
/// Uses a separable two-pass approach (horizontal then vertical) for O(n*r).
/// Edge pixels are handled by clamping coordinates to buffer boundaries.
/// Alpha channel is preserved unchanged.
#[wasm_bindgen]
pub fn box_blur(buffer: &mut PixelBuffer, radius: u32) {
    if radius == 0 {
        return;
    }

    let w = buffer.width() as usize;
    let h = buffer.height() as usize;
    if w == 0 || h == 0 {
        return;
    }

    let data = buffer.raw_data().to_vec();
    let mut temp = vec![0u8; w * h * 4];
    let r = radius as i32;

    // Horizontal pass: data -> temp
    for y in 0..h {
        for x in 0..w {
            let mut sum_r: u32 = 0;
            let mut sum_g: u32 = 0;
            let mut sum_b: u32 = 0;
            let mut count: u32 = 0;

            for dx in -r..=r {
                let sx = (x as i32 + dx).clamp(0, (w as i32) - 1) as usize;
                let idx = (y * w + sx) * 4;
                sum_r += data[idx] as u32;
                sum_g += data[idx + 1] as u32;
                sum_b += data[idx + 2] as u32;
                count += 1;
            }

            let dst = (y * w + x) * 4;
            temp[dst] = (sum_r / count) as u8;
            temp[dst + 1] = (sum_g / count) as u8;
            temp[dst + 2] = (sum_b / count) as u8;
            temp[dst + 3] = data[dst + 3]; // preserve alpha
        }
    }

    // Vertical pass: temp -> output
    let out = buffer.raw_data_mut();
    for y in 0..h {
        for x in 0..w {
            let mut sum_r: u32 = 0;
            let mut sum_g: u32 = 0;
            let mut sum_b: u32 = 0;
            let mut count: u32 = 0;

            for dy in -r..=r {
                let sy = (y as i32 + dy).clamp(0, (h as i32) - 1) as usize;
                let idx = (sy * w + x) * 4;
                sum_r += temp[idx] as u32;
                sum_g += temp[idx + 1] as u32;
                sum_b += temp[idx + 2] as u32;
                count += 1;
            }

            let dst = (y * w + x) * 4;
            out[dst] = (sum_r / count) as u8;
            out[dst + 1] = (sum_g / count) as u8;
            out[dst + 2] = (sum_b / count) as u8;
            out[dst + 3] = temp[dst + 3]; // preserve alpha
        }
    }
}

/// Generate a normalized 1D Gaussian kernel with the given sigma.
/// Kernel radius = ceil(3 * sigma). Returns the kernel values (length = 2*radius + 1).
fn gaussian_kernel(sigma: f32) -> Vec<f32> {
    let radius = (3.0 * sigma).ceil() as i32;
    if radius == 0 {
        return vec![1.0];
    }

    let mut kernel = Vec::with_capacity((2 * radius + 1) as usize);
    let two_sigma_sq = 2.0 * sigma * sigma;
    let mut sum = 0.0f32;

    for i in -radius..=radius {
        let val = (-(i * i) as f32 / two_sigma_sq).exp();
        kernel.push(val);
        sum += val;
    }

    // Normalize
    for v in kernel.iter_mut() {
        *v /= sum;
    }

    kernel
}

/// Apply a Gaussian blur with the given sigma to the buffer (in-place).
/// Uses a separable 1D kernel applied in two passes (horizontal then vertical).
/// Alpha channel is preserved unchanged.
#[wasm_bindgen]
pub fn gaussian_blur(buffer: &mut PixelBuffer, sigma: f32) {
    if sigma <= 0.0 {
        return;
    }

    let w = buffer.width() as usize;
    let h = buffer.height() as usize;
    if w == 0 || h == 0 {
        return;
    }

    let kernel = gaussian_kernel(sigma);
    let radius = (kernel.len() / 2) as i32;

    let data = buffer.raw_data().to_vec();
    let mut temp = vec![0u8; w * h * 4];

    // Horizontal pass: data -> temp
    for y in 0..h {
        for x in 0..w {
            let mut sum_r: f32 = 0.0;
            let mut sum_g: f32 = 0.0;
            let mut sum_b: f32 = 0.0;

            for k in -radius..=radius {
                let sx = (x as i32 + k).clamp(0, (w as i32) - 1) as usize;
                let idx = (y * w + sx) * 4;
                let weight = kernel[(k + radius) as usize];
                sum_r += data[idx] as f32 * weight;
                sum_g += data[idx + 1] as f32 * weight;
                sum_b += data[idx + 2] as f32 * weight;
            }

            let dst = (y * w + x) * 4;
            temp[dst] = sum_r.round().clamp(0.0, 255.0) as u8;
            temp[dst + 1] = sum_g.round().clamp(0.0, 255.0) as u8;
            temp[dst + 2] = sum_b.round().clamp(0.0, 255.0) as u8;
            temp[dst + 3] = data[dst + 3]; // preserve alpha
        }
    }

    // Vertical pass: temp -> output
    let out = buffer.raw_data_mut();
    for y in 0..h {
        for x in 0..w {
            let mut sum_r: f32 = 0.0;
            let mut sum_g: f32 = 0.0;
            let mut sum_b: f32 = 0.0;

            for k in -radius..=radius {
                let sy = (y as i32 + k).clamp(0, (h as i32) - 1) as usize;
                let idx = (sy * w + x) * 4;
                let weight = kernel[(k + radius) as usize];
                sum_r += temp[idx] as f32 * weight;
                sum_g += temp[idx + 1] as f32 * weight;
                sum_b += temp[idx + 2] as f32 * weight;
            }

            let dst = (y * w + x) * 4;
            out[dst] = sum_r.round().clamp(0.0, 255.0) as u8;
            out[dst + 1] = sum_g.round().clamp(0.0, 255.0) as u8;
            out[dst + 2] = sum_b.round().clamp(0.0, 255.0) as u8;
            out[dst + 3] = temp[dst + 3]; // preserve alpha
        }
    }
}

/// Apply a Gaussian blur only within a rectangular region of the buffer (in-place).
/// Pixels outside the region are unchanged.
pub fn gaussian_blur_region(buffer: &mut PixelBuffer, sigma: f32, rx: u32, ry: u32, rw: u32, rh: u32) {
    if sigma <= 0.0 || rw == 0 || rh == 0 { return; }
    let bw = buffer.width();
    let bh = buffer.height();
    if rx >= bw || ry >= bh { return; }
    let rw = rw.min(bw - rx);
    let rh = rh.min(bh - ry);

    let mut region = buffer.clone_region(rx, ry, rw, rh);
    gaussian_blur(&mut region, sigma);
    for y in 0..rh {
        for x in 0..rw {
            buffer.set_pixel(rx + x, ry + y, region.get_pixel(x, y));
        }
    }
}

/// Apply a motion blur only within a rectangular region of the buffer (in-place).
/// Pixels outside the region are unchanged.
pub fn motion_blur_region(buffer: &mut PixelBuffer, angle: f32, distance: u32, rx: u32, ry: u32, rw: u32, rh: u32) {
    if distance == 0 || rw == 0 || rh == 0 { return; }
    let bw = buffer.width();
    let bh = buffer.height();
    if rx >= bw || ry >= bh { return; }
    let rw = rw.min(bw - rx);
    let rh = rh.min(bh - ry);

    let mut region = buffer.clone_region(rx, ry, rw, rh);
    motion_blur(&mut region, angle, distance);
    for y in 0..rh {
        for x in 0..rw {
            buffer.set_pixel(rx + x, ry + y, region.get_pixel(x, y));
        }
    }
}

/// Apply a motion blur at the given angle (degrees) and distance to the buffer (in-place).
/// Samples pixels along the direction vector defined by the angle.
/// Alpha channel is preserved unchanged.
#[wasm_bindgen]
pub fn motion_blur(buffer: &mut PixelBuffer, angle: f32, distance: u32) {
    if distance == 0 {
        return;
    }

    let w = buffer.width() as usize;
    let h = buffer.height() as usize;
    if w == 0 || h == 0 {
        return;
    }

    let rad = angle.to_radians();
    let dx = rad.cos();
    let dy = rad.sin();
    let num_samples = (distance * 2 + 1) as usize;
    let half = distance as f32;

    let data = buffer.raw_data().to_vec();
    let out = buffer.raw_data_mut();

    for y in 0..h {
        for x in 0..w {
            let mut sum_r: f32 = 0.0;
            let mut sum_g: f32 = 0.0;
            let mut sum_b: f32 = 0.0;
            let mut count: f32 = 0.0;

            for s in 0..num_samples {
                let offset = s as f32 - half;
                let sx = (x as f32 + offset * dx).round();
                let sy = (y as f32 + offset * dy).round();

                // Clamp to buffer boundaries
                let csx = sx.clamp(0.0, (w as f32) - 1.0) as usize;
                let csy = sy.clamp(0.0, (h as f32) - 1.0) as usize;

                let idx = (csy * w + csx) * 4;
                sum_r += data[idx] as f32;
                sum_g += data[idx + 1] as f32;
                sum_b += data[idx + 2] as f32;
                count += 1.0;
            }

            let dst = (y * w + x) * 4;
            out[dst] = (sum_r / count).round().clamp(0.0, 255.0) as u8;
            out[dst + 1] = (sum_g / count).round().clamp(0.0, 255.0) as u8;
            out[dst + 2] = (sum_b / count).round().clamp(0.0, 255.0) as u8;
            out[dst + 3] = data[dst + 3]; // preserve alpha
        }
    }
}
