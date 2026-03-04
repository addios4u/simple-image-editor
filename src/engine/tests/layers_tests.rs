// Integration tests for LayerCompositor.
// Run with: cargo test

use image_engine::layers::{LayerCompositor, BlendMode};

#[test]
fn test_add_layer_increases_count() {
    let mut comp = LayerCompositor::new(8, 8);
    assert_eq!(comp.layer_count(), 0);
    comp.add_layer();
    assert_eq!(comp.layer_count(), 1);
    comp.add_layer();
    assert_eq!(comp.layer_count(), 2);
}

#[test]
fn test_composite_empty_layers_returns_transparent() {
    let comp = LayerCompositor::new(4, 4);
    let result = comp.composite();
    assert_eq!(result.width(), 4);
    assert_eq!(result.height(), 4);
    // All pixels should be transparent black (0).
    assert!(result.raw_data().iter().all(|&b| b == 0));
}

#[test]
fn test_composite_single_opaque_layer() {
    let mut comp = LayerCompositor::new(2, 2);
    let idx = comp.add_layer();
    let layer_buf = comp.get_layer_buffer_mut(idx).unwrap();
    let red: u32 = 0xFF0000FF; // R=255, G=0, B=0, A=255
    layer_buf.fill_rect(0, 0, 2, 2, red);

    let result = comp.composite();
    for y in 0..2 {
        for x in 0..2 {
            let pixel = result.get_pixel(x, y);
            // Allow rounding tolerance: each channel within +/-1
            let r = (pixel >> 24) & 0xFF;
            let g = (pixel >> 16) & 0xFF;
            let b = (pixel >>  8) & 0xFF;
            let a =  pixel        & 0xFF;
            assert!(r >= 254, "red channel should be ~255, got {}", r);
            assert!(g <= 1,   "green channel should be ~0, got {}", g);
            assert!(b <= 1,   "blue channel should be ~0, got {}", b);
            assert!(a >= 254, "alpha channel should be ~255, got {}", a);
        }
    }
}

#[test]
fn test_composite_two_layers_alpha_blending() {
    // Bottom layer: solid red (fully opaque)
    // Top layer: solid blue at 50% alpha
    // Expected Porter-Duff src-over result:
    //   sa=0.5, da=1.0
    //   out_a = 0.5 + 1.0*(1-0.5) = 1.0
    //   out_r = (0*0.5 + 1*1*(1-0.5))/1.0 = 0.5 => 128
    //   out_g = 0
    //   out_b = (1*0.5 + 0*1*(1-0.5))/1.0 = 0.5 => 128
    let mut comp = LayerCompositor::new(1, 1);

    let bottom = comp.add_layer();
    comp.get_layer_buffer_mut(bottom).unwrap()
        .set_pixel(0, 0, 0xFF0000FF); // Red, alpha=255

    let top = comp.add_layer();
    comp.get_layer_buffer_mut(top).unwrap()
        .set_pixel(0, 0, 0x0000FF80); // Blue, alpha=128 (~0.502)

    let result = comp.composite();
    let pixel = result.get_pixel(0, 0);
    let r = (pixel >> 24) & 0xFF;
    let g = (pixel >> 16) & 0xFF;
    let b = (pixel >>  8) & 0xFF;
    let a =  pixel        & 0xFF;

    // With sa ~= 0.502, da = 1.0:
    //   out_a = 0.502 + 1.0*0.498 = 1.0
    //   out_r = (0*0.502 + 1.0*1.0*0.498)/1.0 ~= 0.498 => ~127
    //   out_b = (1.0*0.502 + 0*1.0*0.498)/1.0 ~= 0.502 => ~128
    // Allow generous rounding tolerance.
    assert!((r as i32 - 127).abs() <= 3, "red should be ~127, got {}", r);
    assert!(g <= 2, "green should be ~0, got {}", g);
    assert!((b as i32 - 128).abs() <= 3, "blue should be ~128, got {}", b);
    assert!(a >= 254, "alpha should be ~255, got {}", a);
}

#[test]
fn test_invisible_layer_skipped_in_composite() {
    let mut comp = LayerCompositor::new(2, 2);
    let idx = comp.add_layer();
    comp.get_layer_buffer_mut(idx).unwrap()
        .fill_rect(0, 0, 2, 2, 0xFF0000FF);

    // Hide the layer.
    comp.set_layer_visible(idx, false);

    let result = comp.composite();
    // All pixels should be transparent since the only layer is invisible.
    assert!(result.raw_data().iter().all(|&b| b == 0));
}

#[test]
fn test_layer_opacity_affects_composite() {
    let mut comp = LayerCompositor::new(1, 1);
    let idx = comp.add_layer();
    // Fully opaque white pixel.
    comp.get_layer_buffer_mut(idx).unwrap()
        .set_pixel(0, 0, 0xFFFFFFFF);

    // Set layer opacity to 50%.
    comp.set_layer_opacity(idx, 0.5);

    let result = comp.composite();
    let pixel = result.get_pixel(0, 0);
    let a = pixel & 0xFF;
    // Layer has pixel alpha=1.0, layer opacity=0.5, effective alpha=0.5
    // Over transparent: out_a = 0.5, rgb = white
    // Alpha channel should be ~128
    assert!((a as i32 - 128).abs() <= 2, "alpha should be ~128, got {}", a);
}

#[test]
fn test_remove_layer() {
    let mut comp = LayerCompositor::new(4, 4);
    comp.add_layer();
    comp.add_layer();
    assert_eq!(comp.layer_count(), 2);
    assert!(comp.remove_layer(0));
    assert_eq!(comp.layer_count(), 1);
    // Removing out-of-bounds index returns false.
    assert!(!comp.remove_layer(5));
}

// --- Phase A-1: Layer access method tests ---

#[test]
fn test_brush_stroke_layer() {
    let mut comp = LayerCompositor::new(10, 10);
    let idx = comp.add_layer();

    // Apply red brush stroke at center
    let red: u32 = 0xFF0000FF;
    comp.brush_stroke_layer(idx, 5.0, 5.0, red, 4.0, 1.0);

    // Center pixel should have red color
    let pixel = comp.get_layer_buffer_mut(idx).unwrap().get_pixel(5, 5);
    let r = (pixel >> 24) & 0xFF;
    let a = pixel & 0xFF;
    assert!(r > 200, "red channel should be high, got {}", r);
    assert!(a > 200, "alpha should be high, got {}", a);
}

#[test]
fn test_brush_stroke_layer_invalid_index() {
    let mut comp = LayerCompositor::new(10, 10);
    // Should not panic on invalid index
    comp.brush_stroke_layer(99, 5.0, 5.0, 0xFF0000FF, 4.0, 1.0);
}

#[test]
fn test_fill_rect_layer() {
    let mut comp = LayerCompositor::new(8, 8);
    let idx = comp.add_layer();

    let blue: u32 = 0x0000FFFF;
    comp.fill_rect_layer(idx, 2, 2, 4, 4, blue);

    let buf = comp.get_layer_buffer_mut(idx).unwrap();
    // Inside fill region
    let pixel = buf.get_pixel(3, 3);
    assert_eq!(pixel, blue);
    // Outside fill region
    let pixel_outside = buf.get_pixel(0, 0);
    assert_eq!(pixel_outside, 0);
}

#[test]
fn test_fill_rect_layer_invalid_index() {
    let mut comp = LayerCompositor::new(8, 8);
    comp.fill_rect_layer(99, 0, 0, 4, 4, 0xFF0000FF);
}

#[test]
fn test_get_layer_data_ptr_and_len() {
    let mut comp = LayerCompositor::new(4, 4);
    let idx = comp.add_layer();

    let ptr = comp.get_layer_data_ptr(idx);
    let len = comp.get_layer_data_len(idx);

    assert!(!ptr.is_null());
    assert_eq!(len, 4 * 4 * 4); // 4x4 pixels * 4 bytes
}

#[test]
fn test_get_layer_data_ptr_invalid_index() {
    let comp = LayerCompositor::new(4, 4);
    assert!(comp.get_layer_data_ptr(99).is_null());
    assert_eq!(comp.get_layer_data_len(99), 0);
}

#[test]
fn test_set_layer_data() {
    let mut comp = LayerCompositor::new(2, 2);
    let idx = comp.add_layer();

    // Create data: all pixels are green
    let mut data = vec![0u8; 2 * 2 * 4];
    for i in 0..4 {
        let base = i * 4;
        data[base] = 0;     // R
        data[base + 1] = 255; // G
        data[base + 2] = 0;   // B
        data[base + 3] = 255; // A
    }

    comp.set_layer_data(idx, &data);

    let buf = comp.get_layer_buffer_mut(idx).unwrap();
    let pixel = buf.get_pixel(0, 0);
    assert_eq!(pixel, 0x00FF00FF); // Green, fully opaque
}

#[test]
fn test_set_layer_data_wrong_size_ignored() {
    let mut comp = LayerCompositor::new(2, 2);
    let idx = comp.add_layer();

    // Wrong size data should be ignored
    let data = vec![0xFFu8; 10]; // not 2*2*4 = 16
    comp.set_layer_data(idx, &data);

    // Buffer should remain all zeros
    let buf = comp.get_layer_buffer_mut(idx).unwrap();
    assert_eq!(buf.get_pixel(0, 0), 0);
}

#[test]
fn test_box_blur_layer() {
    let mut comp = LayerCompositor::new(8, 8);
    let idx = comp.add_layer();

    // Set a single bright pixel
    comp.get_layer_buffer_mut(idx).unwrap()
        .set_pixel(4, 4, 0xFFFFFFFF);

    comp.box_blur_layer(idx, 1);

    // After blur the center pixel should be dimmer (spread to neighbors)
    let pixel = comp.get_layer_buffer_mut(idx).unwrap().get_pixel(4, 4);
    let r = (pixel >> 24) & 0xFF;
    assert!(r < 255, "center should be dimmer after blur, got r={}", r);
    assert!(r > 0, "center should still have some value, got r={}", r);
}

#[test]
fn test_gaussian_blur_layer() {
    let mut comp = LayerCompositor::new(8, 8);
    let idx = comp.add_layer();

    comp.get_layer_buffer_mut(idx).unwrap()
        .set_pixel(4, 4, 0xFFFFFFFF);

    comp.gaussian_blur_layer(idx, 1.0);

    let pixel = comp.get_layer_buffer_mut(idx).unwrap().get_pixel(4, 4);
    let r = (pixel >> 24) & 0xFF;
    assert!(r < 255, "center should be dimmer after gaussian blur");
    assert!(r > 0, "center should still have some value");
}

#[test]
fn test_motion_blur_layer() {
    let mut comp = LayerCompositor::new(8, 8);
    let idx = comp.add_layer();

    // Fill a column for visible motion blur effect
    for y in 0..8 {
        comp.get_layer_buffer_mut(idx).unwrap()
            .set_pixel(4, y, 0xFFFFFFFF);
    }

    comp.motion_blur_layer(idx, 0.0, 2); // horizontal

    // Pixel next to the column should now have some color from the blur
    let pixel = comp.get_layer_buffer_mut(idx).unwrap().get_pixel(3, 4);
    let r = (pixel >> 24) & 0xFF;
    assert!(r > 0, "neighboring pixel should have blur spillover, got r={}", r);
}

#[test]
fn test_capture_and_restore_layer_region() {
    let mut comp = LayerCompositor::new(4, 4);
    let idx = comp.add_layer();

    // Fill with red
    comp.fill_rect_layer(idx, 0, 0, 4, 4, 0xFF0000FF);

    // Capture snapshot
    let snapshot = comp.capture_layer_region(idx, 0, 0, 4, 4);
    assert_eq!(snapshot.width(), 4);
    assert_eq!(snapshot.height(), 4);

    // Overwrite with blue
    comp.fill_rect_layer(idx, 0, 0, 4, 4, 0x0000FFFF);
    let pixel_after = comp.get_layer_buffer_mut(idx).unwrap().get_pixel(0, 0);
    assert_eq!(pixel_after, 0x0000FFFF);

    // Restore snapshot (should be red again)
    comp.restore_layer_region(idx, &snapshot);
    let pixel_restored = comp.get_layer_buffer_mut(idx).unwrap().get_pixel(0, 0);
    assert_eq!(pixel_restored, 0xFF0000FF);
}

#[test]
fn test_capture_layer_region_invalid_index() {
    let comp = LayerCompositor::new(4, 4);
    // Should not panic, returns empty snapshot
    let snapshot = comp.capture_layer_region(99, 0, 0, 4, 4);
    assert_eq!(snapshot.width(), 0);
    assert_eq!(snapshot.height(), 0);
}

#[test]
fn test_width_and_height() {
    let comp = LayerCompositor::new(100, 200);
    assert_eq!(comp.width(), 100);
    assert_eq!(comp.height(), 200);
}

#[test]
fn test_move_layer() {
    let mut comp = LayerCompositor::new(2, 2);
    let l0 = comp.add_layer();
    let l1 = comp.add_layer();
    let l2 = comp.add_layer();

    // Paint each layer a different color
    comp.get_layer_buffer_mut(l0).unwrap().fill_rect(0, 0, 2, 2, 0xFF0000FF); // red
    comp.get_layer_buffer_mut(l1).unwrap().fill_rect(0, 0, 2, 2, 0x00FF00FF); // green
    comp.get_layer_buffer_mut(l2).unwrap().fill_rect(0, 0, 2, 2, 0x0000FFFF); // blue

    // Move layer 0 (red) to index 2 → order becomes [green, blue, red]
    assert!(comp.move_layer(0, 2));
    assert_eq!(comp.layer_count(), 3);

    // The top layer (index 2) should now be red
    let top_pixel = comp.get_layer_buffer_mut(2).unwrap().get_pixel(0, 0);
    assert_eq!(top_pixel, 0xFF0000FF);

    // Index 0 should be green
    let bottom_pixel = comp.get_layer_buffer_mut(0).unwrap().get_pixel(0, 0);
    assert_eq!(bottom_pixel, 0x00FF00FF);
}

#[test]
fn test_move_layer_invalid_index() {
    let mut comp = LayerCompositor::new(2, 2);
    comp.add_layer();
    assert!(!comp.move_layer(0, 5));
    assert!(!comp.move_layer(5, 0));
}

// --- Blend mode tests ---

#[test]
fn test_set_layer_blend_mode() {
    let mut comp = LayerCompositor::new(2, 2);
    let idx = comp.add_layer();
    // Default is Normal
    comp.set_layer_blend_mode(idx, BlendMode::Multiply);
    // Should not panic on invalid index
    comp.set_layer_blend_mode(99, BlendMode::Screen);
}

#[test]
fn test_multiply_blend() {
    // Multiply: result = src * dst per channel
    // Red (1,0,0) * Blue (0,0,1) = Black (0,0,0)
    let mut comp = LayerCompositor::new(1, 1);

    let bottom = comp.add_layer();
    comp.get_layer_buffer_mut(bottom).unwrap()
        .set_pixel(0, 0, 0xFF0000FF); // Red, opaque

    let top = comp.add_layer();
    comp.get_layer_buffer_mut(top).unwrap()
        .set_pixel(0, 0, 0x0000FFFF); // Blue, opaque
    comp.set_layer_blend_mode(top, BlendMode::Multiply);

    let result = comp.composite();
    let pixel = result.get_pixel(0, 0);
    let r = (pixel >> 24) & 0xFF;
    let g = (pixel >> 16) & 0xFF;
    let b = (pixel >>  8) & 0xFF;
    let a =  pixel        & 0xFF;

    // Red * Blue = (1*0, 0*0, 0*1) = Black
    assert!(r <= 1, "red should be ~0, got {}", r);
    assert!(g <= 1, "green should be ~0, got {}", g);
    assert!(b <= 1, "blue should be ~0, got {}", b);
    assert!(a >= 254, "alpha should be ~255, got {}", a);
}

#[test]
fn test_screen_blend() {
    // Screen: result = 1 - (1-src)*(1-dst)
    // Dark red (0.5,0,0) screen dark blue (0,0,0.5)
    // R: 1-(1-0.5)*(1-0) = 0.5, B: 1-(1-0)*(1-0.5) = 0.5
    let mut comp = LayerCompositor::new(1, 1);

    let bottom = comp.add_layer();
    comp.get_layer_buffer_mut(bottom).unwrap()
        .set_pixel(0, 0, 0x800000FF); // ~50% red, opaque

    let top = comp.add_layer();
    comp.get_layer_buffer_mut(top).unwrap()
        .set_pixel(0, 0, 0x000080FF); // ~50% blue, opaque
    comp.set_layer_blend_mode(top, BlendMode::Screen);

    let result = comp.composite();
    let pixel = result.get_pixel(0, 0);
    let r = (pixel >> 24) & 0xFF;
    let b = (pixel >>  8) & 0xFF;
    let a =  pixel        & 0xFF;

    // Screen makes colors brighter; r should stay ~128, b should stay ~128
    assert!((r as i32 - 128).abs() <= 2, "red should be ~128, got {}", r);
    assert!((b as i32 - 128).abs() <= 2, "blue should be ~128, got {}", b);
    assert!(a >= 254, "alpha should be ~255, got {}", a);
}

#[test]
fn test_overlay_blend() {
    // Overlay: if dst < 0.5 → 2*src*dst, else 1-2*(1-src)*(1-dst)
    // White over mid-gray should give white
    let mut comp = LayerCompositor::new(1, 1);

    let bottom = comp.add_layer();
    comp.get_layer_buffer_mut(bottom).unwrap()
        .set_pixel(0, 0, 0x808080FF); // mid gray

    let top = comp.add_layer();
    comp.get_layer_buffer_mut(top).unwrap()
        .set_pixel(0, 0, 0xFFFFFFFF); // white
    comp.set_layer_blend_mode(top, BlendMode::Overlay);

    let result = comp.composite();
    let pixel = result.get_pixel(0, 0);
    let r = (pixel >> 24) & 0xFF;
    // Overlay white on mid-gray (0.502): since dst > 0.5 → 1 - 2*(1-1)*(1-0.502) = 1.0
    assert!(r >= 253, "result should be near white, got r={}", r);
}

#[test]
fn test_difference_blend() {
    // Difference: |src - dst|
    // Same color should give black
    let mut comp = LayerCompositor::new(1, 1);

    let bottom = comp.add_layer();
    comp.get_layer_buffer_mut(bottom).unwrap()
        .set_pixel(0, 0, 0xFF8040FF);

    let top = comp.add_layer();
    comp.get_layer_buffer_mut(top).unwrap()
        .set_pixel(0, 0, 0xFF8040FF); // same color
    comp.set_layer_blend_mode(top, BlendMode::Difference);

    let result = comp.composite();
    let pixel = result.get_pixel(0, 0);
    let r = (pixel >> 24) & 0xFF;
    let g = (pixel >> 16) & 0xFF;
    let b = (pixel >>  8) & 0xFF;

    assert!(r <= 1, "difference of same should be ~0, got r={}", r);
    assert!(g <= 1, "difference of same should be ~0, got g={}", g);
    assert!(b <= 1, "difference of same should be ~0, got b={}", b);
}

#[test]
fn test_normal_blend_unchanged() {
    // Verify Normal blend still works the same after refactor
    let mut comp = LayerCompositor::new(1, 1);

    let bottom = comp.add_layer();
    comp.get_layer_buffer_mut(bottom).unwrap()
        .set_pixel(0, 0, 0xFF0000FF); // Red

    let top = comp.add_layer();
    comp.get_layer_buffer_mut(top).unwrap()
        .set_pixel(0, 0, 0x0000FFFF); // Blue, opaque

    let result = comp.composite();
    let pixel = result.get_pixel(0, 0);
    let r = (pixel >> 24) & 0xFF;
    let b = (pixel >>  8) & 0xFF;
    let a =  pixel        & 0xFF;

    // Opaque blue on top of red → blue
    assert!(r <= 1, "red should be ~0, got {}", r);
    assert!(b >= 254, "blue should be ~255, got {}", b);
    assert!(a >= 254, "alpha should be ~255, got {}", a);
}

// --- Layer offset tests ---

#[test]
fn test_set_layer_offset() {
    let mut comp = LayerCompositor::new(4, 4);
    let idx = comp.add_layer();
    assert_eq!(comp.get_layer_offset_x(idx), 0);
    assert_eq!(comp.get_layer_offset_y(idx), 0);

    comp.set_layer_offset(idx, 10, -5);
    assert_eq!(comp.get_layer_offset_x(idx), 10);
    assert_eq!(comp.get_layer_offset_y(idx), -5);

    // Invalid index should not panic
    comp.set_layer_offset(99, 1, 1);
    assert_eq!(comp.get_layer_offset_x(99), 0);
}

#[test]
fn test_composite_with_offset() {
    // 4x4 canvas, bottom layer red at (0,0), top layer blue offset by (2,0)
    let mut comp = LayerCompositor::new(4, 4);

    let bottom = comp.add_layer();
    comp.fill_rect_layer(bottom, 0, 0, 4, 4, 0xFF0000FF); // all red

    let top = comp.add_layer();
    // Paint blue at column 0 only (x=0, full height)
    comp.fill_rect_layer(top, 0, 0, 1, 4, 0x0000FFFF);
    // Offset top layer by +2 in x → blue column should appear at x=2
    comp.set_layer_offset(top, 2, 0);

    let result = comp.composite();

    // At (0,0): only red (top layer's source pixel would be at x=-2, out of bounds)
    let p00 = result.get_pixel(0, 0);
    let r = (p00 >> 24) & 0xFF;
    let b = (p00 >>  8) & 0xFF;
    assert!(r >= 254, "x=0 should be red, got r={}", r);
    assert!(b <= 1, "x=0 should have no blue, got b={}", b);

    // At (2,0): blue on top of red → blue wins (opaque)
    let p20 = result.get_pixel(2, 0);
    let r2 = (p20 >> 24) & 0xFF;
    let b2 = (p20 >>  8) & 0xFF;
    assert!(r2 <= 1, "x=2 should have blue over red, got r={}", r2);
    assert!(b2 >= 254, "x=2 should be blue, got b={}", b2);

    // At (3,0): no blue content at source x=1 (we only painted x=0) → red
    let p30 = result.get_pixel(3, 0);
    let r3 = (p30 >> 24) & 0xFF;
    assert!(r3 >= 254, "x=3 should still be red, got r={}", r3);
}

// --- Masked pixel extraction tests ---

#[test]
fn test_extract_masked_pixels_full_mask() {
    let mut comp = LayerCompositor::new(2, 2);
    let idx = comp.add_layer();
    comp.fill_rect_layer(idx, 0, 0, 2, 2, 0xFF0000FF); // all red

    // Full mask: all pixels selected
    let mask = vec![255u8; 2 * 2];
    let extracted = comp.extract_masked_pixels(idx, &mask);

    // Extracted buffer should contain the red pixels
    assert_eq!(extracted.width(), 2);
    assert_eq!(extracted.height(), 2);
    assert_eq!(extracted.get_pixel(0, 0), 0xFF0000FF);
    assert_eq!(extracted.get_pixel(1, 1), 0xFF0000FF);

    // Source layer should be cleared to transparent
    let buf = comp.get_layer_buffer_mut(idx).unwrap();
    assert_eq!(buf.get_pixel(0, 0), 0x00000000);
    assert_eq!(buf.get_pixel(1, 1), 0x00000000);
}

#[test]
fn test_extract_masked_pixels_partial_mask() {
    let mut comp = LayerCompositor::new(4, 4);
    let idx = comp.add_layer();
    comp.fill_rect_layer(idx, 0, 0, 4, 4, 0x00FF00FF); // all green

    // Mask: only top-left 2x2
    let mut mask = vec![0u8; 4 * 4];
    for y in 0..2 {
        for x in 0..2 {
            mask[y * 4 + x] = 255;
        }
    }
    let extracted = comp.extract_masked_pixels(idx, &mask);

    // Extracted: top-left has green, bottom-right is transparent
    assert_eq!(extracted.get_pixel(0, 0), 0x00FF00FF);
    assert_eq!(extracted.get_pixel(1, 1), 0x00FF00FF);
    assert_eq!(extracted.get_pixel(2, 2), 0x00000000);
    assert_eq!(extracted.get_pixel(3, 3), 0x00000000);

    // Source: top-left cleared, bottom-right still green
    let buf = comp.get_layer_buffer_mut(idx).unwrap();
    assert_eq!(buf.get_pixel(0, 0), 0x00000000);
    assert_eq!(buf.get_pixel(1, 1), 0x00000000);
    assert_eq!(buf.get_pixel(2, 2), 0x00FF00FF);
    assert_eq!(buf.get_pixel(3, 3), 0x00FF00FF);
}

#[test]
fn test_extract_masked_pixels_empty_mask() {
    let mut comp = LayerCompositor::new(2, 2);
    let idx = comp.add_layer();
    comp.fill_rect_layer(idx, 0, 0, 2, 2, 0xFF0000FF);

    let mask = vec![0u8; 2 * 2]; // all zero
    let extracted = comp.extract_masked_pixels(idx, &mask);

    // Nothing extracted
    assert_eq!(extracted.get_pixel(0, 0), 0x00000000);

    // Source unchanged
    let buf = comp.get_layer_buffer_mut(idx).unwrap();
    assert_eq!(buf.get_pixel(0, 0), 0xFF0000FF);
}

#[test]
fn test_extract_masked_pixels_invalid_index() {
    let mut comp = LayerCompositor::new(2, 2);
    let mask = vec![255u8; 2 * 2];
    let extracted = comp.extract_masked_pixels(99, &mask);
    // Returns empty buffer
    assert_eq!(extracted.get_pixel(0, 0), 0x00000000);
}

#[test]
fn test_extract_masked_pixels_wrong_mask_size() {
    let mut comp = LayerCompositor::new(4, 4);
    let idx = comp.add_layer();
    comp.fill_rect_layer(idx, 0, 0, 4, 4, 0xFF0000FF);

    let mask = vec![255u8; 3]; // wrong size
    let extracted = comp.extract_masked_pixels(idx, &mask);

    // Returns empty, source untouched
    assert_eq!(extracted.get_pixel(0, 0), 0x00000000);
    let buf = comp.get_layer_buffer_mut(idx).unwrap();
    assert_eq!(buf.get_pixel(0, 0), 0xFF0000FF);
}

// --- stamp_buffer_onto_layer tests ---

#[test]
fn test_stamp_buffer_onto_layer_basic() {
    let mut comp = LayerCompositor::new(4, 4);
    let idx = comp.add_layer();
    // Layer starts transparent

    // Source: 2x2 red pixels (RGBA bytes)
    let mut src_data = vec![0u8; 4 * 4 * 4]; // 4x4 canvas size
    // Set pixel (1,1) to red
    let offset = (1 * 4 + 1) * 4;
    src_data[offset] = 255;     // R
    src_data[offset + 1] = 0;   // G
    src_data[offset + 2] = 0;   // B
    src_data[offset + 3] = 255; // A

    comp.stamp_buffer_onto_layer(idx, &src_data, 4, 4, 0, 0);

    let buf = comp.get_layer_buffer_mut(idx).unwrap();
    assert_eq!(buf.get_pixel(1, 1), 0xFF0000FF);
    assert_eq!(buf.get_pixel(0, 0), 0x00000000); // untouched
}

#[test]
fn test_stamp_buffer_onto_layer_with_offset() {
    let mut comp = LayerCompositor::new(4, 4);
    let idx = comp.add_layer();

    // Source: 4x4, pixel at (0,0) is blue
    let mut src_data = vec![0u8; 4 * 4 * 4];
    src_data[0] = 0;       // R
    src_data[1] = 0;       // G
    src_data[2] = 255;     // B
    src_data[3] = 255;     // A

    // Stamp with offset (2, 1) → pixel should appear at (2, 1)
    comp.stamp_buffer_onto_layer(idx, &src_data, 4, 4, 2, 1);

    let buf = comp.get_layer_buffer_mut(idx).unwrap();
    assert_eq!(buf.get_pixel(2, 1), 0x0000FFFF);
    assert_eq!(buf.get_pixel(0, 0), 0x00000000);
}

#[test]
fn test_stamp_buffer_onto_layer_negative_offset_clips() {
    let mut comp = LayerCompositor::new(4, 4);
    let idx = comp.add_layer();

    // Source: 4x4, pixel at (3,3) is green
    let mut src_data = vec![0u8; 4 * 4 * 4];
    let offset = (3 * 4 + 3) * 4;
    src_data[offset] = 0;
    src_data[offset + 1] = 255;
    src_data[offset + 2] = 0;
    src_data[offset + 3] = 255;

    // Stamp with offset (-2, -2) → pixel at src(3,3) should appear at (1,1)
    comp.stamp_buffer_onto_layer(idx, &src_data, 4, 4, -2, -2);

    let buf = comp.get_layer_buffer_mut(idx).unwrap();
    assert_eq!(buf.get_pixel(1, 1), 0x00FF00FF);
    assert_eq!(buf.get_pixel(3, 3), 0x00000000);
}

#[test]
fn test_stamp_buffer_alpha_composite() {
    let mut comp = LayerCompositor::new(1, 1);
    let idx = comp.add_layer();
    // Set layer to solid red
    comp.fill_rect_layer(idx, 0, 0, 1, 1, 0xFF0000FF);

    // Source: semi-transparent blue (alpha=128)
    let src_data = vec![0u8, 0, 255, 128]; // R=0, G=0, B=255, A=128

    comp.stamp_buffer_onto_layer(idx, &src_data, 1, 1, 0, 0);

    let buf = comp.get_layer_buffer_mut(idx).unwrap();
    let pixel = buf.get_pixel(0, 0);
    let r = (pixel >> 24) & 0xFF;
    let b = (pixel >> 8) & 0xFF;
    let a = pixel & 0xFF;

    // Semi-transparent blue over opaque red → blended result
    // sa ~= 0.502, da = 1.0, out_a = 1.0
    // out_b = (1.0*0.502 + 0*1.0*0.498)/1.0 ~= 0.502 → ~128
    // out_r = (0*0.502 + 1.0*1.0*0.498)/1.0 ~= 0.498 → ~127
    assert!((r as i32 - 127).abs() <= 3, "red should be ~127, got {}", r);
    assert!((b as i32 - 128).abs() <= 3, "blue should be ~128, got {}", b);
    assert!(a >= 254, "alpha should be ~255, got {}", a);
}

#[test]
fn test_stamp_buffer_invalid_index() {
    let mut comp = LayerCompositor::new(2, 2);
    let src_data = vec![255u8; 2 * 2 * 4];
    // Should not panic
    comp.stamp_buffer_onto_layer(99, &src_data, 2, 2, 0, 0);
}

// --- Floating layer tests ---

#[test]
fn test_floating_layer_renders_in_composite() {
    let mut comp = LayerCompositor::new(2, 2);
    comp.add_layer(); // empty base layer

    // Set floating layer: 2x2 with red at (0,0)
    let mut data = vec![0u8; 2 * 2 * 4];
    data[0] = 255; data[1] = 0; data[2] = 0; data[3] = 255; // red
    comp.set_floating_layer(&data, 2, 2);

    let result = comp.composite();
    // Red should appear at (0,0)
    assert_eq!(result.get_pixel(0, 0), 0xFF0000FF);
    // Other pixels transparent
    assert_eq!(result.get_pixel(1, 1), 0x00000000);
}

#[test]
fn test_floating_layer_offset() {
    let mut comp = LayerCompositor::new(4, 4);
    comp.add_layer(); // empty base

    // Floating: 4x4, red at (0,0) only
    let mut data = vec![0u8; 4 * 4 * 4];
    data[0] = 255; data[1] = 0; data[2] = 0; data[3] = 255;
    comp.set_floating_layer(&data, 4, 4);
    comp.set_floating_offset(2, 1);

    let result = comp.composite();
    // Red should appear at (2,1) due to offset
    assert_eq!(result.get_pixel(2, 1), 0xFF0000FF);
    // Original position should be empty
    assert_eq!(result.get_pixel(0, 0), 0x00000000);
}

#[test]
fn test_clear_floating_removes_from_composite() {
    let mut comp = LayerCompositor::new(2, 2);
    comp.add_layer();

    let mut data = vec![0u8; 2 * 2 * 4];
    data[0] = 255; data[3] = 255; // red at (0,0)
    comp.set_floating_layer(&data, 2, 2);

    // Verify it renders
    let result1 = comp.composite();
    assert_eq!(result1.get_pixel(0, 0), 0xFF0000FF);

    // Clear and verify it's gone
    comp.clear_floating_layer();
    let result2 = comp.composite();
    assert_eq!(result2.get_pixel(0, 0), 0x00000000);
}

#[test]
fn test_floating_not_in_layer_count() {
    let mut comp = LayerCompositor::new(2, 2);
    comp.add_layer();
    assert_eq!(comp.layer_count(), 1);

    let data = vec![0u8; 2 * 2 * 4];
    comp.set_floating_layer(&data, 2, 2);
    // layer_count should still be 1
    assert_eq!(comp.layer_count(), 1);

    assert!(comp.has_floating_layer());
    comp.clear_floating_layer();
    assert!(!comp.has_floating_layer());
}

#[test]
fn test_floating_layer_composites_over_all_layers() {
    let mut comp = LayerCompositor::new(1, 1);
    let idx = comp.add_layer();
    comp.fill_rect_layer(idx, 0, 0, 1, 1, 0xFF0000FF); // red base

    // Floating: opaque blue
    let data = vec![0u8, 0, 255, 255]; // blue
    comp.set_floating_layer(&data, 1, 1);

    let result = comp.composite();
    let pixel = result.get_pixel(0, 0);
    let r = (pixel >> 24) & 0xFF;
    let b = (pixel >> 8) & 0xFF;
    // Blue floating over red base → blue wins
    assert!(r <= 1, "red should be ~0, got {}", r);
    assert!(b >= 254, "blue should be ~255, got {}", b);
}
