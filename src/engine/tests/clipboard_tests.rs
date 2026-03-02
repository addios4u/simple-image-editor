// Integration tests for Clipboard.
// Run with: cargo test

use image_engine::canvas::PixelBuffer;
use image_engine::clipboard::Clipboard;

#[test]
fn test_new_clipboard_has_no_data() {
    let clip = Clipboard::new();
    assert!(!clip.has_data());
}

#[test]
fn test_copy_then_has_data() {
    let mut clip = Clipboard::new();
    let buf = PixelBuffer::new(4, 4);
    clip.copy(&buf, 0, 0, 2, 2);
    assert!(clip.has_data());
}

#[test]
fn test_copy_paste_roundtrip_preserves_pixels() {
    let mut clip = Clipboard::new();
    let mut src = PixelBuffer::new(4, 4);
    let red: u32 = 0xFF0000FF;
    src.fill_rect(1, 1, 2, 2, red);

    // Copy the 2x2 red region.
    clip.copy(&src, 1, 1, 2, 2);

    // Paste onto a new buffer at (0, 0).
    let mut dst = PixelBuffer::new(4, 4);
    clip.paste(&mut dst, 0, 0);

    // The pasted region at (0,0)-(1,1) should be red.
    for y in 0..2 {
        for x in 0..2 {
            assert_eq!(
                dst.get_pixel(x, y), red,
                "pasted pixel ({},{}) should be red", x, y
            );
        }
    }
    // Pixel outside pasted region should be transparent.
    assert_eq!(dst.get_pixel(3, 3), 0);
}

#[test]
fn test_cut_clears_source_region() {
    let mut clip = Clipboard::new();
    let mut src = PixelBuffer::new(4, 4);
    let blue: u32 = 0x0000FFFF;
    src.fill_rect(0, 0, 4, 4, blue);

    // Cut a 2x2 region from (1,1).
    clip.cut(&mut src, 1, 1, 2, 2);

    // Clipboard should have data.
    assert!(clip.has_data());

    // The source region should be cleared to transparent.
    for y in 1..3 {
        for x in 1..3 {
            assert_eq!(
                src.get_pixel(x, y), 0x00000000,
                "cut source pixel ({},{}) should be transparent", x, y
            );
        }
    }
    // Pixels outside the cut region should still be blue.
    assert_eq!(src.get_pixel(0, 0), blue);
    assert_eq!(src.get_pixel(3, 3), blue);
}

#[test]
fn test_paste_to_different_position() {
    let mut clip = Clipboard::new();
    let mut src = PixelBuffer::new(4, 4);
    let green: u32 = 0x00FF00FF;
    src.fill_rect(0, 0, 2, 2, green);

    clip.copy(&src, 0, 0, 2, 2);

    let mut dst = PixelBuffer::new(8, 8);
    clip.paste(&mut dst, 5, 5);

    // Pasted pixels at (5,5), (6,5), (5,6), (6,6) should be green.
    assert_eq!(dst.get_pixel(5, 5), green);
    assert_eq!(dst.get_pixel(6, 5), green);
    assert_eq!(dst.get_pixel(5, 6), green);
    assert_eq!(dst.get_pixel(6, 6), green);
    // Origin should still be transparent.
    assert_eq!(dst.get_pixel(0, 0), 0);
}
