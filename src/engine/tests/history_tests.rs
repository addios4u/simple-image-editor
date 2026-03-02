// Integration tests for history (capture_region / restore_region).
// Run with: cargo test

use image_engine::canvas::PixelBuffer;
use image_engine::history::{capture_region, restore_region};

#[test]
fn test_capture_region_correct_dimensions() {
    let buf = PixelBuffer::new(8, 8);
    let snapshot = capture_region(&buf, 2, 3, 4, 5);
    assert_eq!(snapshot.x(), 2);
    assert_eq!(snapshot.y(), 3);
    assert_eq!(snapshot.width(), 4);
    assert_eq!(snapshot.height(), 5);
}

#[test]
fn test_restore_region_restores_pixels() {
    let mut buf = PixelBuffer::new(8, 8);
    let red: u32 = 0xFF0000FF;
    buf.fill_rect(1, 1, 3, 3, red);

    // Capture the red region.
    let snapshot = capture_region(&buf, 1, 1, 3, 3);

    // Now overwrite the region with blue.
    let blue: u32 = 0x0000FFFF;
    buf.fill_rect(1, 1, 3, 3, blue);

    // Verify it's blue now.
    assert_eq!(buf.get_pixel(2, 2), blue);

    // Restore the snapshot.
    restore_region(&mut buf, &snapshot);

    // Should be back to red.
    for y in 1..4 {
        for x in 1..4 {
            assert_eq!(
                buf.get_pixel(x, y), red,
                "restored pixel ({},{}) should be red", x, y
            );
        }
    }
}

#[test]
fn test_capture_restore_roundtrip_preserves_data() {
    let mut buf = PixelBuffer::new(4, 4);
    // Create a gradient-like pattern.
    for y in 0..4 {
        for x in 0..4 {
            let r = (x * 64) as u32;
            let g = (y * 64) as u32;
            let color = (r << 24) | (g << 16) | (0x80 << 8) | 0xFF;
            buf.set_pixel(x, y, color);
        }
    }

    // Capture the entire buffer.
    let snapshot = capture_region(&buf, 0, 0, 4, 4);

    // Clear the buffer.
    buf.clear();
    assert!(buf.raw_data().iter().all(|&b| b == 0));

    // Restore.
    restore_region(&mut buf, &snapshot);

    // Verify each pixel matches the original pattern.
    for y in 0..4 {
        for x in 0..4 {
            let r = (x * 64) as u32;
            let g = (y * 64) as u32;
            let expected = (r << 24) | (g << 16) | (0x80 << 8) | 0xFF;
            assert_eq!(
                buf.get_pixel(x, y), expected,
                "pixel ({},{}) should match original pattern", x, y
            );
        }
    }
}

#[test]
fn test_capture_out_of_bounds_region() {
    let mut buf = PixelBuffer::new(4, 4);
    let white: u32 = 0xFFFFFFFF;
    buf.fill_rect(0, 0, 4, 4, white);

    // Capture a region that extends beyond the buffer.
    let snapshot = capture_region(&buf, 2, 2, 6, 6);
    assert_eq!(snapshot.width(), 6);
    assert_eq!(snapshot.height(), 6);

    // Restore onto a larger buffer to check partial data.
    let mut big = PixelBuffer::new(10, 10);
    restore_region(&mut big, &snapshot);

    // The 2x2 area that was inside the original buffer should be white.
    assert_eq!(big.get_pixel(2, 2), white);
    assert_eq!(big.get_pixel(3, 3), white);

    // Areas that were out-of-bounds in the capture should be transparent.
    assert_eq!(big.get_pixel(6, 6), 0);
    assert_eq!(big.get_pixel(7, 7), 0);
}
