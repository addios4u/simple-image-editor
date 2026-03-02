// Integration tests for PixelBuffer (TDD RED -> GREEN).
// Run with: cargo test

use image_engine::canvas::PixelBuffer;

#[test]
fn test_new_buffer_is_transparent() {
    let buf = PixelBuffer::new(4, 4);
    assert_eq!(buf.width(), 4);
    assert_eq!(buf.height(), 4);
    assert_eq!(buf.data_len(), 4 * 4 * 4);
    // All bytes should be zero (transparent black).
    assert!(buf.raw_data().iter().all(|&b| b == 0));
}

#[test]
fn test_set_and_get_pixel_roundtrip() {
    let mut buf = PixelBuffer::new(10, 10);
    // Pack RGBA: R=255, G=128, B=64, A=200 => 0xFF8040C8
    let color: u32 = 0xFF8040C8;
    buf.set_pixel(3, 7, color);
    assert_eq!(buf.get_pixel(3, 7), color);
}

#[test]
fn test_get_pixel_out_of_bounds_returns_zero() {
    let buf = PixelBuffer::new(8, 8);
    assert_eq!(buf.get_pixel(8, 0), 0);
    assert_eq!(buf.get_pixel(0, 8), 0);
    assert_eq!(buf.get_pixel(100, 100), 0);
}

#[test]
fn test_set_pixel_out_of_bounds_is_noop() {
    let mut buf = PixelBuffer::new(4, 4);
    // Must not panic.
    buf.set_pixel(4, 0, 0xFFFFFFFF);
    buf.set_pixel(0, 4, 0xFFFFFFFF);
    // All pixels still zero.
    assert!(buf.raw_data().iter().all(|&b| b == 0));
}

#[test]
fn test_fill_rect_paints_region() {
    let mut buf = PixelBuffer::new(8, 8);
    let red: u32 = 0xFF0000FF; // R=255, G=0, B=0, A=255
    buf.fill_rect(1, 1, 3, 3, red);

    // Inside region.
    for y in 1..4 {
        for x in 1..4 {
            assert_eq!(buf.get_pixel(x, y), red, "pixel ({},{}) should be red", x, y);
        }
    }
    // Outside region remains transparent.
    assert_eq!(buf.get_pixel(0, 0), 0);
    assert_eq!(buf.get_pixel(4, 4), 0);
}

#[test]
fn test_fill_rect_clamps_to_bounds() {
    let mut buf = PixelBuffer::new(4, 4);
    // Rect extends beyond buffer edge — must not panic.
    buf.fill_rect(2, 2, 10, 10, 0xFFFFFFFF);
    // Pixels inside bounds should be set.
    assert_eq!(buf.get_pixel(2, 2), 0xFFFFFFFF);
    assert_eq!(buf.get_pixel(3, 3), 0xFFFFFFFF);
}

#[test]
fn test_clear_zeroes_all_pixels() {
    let mut buf = PixelBuffer::new(4, 4);
    buf.fill_rect(0, 0, 4, 4, 0xDEADBEEF);
    buf.clear();
    assert!(buf.raw_data().iter().all(|&b| b == 0));
}

#[test]
fn test_clone_region_copies_pixels() {
    let mut src = PixelBuffer::new(8, 8);
    let blue: u32 = 0x0000FFFF; // R=0, G=0, B=255, A=255
    src.fill_rect(2, 2, 4, 4, blue);

    let region = src.clone_region(2, 2, 4, 4);
    assert_eq!(region.width(), 4);
    assert_eq!(region.height(), 4);
    for y in 0..4 {
        for x in 0..4 {
            assert_eq!(region.get_pixel(x, y), blue, "cloned pixel ({},{}) should be blue", x, y);
        }
    }
}

#[test]
fn test_clone_region_out_of_bounds_is_transparent() {
    let src = PixelBuffer::new(4, 4);
    // Clone a region that extends beyond the source.
    let region = src.clone_region(2, 2, 6, 6);
    // All pixels should be transparent (out-of-bounds → 0).
    assert!(region.raw_data().iter().all(|&b| b == 0));
}

#[test]
fn test_paste_writes_to_destination() {
    let mut src = PixelBuffer::new(2, 2);
    let green: u32 = 0x00FF00FF;
    src.fill_rect(0, 0, 2, 2, green);

    let mut dst = PixelBuffer::new(8, 8);
    dst.paste(&src, 3, 3);

    assert_eq!(dst.get_pixel(3, 3), green);
    assert_eq!(dst.get_pixel(4, 3), green);
    assert_eq!(dst.get_pixel(3, 4), green);
    assert_eq!(dst.get_pixel(4, 4), green);
    // Surrounding area stays transparent.
    assert_eq!(dst.get_pixel(2, 3), 0);
    assert_eq!(dst.get_pixel(5, 5), 0);
}

#[test]
fn test_paste_clips_at_destination_edge() {
    let mut src = PixelBuffer::new(4, 4);
    src.fill_rect(0, 0, 4, 4, 0xFFFFFFFF);

    let mut dst = PixelBuffer::new(4, 4);
    // Paste at (2,2): only the top-left 2x2 of src fits.
    dst.paste(&src, 2, 2);

    assert_eq!(dst.get_pixel(2, 2), 0xFFFFFFFF);
    assert_eq!(dst.get_pixel(3, 3), 0xFFFFFFFF);
    // Top-left quadrant is untouched.
    assert_eq!(dst.get_pixel(0, 0), 0);
    assert_eq!(dst.get_pixel(1, 1), 0);
}

#[test]
fn test_data_len_matches_dimensions() {
    let buf = PixelBuffer::new(16, 32);
    assert_eq!(buf.data_len(), 16 * 32 * 4);
}
