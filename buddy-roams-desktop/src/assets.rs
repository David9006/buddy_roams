//! Embedded pet artwork: decoded RGBA images keyed by asset file name.

include!(concat!(env!("OUT_DIR"), "/generated_assets.rs"));

/// A decoded RGBA8 image.
#[derive(Clone)]
pub struct Image {
    pub width: u32,
    pub height: u32,
    /// Tightly packed RGBA8, row-major.
    pub rgba: Vec<u8>,
}

impl Image {
    pub fn pixel(&self, x: u32, y: u32) -> [u8; 4] {
        let i = ((y * self.width + x) * 4) as usize;
        [
            self.rgba[i],
            self.rgba[i + 1],
            self.rgba[i + 2],
            self.rgba[i + 3],
        ]
    }
}

/// Decodes a PNG byte slice into an RGBA8 image.
pub fn decode_png(bytes: &[u8]) -> Option<Image> {
    let decoder = png::Decoder::new(bytes);
    let mut reader = decoder.read_info().ok()?;
    let mut buf = vec![0u8; reader.output_buffer_size()];
    let info = reader.next_frame(&mut buf).ok()?;
    let (w, h) = (info.width, info.height);

    let rgba = match info.color_type {
        png::ColorType::Rgba => buf,
        png::ColorType::Rgb => {
            let mut out = Vec::with_capacity((w * h * 4) as usize);
            for px in buf.chunks_exact(3) {
                out.extend_from_slice(&[px[0], px[1], px[2], 255]);
            }
            out
        }
        png::ColorType::GrayscaleAlpha => {
            let mut out = Vec::with_capacity((w * h * 4) as usize);
            for px in buf.chunks_exact(2) {
                out.extend_from_slice(&[px[0], px[0], px[0], px[1]]);
            }
            out
        }
        png::ColorType::Grayscale => {
            let mut out = Vec::with_capacity((w * h * 4) as usize);
            for px in buf.chunks_exact(1) {
                out.extend_from_slice(&[px[0], px[0], px[0], 255]);
            }
            out
        }
        _ => return None,
    };

    Some(Image {
        width: w,
        height: h,
        rgba,
    })
}

/// Decodes a single asset by name (e.g. "buddy-idle-stable-96.spritesheet.png").
pub fn asset(name: &str) -> Option<Image> {
    ASSETS
        .iter()
        .find(|(n, _)| *n == name)
        .and_then(|(_, b)| decode_png(b))
}
