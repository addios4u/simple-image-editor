// Integration tests for image_io (decode/encode).
// Uses _internal variants to avoid JsValue panics on native targets.

use image_engine::canvas::PixelBuffer;
use image_engine::image_io::{decode_image_internal, encode_image_internal};

/// Create a test PNG by encoding a 2x2 PixelBuffer with known colors.
fn create_test_png_bytes() -> Vec<u8> {
    let mut buf = PixelBuffer::new(2, 2);
    buf.set_pixel(0, 0, 0xFF0000FF); // Red
    buf.set_pixel(1, 0, 0x00FF00FF); // Green
    buf.set_pixel(0, 1, 0x0000FFFF); // Blue
    buf.set_pixel(1, 1, 0xFFFFFFFF); // White
    encode_image_internal(&buf, "png").expect("encoding test PNG should succeed")
}

#[test]
fn test_decode_image_valid_png() {
    let png_bytes = create_test_png_bytes();
    let result = decode_image_internal(&png_bytes);
    assert!(result.is_ok(), "decode_image should succeed for valid PNG");
    let buf = result.unwrap();
    assert_eq!(buf.width(), 2);
    assert_eq!(buf.height(), 2);
}

#[test]
fn test_decode_image_invalid_data_returns_error() {
    let garbage = vec![0x00, 0x01, 0x02, 0x03, 0xFF, 0xFE];
    let result = decode_image_internal(&garbage);
    assert!(result.is_err(), "decode_image should fail for invalid data");
}

#[test]
fn test_encode_decode_png_roundtrip() {
    let mut buf = PixelBuffer::new(4, 4);
    let color: u32 = 0xC86432FF;
    buf.fill_rect(0, 0, 4, 4, color);

    let encoded = encode_image_internal(&buf, "png").expect("PNG encode should succeed");
    let decoded = decode_image_internal(&encoded).expect("PNG decode should succeed");

    assert_eq!(decoded.width(), 4);
    assert_eq!(decoded.height(), 4);

    // PNG is lossless, so pixels should be identical.
    for y in 0..4 {
        for x in 0..4 {
            assert_eq!(
                decoded.get_pixel(x, y), color,
                "PNG round-trip pixel ({},{}) should match", x, y
            );
        }
    }
}

#[test]
fn test_encode_decode_jpeg_roundtrip() {
    let mut buf = PixelBuffer::new(8, 8);
    buf.fill_rect(0, 0, 8, 8, 0x804020FF);

    let encoded = encode_image_internal(&buf, "jpeg").expect("JPEG encode should succeed");
    assert!(!encoded.is_empty(), "JPEG encoded bytes should not be empty");

    let decoded = decode_image_internal(&encoded).expect("JPEG decode should succeed");
    assert_eq!(decoded.width(), 8);
    assert_eq!(decoded.height(), 8);
    let pixel = decoded.get_pixel(4, 4);
    let alpha = pixel & 0xFF;
    assert_eq!(alpha, 255, "JPEG decoded pixel should have full alpha");
}

#[test]
fn test_encode_decode_gif_roundtrip() {
    let mut buf = PixelBuffer::new(4, 4);
    buf.fill_rect(0, 0, 4, 4, 0xFF0000FF); // Solid red

    let encoded = encode_image_internal(&buf, "gif").expect("GIF encode should succeed");
    assert!(!encoded.is_empty(), "GIF encoded bytes should not be empty");

    let decoded = decode_image_internal(&encoded).expect("GIF decode should succeed");
    assert_eq!(decoded.width(), 4);
    assert_eq!(decoded.height(), 4);
}

#[test]
fn test_encode_unsupported_format_returns_error() {
    let buf = PixelBuffer::new(2, 2);
    let result = encode_image_internal(&buf, "bmp");
    assert!(result.is_err(), "encode_image should fail for unsupported format");
}
