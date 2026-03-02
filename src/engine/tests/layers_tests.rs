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
