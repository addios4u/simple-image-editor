// Integration tests for LayerCompositor.
// Run with: cargo test

use image_engine::layers::LayerCompositor;

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
