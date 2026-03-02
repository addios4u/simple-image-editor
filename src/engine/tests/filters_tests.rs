// Integration tests for blur filters.
// Run with: cargo test

use image_engine::filters::*;
use image_engine::canvas::PixelBuffer;

// ---------------------------------------------------------------------------
// Box Blur Tests
// ---------------------------------------------------------------------------

#[test]
fn test_box_blur_radius_zero_leaves_image_unchanged() {
    let mut buf = PixelBuffer::new(4, 4);
    // Fill with a known pattern
    for y in 0..4 {
        for x in 0..4 {
            let v = ((y * 4 + x) * 17) as u8;
            let rgba = ((v as u32) << 24) | ((v as u32) << 16) | ((v as u32) << 8) | 0xFF;
            buf.set_pixel(x, y, rgba);
        }
    }
    let before: Vec<u8> = buf.raw_data().to_vec();
    box_blur(&mut buf, 0);
    assert_eq!(buf.raw_data(), before.as_slice(), "radius 0 should leave image unchanged");
}

#[test]
fn test_box_blur_uniform_color_unchanged() {
    let mut buf = PixelBuffer::new(5, 5);
    let blue: u32 = 0x0000FFFF; // R=0 G=0 B=255 A=255
    buf.fill_rect(0, 0, 5, 5, blue);
    let before: Vec<u8> = buf.raw_data().to_vec();
    box_blur(&mut buf, 3);
    assert_eq!(buf.raw_data(), before.as_slice(), "uniform color should remain unchanged after blur");
}

#[test]
fn test_box_blur_single_bright_pixel_spreads() {
    let mut buf = PixelBuffer::new(5, 5);
    // Fill with black, alpha 255
    buf.fill_rect(0, 0, 5, 5, 0x000000FF);
    // Set center pixel to white
    buf.set_pixel(2, 2, 0xFFFFFFFF);

    box_blur(&mut buf, 1);

    // Center pixel should have decreased from 255 (spread to neighbors)
    let center = buf.get_pixel(2, 2);
    let center_r = (center >> 24) & 0xFF;
    assert!(center_r < 255, "center should have decreased, got R={}", center_r);

    // A neighbor should have gained some color
    let neighbor = buf.get_pixel(1, 2);
    let neighbor_r = (neighbor >> 24) & 0xFF;
    assert!(neighbor_r > 0, "neighbor should have gained color, got R={}", neighbor_r);
}

#[test]
fn test_box_blur_respects_buffer_boundaries() {
    let mut buf = PixelBuffer::new(3, 3);
    buf.fill_rect(0, 0, 3, 3, 0x000000FF);
    buf.set_pixel(0, 0, 0xFFFFFFFF);
    // Should not panic even with radius larger than buffer
    box_blur(&mut buf, 10);
    // If we get here without panic, the test passes
    let pixel = buf.get_pixel(0, 0);
    let a = pixel & 0xFF;
    assert_eq!(a, 255, "alpha should be preserved");
}

#[test]
fn test_box_blur_radius1_on_3x3_averages_all_pixels() {
    // Create a 3x3 image. With radius=1, center pixel should average all 9 pixels.
    let mut buf = PixelBuffer::new(3, 3);
    // Fill all pixels with alpha 255, varied R channel
    // Row 0: R=10, 20, 30
    // Row 1: R=40, 50, 60
    // Row 2: R=70, 80, 90
    for y in 0..3u32 {
        for x in 0..3u32 {
            let r = ((y * 3 + x + 1) * 10) as u8;
            let rgba = ((r as u32) << 24) | 0x000000FF;
            buf.set_pixel(x, y, rgba);
        }
    }

    box_blur(&mut buf, 1);

    // Center pixel (1,1) averages all 9 pixels: (10+20+30+40+50+60+70+80+90)/9 = 50
    let center = buf.get_pixel(1, 1);
    let center_r = (center >> 24) & 0xFF;
    assert!(
        (center_r as i32 - 50).unsigned_abs() <= 1,
        "center R should be ~50, got {}",
        center_r
    );
}

// ---------------------------------------------------------------------------
// Gaussian Blur Tests
// ---------------------------------------------------------------------------

#[test]
fn test_gaussian_blur_sigma_zero_leaves_image_unchanged() {
    let mut buf = PixelBuffer::new(4, 4);
    for y in 0..4 {
        for x in 0..4 {
            let v = ((y * 4 + x) * 17) as u8;
            let rgba = ((v as u32) << 24) | ((v as u32) << 16) | ((v as u32) << 8) | 0xFF;
            buf.set_pixel(x, y, rgba);
        }
    }
    let before: Vec<u8> = buf.raw_data().to_vec();
    gaussian_blur(&mut buf, 0.0);
    assert_eq!(buf.raw_data(), before.as_slice(), "sigma 0 should leave image unchanged");
}

#[test]
fn test_gaussian_blur_uniform_image_unchanged() {
    let mut buf = PixelBuffer::new(5, 5);
    let red: u32 = 0xFF0000FF;
    buf.fill_rect(0, 0, 5, 5, red);
    let before: Vec<u8> = buf.raw_data().to_vec();
    gaussian_blur(&mut buf, 2.0);
    assert_eq!(buf.raw_data(), before.as_slice(), "uniform color should remain unchanged");
}

#[test]
fn test_gaussian_blur_single_bright_pixel_spreads() {
    let mut buf = PixelBuffer::new(7, 7);
    buf.fill_rect(0, 0, 7, 7, 0x000000FF);
    buf.set_pixel(3, 3, 0xFFFFFFFF);

    gaussian_blur(&mut buf, 1.0);

    // Center should have decreased
    let center = buf.get_pixel(3, 3);
    let center_r = (center >> 24) & 0xFF;
    assert!(center_r < 255, "center should decrease after blur, got R={}", center_r);
    assert!(center_r > 0, "center should still have some color");

    // Neighbor should gain some color
    let neighbor = buf.get_pixel(2, 3);
    let neighbor_r = (neighbor >> 24) & 0xFF;
    assert!(neighbor_r > 0, "adjacent neighbor should gain color, got R={}", neighbor_r);
}

#[test]
fn test_gaussian_blur_spread_falls_off_with_distance() {
    let mut buf = PixelBuffer::new(11, 11);
    buf.fill_rect(0, 0, 11, 11, 0x000000FF);
    buf.set_pixel(5, 5, 0xFF0000FF); // bright red center

    gaussian_blur(&mut buf, 1.5);

    // Center should be brightest
    let center = buf.get_pixel(5, 5);
    let center_r = (center >> 24) & 0xFF;

    // 1 pixel away
    let near = buf.get_pixel(4, 5);
    let near_r = (near >> 24) & 0xFF;

    // 3 pixels away
    let far = buf.get_pixel(2, 5);
    let far_r = (far >> 24) & 0xFF;

    assert!(
        center_r >= near_r,
        "center ({}) should be >= near neighbor ({})",
        center_r, near_r
    );
    assert!(
        near_r >= far_r,
        "near neighbor ({}) should be >= far pixel ({})",
        near_r, far_r
    );
}

// ---------------------------------------------------------------------------
// Motion Blur Tests
// ---------------------------------------------------------------------------

#[test]
fn test_motion_blur_distance_zero_leaves_image_unchanged() {
    let mut buf = PixelBuffer::new(5, 5);
    for y in 0..5 {
        for x in 0..5 {
            let v = ((y * 5 + x) * 10) as u8;
            let rgba = ((v as u32) << 24) | ((v as u32) << 16) | ((v as u32) << 8) | 0xFF;
            buf.set_pixel(x, y, rgba);
        }
    }
    let before: Vec<u8> = buf.raw_data().to_vec();
    motion_blur(&mut buf, 45.0, 0);
    assert_eq!(buf.raw_data(), before.as_slice(), "distance 0 should leave image unchanged");
}

#[test]
fn test_motion_blur_horizontal_blurs_along_x() {
    let mut buf = PixelBuffer::new(9, 5);
    buf.fill_rect(0, 0, 9, 5, 0x000000FF);
    buf.set_pixel(4, 2, 0xFF0000FF); // bright red center

    motion_blur(&mut buf, 0.0, 3); // 0 degrees = horizontal

    // Pixels along horizontal line through center should have gained color
    let left = buf.get_pixel(2, 2);
    let left_r = (left >> 24) & 0xFF;
    assert!(left_r > 0, "horizontal neighbor should gain color, got R={}", left_r);

    // Pixels above/below center should remain mostly dark (no vertical spread)
    let above = buf.get_pixel(4, 0);
    let above_r = (above >> 24) & 0xFF;
    assert!(
        above_r < left_r,
        "vertical pixel ({}) should be dimmer than horizontal pixel ({})",
        above_r, left_r
    );
}

#[test]
fn test_motion_blur_vertical_blurs_along_y() {
    let mut buf = PixelBuffer::new(5, 9);
    buf.fill_rect(0, 0, 5, 9, 0x000000FF);
    buf.set_pixel(2, 4, 0xFF0000FF); // bright red center

    motion_blur(&mut buf, 90.0, 3); // 90 degrees = vertical

    // Pixels along vertical line through center should have gained color
    let above = buf.get_pixel(2, 2);
    let above_r = (above >> 24) & 0xFF;
    assert!(above_r > 0, "vertical neighbor should gain color, got R={}", above_r);

    // Pixels to left/right should remain mostly dark
    let side = buf.get_pixel(0, 4);
    let side_r = (side >> 24) & 0xFF;
    assert!(
        side_r < above_r,
        "horizontal pixel ({}) should be dimmer than vertical pixel ({})",
        side_r, above_r
    );
}

#[test]
fn test_motion_blur_respects_buffer_boundaries() {
    let mut buf = PixelBuffer::new(3, 3);
    buf.fill_rect(0, 0, 3, 3, 0x000000FF);
    buf.set_pixel(0, 0, 0xFFFFFFFF);
    // Should not panic with large distance
    motion_blur(&mut buf, 45.0, 20);
    // If we get here without panic, the test passes
    let pixel = buf.get_pixel(0, 0);
    let a = pixel & 0xFF;
    assert_eq!(a, 255, "alpha should be preserved");
}
