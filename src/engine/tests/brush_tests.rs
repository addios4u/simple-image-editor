// Integration tests for brush_stroke.
// Run with: cargo test

use image_engine::canvas::PixelBuffer;
use image_engine::brush::brush_stroke;

#[test]
fn test_brush_stroke_paints_center_pixel() {
    let mut buf = PixelBuffer::new(10, 10);
    let white: u32 = 0xFFFFFFFF;
    // Paint at center (5, 5) with size 3 (radius 1.5).
    brush_stroke(&mut buf, 5.0, 5.0, white, 3.0, 1.0);

    // The center pixel (5, 5) should be painted.
    let pixel = buf.get_pixel(5, 5);
    let a = pixel & 0xFF;
    assert!(a > 200, "center pixel alpha should be high, got {}", a);
}

#[test]
fn test_brush_stroke_hardness_1_creates_solid_circle() {
    let mut buf = PixelBuffer::new(20, 20);
    let red: u32 = 0xFF0000FF;
    // Paint at (10, 10) with size 10 (radius 5), hardness 1.0.
    brush_stroke(&mut buf, 10.0, 10.0, red, 10.0, 1.0);

    // Center should be fully painted.
    let center = buf.get_pixel(10, 10);
    let center_r = (center >> 24) & 0xFF;
    let center_a = center & 0xFF;
    assert!(center_r >= 250, "center R should be ~255, got {}", center_r);
    assert!(center_a >= 250, "center A should be ~255, got {}", center_a);

    // Pixel well outside the circle should be transparent.
    let outside = buf.get_pixel(0, 0);
    assert_eq!(outside, 0, "pixel far outside brush should be transparent");
}

#[test]
fn test_brush_stroke_respects_buffer_boundaries() {
    let mut buf = PixelBuffer::new(4, 4);
    let color: u32 = 0xFFFFFFFF;
    // Paint at edge (0, 0) with large brush -- should not panic.
    brush_stroke(&mut buf, 0.0, 0.0, color, 20.0, 1.0);
    // Paint at far corner.
    brush_stroke(&mut buf, 3.0, 3.0, color, 20.0, 1.0);
    // If we get here without panic, the test passes.
    assert!(true);
}

#[test]
fn test_brush_stroke_size_zero_no_crash() {
    let mut buf = PixelBuffer::new(4, 4);
    // Size 0 should not panic or modify pixels.
    brush_stroke(&mut buf, 2.0, 2.0, 0xFFFFFFFF, 0.0, 1.0);
    // Buffer should still be all zeros.
    assert!(buf.raw_data().iter().all(|&b| b == 0));
}

#[test]
fn test_brush_stroke_color_applied_correctly() {
    let mut buf = PixelBuffer::new(10, 10);
    let green: u32 = 0x00FF00FF; // R=0, G=255, B=0, A=255
    brush_stroke(&mut buf, 5.0, 5.0, green, 4.0, 1.0);

    let pixel = buf.get_pixel(5, 5);
    let r = (pixel >> 24) & 0xFF;
    let g = (pixel >> 16) & 0xFF;
    let b = (pixel >>  8) & 0xFF;
    let a =  pixel        & 0xFF;

    // Green channel should dominate.
    assert!(g >= 250, "green channel should be ~255, got {}", g);
    assert!(r <= 5,   "red channel should be ~0, got {}", r);
    assert!(b <= 5,   "blue channel should be ~0, got {}", b);
    assert!(a >= 250, "alpha should be ~255, got {}", a);
}
