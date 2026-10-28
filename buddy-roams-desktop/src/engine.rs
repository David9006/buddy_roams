//! The Buddy pet engine: state machine, physics, rendering, accessories and
//! festival logic, ported from the VS Code chat pet to native Rust.

use crate::assets::{asset, Image};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOURCE: u32 = 96;
const DISPLAY: f64 = 48.0;
const MIN_SCALE: f64 = 0.4;
const SCALE_STEP: f64 = 0.2;
const DEFAULT_SCALE: f64 = 1.0;
const DEFAULT_RIGHT_INSET: f64 = 32.0;

const IDLE_SLEEP_DELAY: u64 = 20_000;
const WAKE_STATE_DURATION: u64 = 880;

const TRANSIENT_DURATION: u64 = 2_000;
const COMPLETE_DURATION: u64 = 960;
const BUTTON_PRESS_DURATION: u64 = 2_850;
const SPLAT_DURATION: u64 = 520;
const LOVE_DURATION: u64 = 2_940;
const COOL_DURATION: u64 = 3_000;
const SING_DURATION: u64 = 2_880;
const SPEECHLESS_DURATION: u64 = 2_720;
const WORRY_DURATION: u64 = 2_400;
const DIZZY_DURATION: u64 = 2_200;

const DRAG_THRESHOLD: f64 = 2.0;
const THROW_MIN_VELOCITY: f64 = 650.0;
const THROW_MAX_VELOCITY: f64 = 2_400.0;
const THROW_GRAVITY: f64 = 1_800.0;
const THROW_WALL_RESTITUTION: f64 = 0.2;
const THROW_CEILING_RESTITUTION: f64 = 0.2;
const THROW_MAX_DURATION: u64 = 4_000;
const MOUSE_BOUNCE_RELEASE_GRACE: u64 = 500;
const MOUSE_BOUNCE_MIN_UP: f64 = 760.0;
const MOUSE_BOUNCE_MAX_UP: f64 = 1_800.0;
const MOUSE_BOUNCE_V_RESTITUTION: f64 = 0.65;
const MOUSE_BOUNCE_UP_TRANSFER: f64 = 0.4;
const MOUSE_BOUNCE_H_RETENTION: f64 = 0.65;
const MOUSE_BOUNCE_H_TRANSFER: f64 = 0.35;
const MOUSE_BOUNCE_EDGE_KICK: f64 = 320.0;
const MOUSE_BOUNCE_MAX_H: f64 = 1_800.0;
const CONFETTI_SCORE: u32 = 20;

const BLINK_MIN_DELAY: u64 = 1_400;
const BLINK_MAX_DELAY: u64 = 3_400;

const ICON_TRANSFORMATION_CHANCE: f64 = 0.01;
const YAPPING_CHANCE: f64 = 0.01;
const PARTY_HAT_SPIN_CHANCE: f64 = 0.10;
const PARTY_HAT_YAPPING_CHANCE: f64 = 0.10;
const PARTY_HAT_SING_CHANCE: f64 = 0.20;

const WIZARD_EYE_COLOR: [u8; 3] = [0xff, 0x9d, 0x2f];
const WIZARD_INVISIBLE_DURATION: u64 = 2_200;

// Pong
const PONG_BALL_SPEED: f64 = 420.0;
const PONG_PADDLE_WIDTH: f64 = 14.0;
const PONG_PADDLE_HEIGHT: f64 = 110.0;

// ---------------------------------------------------------------------------
// States and frame tables
// ---------------------------------------------------------------------------

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum State {
    Idle,
    Sleep,
    Waking,
    ButtonPress,
    Falling,
    Splat,
    Rendering,
    Love,
    Cool,
    Sing,
    Speechless,
    Worry,
    Dizzy,
    WallImpact,
    Yapping,
    Complete,
}

fn frame_durations(state: State) -> &'static [u64] {
    match state {
        State::Idle => &[40; 50],
        State::Sleep => &[300; 8],
        State::Waking => &[160, 100, 80, 90, 90, 90, 100, 170],
        State::ButtonPress => &[500, 300, 350, 250, 450, 1000],
        State::Falling => &[120, 80, 80, 120, 80, 80],
        State::Splat => &[120, 100, 100, 200],
        State::Rendering => &[40; 50],
        State::Love => &[200, 200, 380, 100, 80, 1980],
        State::Cool => &[600, 120, 120, 120, 160, 80, 80, 80, 1640],
        State::Sing => &[180, 180, 180, 180],
        State::Speechless => &[400, 120, 1000, 120, 1080],
        State::Worry => &[600, 600],
        State::Dizzy => &[120; 8],
        State::WallImpact | State::Yapping => &[],
        State::Complete => &[40; 50],
    }
}

fn transient_duration(state: State) -> u64 {
    match state {
        State::ButtonPress => BUTTON_PRESS_DURATION,
        State::Complete => COMPLETE_DURATION,
        State::Splat => SPLAT_DURATION,
        State::Love => LOVE_DURATION,
        State::Cool => COOL_DURATION,
        State::Sing => SING_DURATION,
        State::Speechless => SPEECHLESS_DURATION,
        State::Worry => WORRY_DURATION,
        State::Dizzy => DIZZY_DURATION,
        State::Waking => WAKE_STATE_DURATION,
        _ => TRANSIENT_DURATION,
    }
}

fn sprite_name(state: State, variant: &str) -> String {
    let base = match state {
        State::Love => "buddy-love",
        State::Cool => "buddy-cool",
        State::ButtonPress => "buddy-press-button",
        State::Falling => "buddy-falling",
        State::Dizzy => "buddy-dizzy",
        State::WallImpact => "buddy-wall-impact",
        State::Splat => "buddy-splat",
        State::Sleep => "buddy-sleep",
        State::Waking => "buddy-waking",
        State::Rendering => "buddy-rendering",
        State::Yapping => "buddy-yapping",
        State::Sing => "buddy-sing",
        State::Speechless => "buddy-speechless",
        State::Worry => "buddy-worry",
        _ => "buddy-idle",
    };
    format!("{}-{}", base, variant)
}

fn frame_size(state: State) -> (u32, u32) {
    match state {
        State::Sleep | State::Waking => (120, 96),
        State::ButtonPress => (160, 96),
        State::Sing => (164, 124),
        State::Dizzy => (96, 128),
        _ => (96, 96),
    }
}

fn tracks_cursor(state: State) -> bool {
    !matches!(
        state,
        State::Sleep
            | State::Waking
            | State::ButtonPress
            | State::Complete
            | State::Love
            | State::Cool
            | State::Sing
            | State::Speechless
            | State::Worry
            | State::Dizzy
            | State::Falling
            | State::WallImpact
            | State::Splat
            | State::Yapping
    )
}

fn blinks(state: State, frame: usize) -> bool {
    (state == State::ButtonPress || state == State::Love)
        && (state != State::ButtonPress || frame + 1 != frame_durations(State::ButtonPress).len())
}

// ---------------------------------------------------------------------------
// Color / tinting
// ---------------------------------------------------------------------------

pub fn body_color(color: &str) -> Option<[u8; 3]> {
    match color {
        "stable" | "insiders" | "" => None,
        hex => parse_hex(hex),
    }
}

fn parse_hex(hex: &str) -> Option<[u8; 3]> {
    let h = hex.trim_start_matches('#');
    let h = if h.len() == 3 {
        format!(
            "{}{}{}{}{}{}",
            &h[0..1],
            &h[0..1],
            &h[1..2],
            &h[1..2],
            &h[2..3],
            &h[2..3]
        )
    } else {
        h.to_string()
    };
    if h.len() != 6 {
        return None;
    }
    let n = u32::from_str_radix(&h, 16).ok()?;
    Some([(n >> 16) as u8, (n >> 8) as u8, n as u8])
}

fn darken(c: [u8; 3], f: f64) -> [u8; 3] {
    [
        (c[0] as f64 * (1.0 - f)).round() as u8,
        (c[1] as f64 * (1.0 - f)).round() as u8,
        (c[2] as f64 * (1.0 - f)).round() as u8,
    ]
}

fn eye_color(color: &str) -> [u8; 3] {
    // Light body colors keep the dark eye; very dark bodies get light eyes.
    if color != "stable" && color != "insiders" {
        if let Some(body) = parse_hex(color) {
            if contrast(body, [0x21, 0x23, 0x24]) < 3.0 {
                return [0xf5, 0xf5, 0xf5];
            }
        }
    }
    [0x19, 0x1a, 0x1b]
}

fn luminance(c: [u8; 3]) -> f64 {
    let chan = |v: u8| {
        let v = v as f64 / 255.0;
        if v <= 0.03928 {
            v / 12.92
        } else {
            ((v + 0.055) / 1.055).powf(2.4)
        }
    };
    0.2126 * chan(c[0]) + 0.7152 * chan(c[1]) + 0.0722 * chan(c[2])
}

fn contrast(a: [u8; 3], b: [u8; 3]) -> f64 {
    let (la, lb) = (luminance(a), luminance(b));
    let (lighter, darker) = if la > lb { (la, lb) } else { (lb, la) };
    (lighter + 0.05) / (darker + 0.05)
}

fn tint(image: &Image, color: [u8; 3]) -> Image {
    let body = color;
    let shade = darken(color, 0.25);
    let shadow = darken(color, 0.5);
    let mut out = image.rgba.clone();
    let eye = eye_color_from_rgb(color);
    for px in out.chunks_exact_mut(4) {
        if px[3] == 0 {
            continue;
        }
        let key = ((px[0] as u32) << 16) | ((px[1] as u32) << 8) | px[2] as u32;
        let rep = match key {
            0x23a8f2 | 0x24bfa5 => Some(body),
            0x0077b8 | 0x009a7c => Some(shade),
            0x004e7c | 0x004538 | 0x006451 | 0x006652 => Some(shadow),
            0x191a1b | 0x212324 => Some(eye),
            _ => None,
        };
        if let Some(r) = rep {
            px[0] = r[0];
            px[1] = r[1];
            px[2] = r[2];
        }
    }
    Image {
        width: image.width,
        height: image.height,
        rgba: out,
    }
}

fn eye_color_from_rgb(color: [u8; 3]) -> [u8; 3] {
    if contrast(color, [0x21, 0x23, 0x24]) < 3.0 {
        [0xf5, 0xf5, 0xf5]
    } else {
        [0x19, 0x1a, 0x1b]
    }
}

// ---------------------------------------------------------------------------
// Accessory rig
// ---------------------------------------------------------------------------

#[derive(Clone, Copy)]
enum Pose {
    Upright,
    Sleeping,
    Airborne,
    Impact,
    Splat,
}

fn pose_column(p: Pose) -> u32 {
    match p {
        Pose::Upright => 0,
        Pose::Sleeping => 1,
        Pose::Airborne => 0,
        Pose::Impact => 2,
        Pose::Splat => 3,
    }
}

fn head_pivot(p: Pose) -> (u32, u32) {
    match p {
        Pose::Upright | Pose::Sleeping | Pose::Airborne => (48, 40),
        Pose::Impact => (48, 32),
        Pose::Splat => (48, 80),
    }
}

const DEFAULT_HEAD: (i64, i64) = (48, 32);
const DEFAULT_EYE: (i64, i64) = (56, 56);
const HEAD_WEAR_OFFSET: i64 = 8;

struct RigFrame {
    pose: Pose,
    head: Option<(i64, i64)>,
    eye: Option<(i64, i64)>,
    hide_eye_accessory: bool,
    mirrors_head: bool,
}

fn default_pose(state: State) -> Pose {
    match state {
        State::Sleep | State::Waking => Pose::Sleeping,
        State::Dizzy | State::Falling => Pose::Airborne,
        State::WallImpact => Pose::Impact,
        State::Splat => Pose::Splat,
        _ => Pose::Upright,
    }
}

fn rig_frame(state: State, frame: usize) -> RigFrame {
    // Track spans (frame -> head/eye anchor).
    #[derive(Clone, Copy)]
    struct Span {
        first: usize,
        last: usize,
        head: (i64, i64),
        eye: (i64, i64),
        pose: Option<Pose>,
        hide_eye: bool,
        mirrors_head: bool,
    }
    let spans: &[Span] = match state {
        State::Idle | State::Rendering => &[
            Span { first: 0, last: 19, head: DEFAULT_HEAD, eye: DEFAULT_EYE, pose: None, hide_eye: false, mirrors_head: false },
            Span { first: 20, last: 49, head: (48, 36), eye: (56, 60), pose: None, hide_eye: false, mirrors_head: false },
        ],
        State::Sleep => &[
            Span { first: 0, last: 2, head: DEFAULT_HEAD, eye: (56, 64), pose: None, hide_eye: false, mirrors_head: false },
            Span { first: 3, last: 7, head: (48, 36), eye: (56, 64), pose: None, hide_eye: false, mirrors_head: false },
        ],
        State::Waking => &[
            Span { first: 0, last: 2, head: (48, 36), eye: (56, 64), pose: Some(Pose::Sleeping), hide_eye: false, mirrors_head: false },
            Span { first: 3, last: 7, head: DEFAULT_HEAD, eye: DEFAULT_EYE, pose: Some(Pose::Upright), hide_eye: false, mirrors_head: false },
        ],
        State::Love => &[
            Span { first: 0, last: 3, head: (48, 36), eye: DEFAULT_EYE, pose: None, hide_eye: false, mirrors_head: false },
            Span { first: 4, last: 5, head: DEFAULT_HEAD, eye: DEFAULT_EYE, pose: None, hide_eye: false, mirrors_head: false },
        ],
        State::Cool => &[
            Span { first: 0, last: 1, head: DEFAULT_HEAD, eye: DEFAULT_EYE, pose: None, hide_eye: false, mirrors_head: false },
            Span { first: 2, last: 2, head: (48, 36), eye: DEFAULT_EYE, pose: None, hide_eye: false, mirrors_head: false },
            Span { first: 3, last: 8, head: DEFAULT_HEAD, eye: DEFAULT_EYE, pose: None, hide_eye: false, mirrors_head: false },
        ],
        State::Sing => &[
            Span { first: 0, last: 3, head: (48, 52), eye: (56, 72), pose: None, hide_eye: false, mirrors_head: false },
        ],
        State::Worry => &[
            Span { first: 0, last: 0, head: DEFAULT_HEAD, eye: DEFAULT_EYE, pose: None, hide_eye: false, mirrors_head: false },
            Span { first: 1, last: 1, head: DEFAULT_HEAD, eye: DEFAULT_EYE, pose: None, hide_eye: false, mirrors_head: true },
        ],
        State::Dizzy => &[
            Span { first: 0, last: 7, head: (48, 48), eye: DEFAULT_EYE, pose: None, hide_eye: true, mirrors_head: false },
        ],
        State::Falling => &[
            Span { first: 0, last: 5, head: DEFAULT_HEAD, eye: (48, 48), pose: None, hide_eye: false, mirrors_head: false },
        ],
        State::Splat => &[
            Span { first: 0, last: 0, head: (48, 72), eye: DEFAULT_EYE, pose: Some(Pose::Splat), hide_eye: true, mirrors_head: false },
            Span { first: 1, last: 1, head: (48, 64), eye: DEFAULT_EYE, pose: Some(Pose::Splat), hide_eye: true, mirrors_head: false },
            Span { first: 2, last: 2, head: (48, 48), eye: DEFAULT_EYE, pose: Some(Pose::Splat), hide_eye: true, mirrors_head: false },
            Span { first: 3, last: 3, head: DEFAULT_HEAD, eye: DEFAULT_EYE, pose: Some(Pose::Upright), hide_eye: false, mirrors_head: false },
        ],
        _ => &[],
    };
    let mut span = None;
    for s in spans {
        if frame >= s.first && frame <= s.last {
            span = Some(*s);
            break;
        }
    }
    let head = span.map(|s| s.head).unwrap_or(DEFAULT_HEAD);
    let hide_eye = span.map(|s| s.hide_eye).unwrap_or(false)
        || matches!(
            state,
            State::Love
                | State::Complete
                | State::Cool
                | State::Speechless
                | State::Worry
                | State::Dizzy
                | State::WallImpact
        );
    let pose = span.and_then(|s| s.pose).unwrap_or(default_pose(state));
    let eye = if hide_eye {
        None
    } else {
        Some(span.map(|s| s.eye).unwrap_or(DEFAULT_EYE))
    };
    let head = if matches!(state, State::Love | State::Complete | State::Dizzy) {
        None
    } else {
        Some((head.0, head.1 + HEAD_WEAR_OFFSET))
    };
    RigFrame {
        pose,
        head,
        eye,
        hide_eye_accessory: hide_eye,
        mirrors_head: span.map(|s| s.mirrors_head).unwrap_or(false),
    }
}

// ---------------------------------------------------------------------------
// Image helpers
// ---------------------------------------------------------------------------

fn blit(dst: &mut Image, src: &Image, dx: i64, dy: i64, sx: u32, sy: u32, sw: u32, sh: u32) {
    for y in 0..sh as i64 {
        let dyy = dy + y;
        if dyy < 0 || dyy >= dst.height as i64 {
            continue;
        }
        for x in 0..sw as i64 {
            let dxx = dx + x;
            if dxx < 0 || dxx >= dst.width as i64 {
                continue;
            }
            let si = (((sy as i64 + y) * src.width as i64 + (sx as i64 + x)) * 4) as usize;
            let di = ((dyy * dst.width as i64 + dxx) * 4) as usize;
            let sa = src.rgba[si + 3] as u32;
            if sa == 0 {
                continue;
            }
            if sa == 255 {
                dst.rgba[di..di + 4].copy_from_slice(&src.rgba[si..si + 4]);
            } else {
                let da = dst.rgba[di + 3] as u32;
                let out_a = sa + da * (255 - sa) / 255;
                if out_a == 0 {
                    continue;
                }
                for c in 0..3 {
                    let s = src.rgba[si + c] as u32;
                    let d = dst.rgba[di + c] as u32;
                    dst.rgba[di + c] = ((s * sa + d * da * (255 - sa) / 255) / out_a) as u8;
                }
                dst.rgba[di + 3] = out_a as u8;
            }
        }
    }
}

fn clear_rect(dst: &mut Image, x: i64, y: i64, w: i64, h: i64) {
    for yy in y..y + h {
        if yy < 0 || yy >= dst.height as i64 {
            continue;
        }
        for xx in x..x + w {
            if xx < 0 || xx >= dst.width as i64 {
                continue;
            }
            let i = ((yy * dst.width as i64 + xx) * 4) as usize;
            dst.rgba[i..i + 4].copy_from_slice(&[0, 0, 0, 0]);
        }
    }
}

fn mirror(img: &Image) -> Image {
    let mut out = vec![0u8; img.rgba.len()];
    let w = img.width as usize;
    for y in 0..img.height as usize {
        for x in 0..w {
            let s = (y * w + x) * 4;
            let d = (y * w + (w - 1 - x)) * 4;
            out[d..d + 4].copy_from_slice(&img.rgba[s..s + 4]);
        }
    }
    Image {
        width: img.width,
        height: img.height,
        rgba: out,
    }
}

fn scale_nearest(img: &Image, w: u32, h: u32) -> Image {
    let mut out = vec![0u8; (w * h * 4) as usize];
    for y in 0..h {
        let sy = (y as f64 * img.height as f64 / h as f64) as u32;
        for x in 0..w {
            let sx = (x as f64 * img.width as f64 / w as f64) as u32;
            let si = ((sy * img.width + sx) * 4) as usize;
            let di = ((y * w + x) * 4) as usize;
            out[di..di + 4].copy_from_slice(&img.rgba[si..si + 4]);
        }
    }
    Image {
        width: w,
        height: h,
        rgba: out,
    }
}

/// Rotates an image by `angle` degrees (counter-clockwise) using nearest-neighbor
/// sampling into a tight bounding box.
fn rotate(img: &Image, angle: f64) -> Image {
    let rad = angle.to_radians();
    let (sin, cos) = (rad.sin().abs(), rad.cos().abs());
    let w = img.width as f64;
    let h = img.height as f64;
    let nw = (h * sin + w * cos).ceil() as u32;
    let nh = (h * cos + w * sin).ceil() as u32;
    let mut out = vec![0u8; (nw * nh * 4) as usize];
    let cx = w / 2.0;
    let cy = h / 2.0;
    let ncx = nw as f64 / 2.0;
    let ncy = nh as f64 / 2.0;
    for y in 0..nh {
        for x in 0..nw {
            let dx = x as f64 - ncx;
            let dy = y as f64 - ncy;
            let sx = (dx * cos - dy * sin) + cx;
            let sy = (dx * sin + dy * cos) + cy;
            if sx < 0.0 || sy < 0.0 || sx >= w - 1.0 || sy >= h - 1.0 {
                continue;
            }
            let si = ((sy as u32 * img.width + sx as u32) * 4) as usize;
            let di = ((y * nw + x) * 4) as usize;
            out[di..di + 4].copy_from_slice(&img.rgba[si..si + 4]);
        }
    }
    Image {
        width: nw,
        height: nh,
        rgba: out,
    }
}

/// 90-degree rotation, counter-clockwise.
fn rotate_ccw90(img: &Image) -> Image {
    let (w, h) = (img.width as usize, img.height as usize);
    let mut out = vec![0u8; img.rgba.len()];
    for y in 0..h {
        for x in 0..w {
            let s = (y * w + x) * 4;
            let d = (x * h + (h - 1 - y)) * 4;
            out[d..d + 4].copy_from_slice(&img.rgba[s..s + 4]);
        }
    }
    Image {
        width: img.height,
        height: img.width,
        rgba: out,
    }
}

// ---------------------------------------------------------------------------
// Accessory atlas drawing
// ---------------------------------------------------------------------------

struct Accessory {
    id: &'static str,
    label: &'static str,
    atlas: &'static str,
    mirrors_eye: bool,
    covers_antennae: bool,
}

const ACCESSORIES: &[Accessory] = &[
    Accessory { id: "topHatMonocle", label: "Grand Top Hat & Monocle", atlas: "grand-top-hat-monocle", mirrors_eye: false, covers_antennae: true },
    Accessory { id: "cowboyHat", label: "Cowboy Hat", atlas: "cowboy-hat", mirrors_eye: true, covers_antennae: true },
    Accessory { id: "baseballCap", label: "Baseball Cap", atlas: "baseball-cap", mirrors_eye: true, covers_antennae: true },
    Accessory { id: "constructionHardHat", label: "Construction Hard Hat", atlas: "construction-hard-hat", mirrors_eye: true, covers_antennae: true },
    Accessory { id: "firefighterHelmet", label: "Firefighter Helmet", atlas: "firefighter-helmet", mirrors_eye: true, covers_antennae: true },
    Accessory { id: "crown", label: "Crown", atlas: "crown", mirrors_eye: true, covers_antennae: true },
    Accessory { id: "propellerHat", label: "Propeller Hat", atlas: "propeller-hat", mirrors_eye: true, covers_antennae: true },
    Accessory { id: "darkSailorHat", label: "Dark Sailor Hat", atlas: "dark-sailor-hat", mirrors_eye: true, covers_antennae: true },
    Accessory { id: "whiteChefHat", label: "White Chef Hat", atlas: "white-chef-hat", mirrors_eye: true, covers_antennae: true },
    Accessory { id: "bambooHat", label: "Bamboo Hat", atlas: "bamboo-hat", mirrors_eye: true, covers_antennae: true },
    Accessory { id: "strawHat", label: "Straw Hat", atlas: "straw-hat", mirrors_eye: true, covers_antennae: true },
    Accessory { id: "pinkPartyHat", label: "Pink Party Hat", atlas: "pink-party-hat", mirrors_eye: true, covers_antennae: true },
    Accessory { id: "wizardHat", label: "Wizard Hat", atlas: "wizard-hat", mirrors_eye: true, covers_antennae: true },
    Accessory { id: "sailorHat", label: "Sailor Hat", atlas: "sailor-hat", mirrors_eye: true, covers_antennae: true },
    Accessory { id: "spinnerHat", label: "Spinner Hat", atlas: "full-size-spinner-hat", mirrors_eye: true, covers_antennae: true },
    Accessory { id: "partyHat", label: "Party Hat", atlas: "leaning-party-hat", mirrors_eye: true, covers_antennae: true },
    Accessory { id: "artistBeret", label: "Artist Beret", atlas: "artist-beret", mirrors_eye: true, covers_antennae: true },
];

pub fn accessory_labels() -> Vec<(&'static str, &'static str)> {
    ACCESSORIES
        .iter()
        .map(|a| (a.id, a.label))
        .collect()
}

fn accessory_by_id(id: &str) -> Option<&'static Accessory> {
    ACCESSORIES.iter().find(|a| a.id == id)
}

// ---------------------------------------------------------------------------
// Composite rendering
// ---------------------------------------------------------------------------

fn draw_accessory_layer(
    dst: &mut Image,
    atlas: &Image,
    pose_col: u32,
    layer: u32,
    head: (i64, i64),
    cell: u32,
    mirror: bool,
    frame_w: u32,
) {
    let src_y = if layer == 0 { 0 } else { cell };
    let pivot = head_pivot(pose_from_col(pose_col));
    let mut dx = head.0 - pivot.0 as i64;
    let dy = head.1 - pivot.1 as i64;
    if mirror {
        dx = frame_w as i64 - dx - cell as i64;
    }
    blit(dst, atlas, dx, dy, pose_col * cell, src_y, cell, cell);
}

fn pose_from_col(col: u32) -> Pose {
    match col {
        1 => Pose::Sleeping,
        2 => Pose::Impact,
        3 => Pose::Splat,
        _ => Pose::Upright,
    }
}

fn draw_eye_accessory(
    dst: &mut Image,
    atlas: &Image,
    pose_col: u32,
    cell: u32,
    anchor: (i64, i64),
    mirror: bool,
    frame_w: u32,
) {
    let mut dx = anchor.0;
    let dy = anchor.1;
    if mirror {
        dx = frame_w as i64 - dx - cell as i64;
    }
    blit(dst, atlas, dx, dy, pose_col * cell, 2 * cell, cell, cell);
}

fn antennae_bounds(rf: &RigFrame) -> Option<(i64, i64, i64, i64)> {
    let head = rf.head?;
    if matches!(rf.pose, Pose::Impact) {
        Some((16, 24, 64, 8))
    } else {
        Some((head.0 - 32, head.1 - 48, 64, 40))
    }
}

/// Renders a single frame of the pet at source resolution into `dst`.
#[allow(clippy::too_many_arguments)]
fn composite_frame(
    dst: &mut Image,
    body: &Image,
    accessory: Option<(&Image, &Accessory)>,
    frame: usize,
    state: State,
    facing_left: bool,
    color: &str,
    skip_body: bool,
) {
    let (fw, fh) = frame_size(state);
    // clear
    for p in dst.rgba.iter_mut() {
        *p = 0;
    }
    let rf = rig_frame(state, frame);
    let pose_col = pose_column(rf.pose);
    let tinted = match body_color(color) {
        Some(c) => tint(body, c),
        None => (*body).clone(),
    };
    let src_x = (frame as u32 * fw).min(body.width.saturating_sub(fw));

    // Draw the body frame (optionally mirrored) into `d`.
    let mirror_body = |d: &mut Image| {
        let mut frame = Image { width: fw, height: fh, rgba: vec![0; (fw * fh * 4) as usize] };
        blit(&mut frame, &tinted, 0, 0, src_x, 0, fw, fh);
        if facing_left {
            let m = mirror(&frame);
            blit(d, &m, 0, 0, 0, 0, fw, fh);
        } else {
            blit(d, &frame, 0, 0, 0, 0, fw, fh);
        }
    };

    if let Some((atlas, acc)) = accessory {
        let cell = atlas.width / 4;
        let mut back = Image { width: fw, height: fh, rgba: vec![0; (fw * fh * 4) as usize] };
        if let Some(head) = rf.head {
            draw_accessory_layer(&mut back, atlas, pose_col, 0, head, cell, facing_left, fw);
        }
        // Body drawn over the back layer.
        let mut body_buf = Image { width: fw, height: fh, rgba: vec![0; (fw * fh * 4) as usize] };
        if !skip_body {
            mirror_body(&mut body_buf);
        }
        // Clear antennae so the back hat layer shows through.
        if acc.covers_antennae {
            if let Some(b) = antennae_bounds(&rf) {
                let x = if facing_left { fw as i64 - b.0 - b.2 } else { b.0 };
                clear_rect(&mut body_buf, x, b.1, b.2, b.3);
            }
        }
        // Compose: back, then body, then front, then eye accessory.
        blit(dst, &back, 0, 0, 0, 0, fw, fh);
        blit(dst, &body_buf, 0, 0, 0, 0, fw, fh);
        if let Some(head) = rf.head {
            let m = facing_left || rf.mirrors_head;
            draw_accessory_layer(dst, atlas, pose_col, 1, head, cell, m, fw);
        }
        if let Some(eye) = rf.eye {
            let mut anchor = eye;
            if facing_left && !acc.mirrors_eye {
                anchor.0 = anchor.0 - 16 + fw as i64 - 96;
            }
            let m = facing_left && acc.mirrors_eye;
            draw_eye_accessory(dst, atlas, pose_col, cell, anchor, m, fw);
        }
    } else if !skip_body {
        mirror_body(dst);
    }
}

fn draw_pupils(
    dst: &mut Image,
    display: f64,
    color: &str,
    eye_color: [u8; 3],
    gaze: (f64, f64),
    facing_left: bool,
    blink: bool,
    state: State,
) {
    let _ = color;
    let s = display / 48.0;
    // Eye/pupil geometry in 48px display space (matches the CSS).
    let eye_size = if matches!(state, State::Idle | State::Rendering | State::ButtonPress | State::Yapping) {
        12.0
    } else {
        8.0
    };
    let eye_top = if state == State::Love { 31.0 } else { 30.0 };
    let pupil_size = if matches!(state, State::Idle | State::Rendering | State::ButtonPress | State::Yapping | State::Love) {
        8.0
    } else {
        4.0
    };
    let (left_x, right_x) = if facing_left { (22.0, 10.0) } else { (18.0, 30.0) };
    let _ = eye_size;
    let px = pupil_size / 2.0;
    for (ex, _) in [(left_x, 0.0), (right_x, 0.0)] {
        // pupil center in 48px space
        let cx = (ex + 2.0 + gaze.0 * 2.0) * s;
        let cy = (eye_top + 2.0 + gaze.1 * 2.0) * s;
        let pw = px * s;
        // draw a small square of the eye color (pixel-art pupil)
        let x0 = (cx - pw / 2.0).round() as i64;
        let y0 = (cy - pw / 2.0).round() as i64;
        let x1 = (cx + pw / 2.0).round() as i64;
        let y1 = (cy + pw / 2.0).round() as i64;
        for y in y0..=y1 {
            for x in x0..=x1 {
                if x < 0 || y < 0 || x >= dst.width as i64 || y >= dst.height as i64 {
                    continue;
                }
                let i = ((y * dst.width as i64 + x) * 4) as usize;
                if blink {
                    // squash to a thin line (eyelid)
                    if (y - y0).abs() > 0 && (y - y1).abs() > 0 {
                        continue;
                    }
                }
                dst.rgba[i] = eye_color[0];
                dst.rgba[i + 1] = eye_color[1];
                dst.rgba[i + 2] = eye_color[2];
                dst.rgba[i + 3] = 255;
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Pet state
// ---------------------------------------------------------------------------

#[derive(Clone, Copy, PartialEq)]
pub enum Facing {
    Left,
    Right,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct Config {
    pub color: String,
    pub accessory: Option<String>,
    pub scale: f64,
    pub position_x: Option<f64>,
    pub position_y: Option<f64>,
}

pub struct Pet {
    // Position: top-left of the 48*scale display box, in screen CSS px.
    pub left: f64,
    pub top: f64,
    pub floor: f64,      // screen height (CSS px)
    pub screen_w: f64,   // screen width
    pub scale: f64,
    pub dpi_scale: f64,
    pub color: String,
    pub accessory: Option<String>,

    base_state: State,
    transient: Option<(State, u64)>,
    dragging: bool,
    facing: Facing,
    gaze: (f64, f64),
    blink: bool,
    next_blink: u64,
    idle_since: u64,

    // animation
    anim_state: State,
    anim_start: u64,

    // throw physics
    throw: Option<ThrowMotion>,
    bounce_count: u32,
    bounce_grace_until: u64,

    // direction-change dizzy tracking
    last_dir: Option<Facing>,
    last_dir_change: u64,
    dir_change_count: u32,

    // wizard
    wizard_invisible_until: u64,

    // april fools
    pub april_fools: bool,
    gravity_pose: bool,
    // pong
    pong: Option<Pong>,
    pub pong_score: u32,

    // go on the run
    pub on_the_run: bool,

    // halloween
    pub halloween: bool,

    rng_state: u64,
}

struct ThrowMotion {
    left: f64,
    top: f64,
    vx: f64,
    vy: f64,
    start: u64,
    spinner: bool,
    propeller: bool,
    propeller_lift: bool,
    grace_until: u64,
    mouse_bounce_armed: bool,
    cursor_contacting: bool,
    wall_impact_until: u64,
}

struct Pong {
    ball_x: f64,
    ball_y: f64,
    vx: f64,
    vy: f64,
    paddle_y: f64,
    pre_game_until: u64,
}

impl Pet {
    pub fn new(floor: f64, screen_w: f64, cfg: Config, april_fools: bool, halloween: bool) -> Self {
        let mut p = Pet {
            left: 0.0,
            top: 0.0,
            floor,
            screen_w,
            scale: cfg.scale.max(MIN_SCALE),
            dpi_scale: 1.0,
            color: cfg.color,
            accessory: cfg.accessory,
            base_state: State::Idle,
            transient: None,
            dragging: false,
            facing: Facing::Right,
            gaze: (0.0, 0.0),
            blink: false,
            next_blink: 0,
            idle_since: 0,
            anim_state: State::Idle,
            anim_start: 0,
            throw: None,
            bounce_count: 0,
            bounce_grace_until: 0,
            last_dir: None,
            last_dir_change: 0,
            dir_change_count: 0,
            wizard_invisible_until: 0,
            april_fools,
            gravity_pose: false,
            pong: None,
            pong_score: 0,
            on_the_run: false,
            halloween,
            rng_state: 0x9e3779b97f4a7c15,
        };
        if let Some(x) = cfg.position_x {
            p.left = x;
        }
        if let Some(y) = cfg.position_y {
            p.top = y;
        }
        p.place_rest();
        p
    }

    fn rng(&mut self) -> f64 {
        self.rng_state ^= self.rng_state << 13;
        self.rng_state ^= self.rng_state >> 7;
        self.rng_state ^= self.rng_state << 17;
        (self.rng_state >> 11) as f64 / (1u64 << 53) as f64
    }

    fn display(&self) -> f64 {
        DISPLAY * self.scale * self.dpi_scale
    }

    fn max_left(&self) -> f64 {
        (self.screen_w - self.display()).max(0.0)
    }

    fn max_top(&self) -> f64 {
        (self.floor - self.display()).max(0.0)
    }

    pub fn place_rest(&mut self) {
        if self.on_the_run {
            return;
        }
        if self.april_fools {
            // Rest against the right wall; vertical axis is the free axis.
            self.left = self.screen_w - self.display();
            if self.top == 0.0 {
                self.top = self.rng() * self.max_top();
            }
            self.gravity_pose = true;
        } else {
            if self.top == 0.0 {
                self.left = self.rng() * self.max_left();
            }
            self.top = self.max_top();
            self.gravity_pose = false;
        }
    }

    pub fn render(&mut self, now: u64, cursor: Option<(f64, f64)>) -> Option<(Image, i64, i64)> {
        if self.on_the_run {
            return None;
        }
        // Gaze
        if let Some((cx, cy)) = cursor {
            let center = (self.left + self.display() / 2.0, self.top + self.display() / 2.0);
            let (dx, dy) = (cx - center.0, cy - center.1);
            let dist = (dx * dx + dy * dy).sqrt();
            self.gaze = if dist < 1.0 {
                (0.0, 0.0)
            } else {
                ((dx / dist).round(), (dy / dist).round())
            };
        }
        // Blink scheduling
        if now >= self.next_blink {
            if blinks(self.anim_state, self.frame_index(now)) {
                self.blink = true;
            }
            self.next_blink = now + BLINK_MIN_DELAY + (self.rng() * (BLINK_MAX_DELAY - BLINK_MIN_DELAY) as f64) as u64;
        } else if self.blink && self.frame_index(now) > 0 {
            self.blink = false;
        }

        let state = self.anim_state;
        let frame = self.frame_index(now);
        let (fw, fh) = frame_size(state);
        let variant = if self.color == "insiders" { "insiders" } else { "stable" };
        let sheet = asset(&format!("{}-{}.spritesheet.png", sprite_name(state, variant), {
            // suffix handling
            match state {
                State::Sing => "124",
                State::Dizzy => "128",
                _ => "96",
            }
        }))
        .or_else(|| {
            let name = sprite_name(state, variant);
            let suffix = match state {
                State::Sing => "124",
                State::Dizzy => "128",
                _ => "96",
            };
            asset(&format!("{}-{}.png", name, suffix))
        })?;

        let skip_body = self.halloween || now < self.wizard_invisible_until;
        let acc_def = self.accessory.as_deref().and_then(accessory_by_id);
        let acc_atlas = acc_def.and_then(|a| asset(&format!("{}.png", a.atlas)));
        let acc = match (&acc_def, &acc_atlas) {
            (Some(a), Some(img)) => Some((img as &Image, *a)),
            _ => None,
        };

        let mut frame_buf = Image { width: fw, height: fh, rgba: vec![0; (fw * fh * 4) as usize] };
        composite_frame(&mut frame_buf, &sheet, acc, frame, state, self.facing == Facing::Left, &self.color, skip_body);

        // Pupils (skip when body is hidden entirely by Halloween/wizard, except
        // the eyes stay for Halloween ghost).
        let eye = if self.halloween {
            WIZARD_EYE_COLOR
        } else {
            eye_color(&self.color)
        };
        let mut display_img = scale_nearest(&frame_buf, (fw as f64 * 0.5 * self.scale * self.dpi_scale).round() as u32, (fh as f64 * 0.5 * self.scale * self.dpi_scale).round() as u32);
        draw_pupils(&mut display_img, self.display(), &self.color, eye, self.gaze, self.facing == Facing::Left, self.blink, state);

        // April Fools' gravity pose: rotate the whole pet -90°.
        if self.gravity_pose {
            display_img = rotate_ccw90(&display_img);
        }

        // Throw rotation.
        if self.throw.is_some() {
            let angle = self.throw_rotation(now);
            if angle != 0.0 {
                display_img = rotate(&display_img, angle);
            }
        }

        // Position: center the composite over the display box.
        let w = display_img.width as i64;
        let h = display_img.height as i64;
        let cx = self.left + self.display() / 2.0;
        let bottom = self.top + self.display();
        let x = (cx - w as f64 / 2.0).round() as i64;
        let y = (bottom - h as f64).round() as i64;
        Some((display_img, x, y))
    }

    fn frame_index(&self, now: u64) -> usize {
        let durs = frame_durations(self.anim_state);
        if durs.is_empty() {
            return 0;
        }
        let elapsed = now.saturating_sub(self.anim_start);
        let total: u64 = durs.iter().sum();
        let one_shot = matches!(
            self.anim_state,
            State::Waking | State::ButtonPress | State::Cool | State::Splat
        );
        if one_shot && elapsed >= total {
            return durs.len() - 1;
        }
        let mut e = elapsed % total;
        for (i, d) in durs.iter().enumerate() {
            if e < *d {
                return i;
            }
            e -= d;
        }
        durs.len() - 1
    }

    fn throw_rotation(&self, now: u64) -> f64 {
        let _ = (self.throw.as_ref(), now);
        0.0 // rotation omitted in the native v1; pet stays upright mid-air
    }

    fn set_state(&mut self, state: State, now: u64) {
        if self.anim_state != state {
            self.anim_state = state;
            self.anim_start = now;
        }
    }

    pub fn wake(&mut self, now: u64) {
        if self.on_the_run {
            return;
        }
        self.idle_since = now;
        if self.base_state == State::Sleep {
            self.base_state = State::Idle;
            self.transient = Some((State::Waking, now + WAKE_STATE_DURATION));
        }
    }

    pub fn click(&mut self, now: u64, cursor: (f64, f64)) {
        if self.on_the_run {
            return;
        }
        self.wake(now);
        if let Some(p) = &self.pong {
            let _ = p;
            return; // pong is mouse-throw only; clicks ignored while active
        }
        if self.throw.is_some() {
            return;
        }
        let party = self.accessory.as_deref() == Some("partyHat");
        let r = self.rng();
        let spin = if party { PARTY_HAT_SPIN_CHANCE } else { ICON_TRANSFORMATION_CHANCE };
        let yapping = if party { PARTY_HAT_YAPPING_CHANCE } else { YAPPING_CHANCE };
        let sing = if party { PARTY_HAT_SING_CHANCE } else { 0.0 };
        let state = if r < spin {
            State::Complete
        } else if r < spin + yapping {
            State::Yapping
        } else if r < spin + yapping + sing {
            State::Sing
        } else {
            let choices = [State::ButtonPress, State::Love, State::Cool, State::Speechless, State::Worry];
            let rest = (r - spin - yapping - sing) / (1.0 - spin - yapping - sing);
            choices[((rest * choices.len() as f64) as usize).min(choices.len() - 1)]
        };
        let dur = transient_duration(state);
        self.transient = Some((state, now + dur));
        self.set_state(state, now);
        let _ = cursor;
    }

    pub fn begin_drag(&mut self, now: u64) {
        if self.on_the_run {
            return;
        }
        self.wake(now);
        self.throw = None;
        self.dragging = true;
        self.set_state(State::Idle, now);
    }

    pub fn drag_to(&mut self, cursor: (f64, f64)) {
        if !self.dragging {
            return;
        }
        self.left = cursor.0 - self.display() / 2.0;
        self.top = cursor.1 - self.display() / 2.0;
        self.clamp_position();
    }

    pub fn end_drag(&mut self, now: u64, vx: f64, vy: f64) {
        self.dragging = false;
        let speed = (vx * vx + vy * vy).sqrt();
        if speed >= THROW_MIN_VELOCITY {
            let s = THROW_MAX_VELOCITY / speed;
            let v = if s < 1.0 { s } else { 1.0 };
            self.begin_throw(vx * v, vy * v, now);
        } else {
            self.finish_throw(now);
        }
    }

    fn clamp_position(&mut self) {
        if self.april_fools {
            // Free axis is vertical; horizontal is fixed to the right wall.
            self.left = self.screen_w - self.display();
            self.top = self.top.clamp(0.0, self.max_top());
        } else {
            self.left = self.left.clamp(0.0, self.max_left());
            self.top = self.top.clamp(0.0, self.max_top());
        }
    }

    fn begin_throw(&mut self, vx: f64, vy: f64, now: u64) {
        // April Fools': a mouse throw starts pong.
        if self.april_fools {
            self.start_pong(now, vx, vy);
            return;
        }
        let spinner = self.accessory.as_deref() == Some("spinnerHat") && vy < 0.0;
        let propeller = self.accessory.as_deref() == Some("propellerHat") && vy < 0.0;
        self.throw = Some(ThrowMotion {
            left: self.left,
            top: self.top,
            vx,
            vy,
            start: now,
            spinner,
            propeller,
            propeller_lift: false,
            grace_until: now + MOUSE_BOUNCE_RELEASE_GRACE,
            mouse_bounce_armed: false,
            cursor_contacting: false,
            wall_impact_until: 0,
        });
        self.bounce_count = 0;
        self.set_state(State::Falling, now);
    }

    fn finish_throw(&mut self, now: u64) {
        self.throw = None;
        // settle on the floor
        self.place_rest();
        self.set_state(State::Splat, now);
        self.transient = Some((State::Splat, now + SPLAT_DURATION));
    }

    pub fn tick(&mut self, now: u64, cursor: Option<(f64, f64)>) {
        // Transient expiry
        if let Some((s, end)) = self.transient {
            if now >= end {
                self.transient = None;
                self.set_state(self.base_state, now);
                if s == State::Waking {
                    // nothing else needed
                }
            }
        }
        // Idle -> sleep
        if self.transient.is_none() && !self.dragging && self.throw.is_none() && self.pong.is_none() && !self.on_the_run {
            if now.saturating_sub(self.idle_since) >= IDLE_SLEEP_DELAY {
                if self.base_state != State::Sleep {
                    self.base_state = State::Sleep;
                    self.set_state(State::Sleep, now);
                }
            }
        }
        // Wizard invisibility expiry
        if now < self.wizard_invisible_until {
            // active
        }

        // Throw physics
        if let Some(t) = self.throw.take() {
            self.step_throw(t, now, cursor);
        }

        // Pong
        if let Some(mut p) = self.pong.take() {
            self.step_pong(&mut p, now, cursor);
            self.pong = Some(p);
        }

        // Keep rendered state in sync when idle
        if self.transient.is_none() && self.throw.is_none() && !self.dragging && self.pong.is_none() {
            self.set_state(self.base_state, now);
        }
    }

    fn step_throw(&mut self, mut t: ThrowMotion, now: u64, cursor: Option<(f64, f64)>) {
        let elapsed = (now.saturating_sub(t.start)).min(32) as f64 / 1000.0;
        let gravity = if t.propeller_lift {
            if t.vy < 0.0 { 5_400.0 } else { 600.0 }
        } else if t.spinner {
            if t.vy < 0.0 { 3_600.0 } else { 600.0 }
        } else if t.propeller {
            if t.vy < 0.0 { 5_400.0 } else { 950.0 }
        } else {
            THROW_GRAVITY
        };

        t.left += t.vx * elapsed;
        t.top += t.vy * elapsed + 0.5 * gravity * elapsed * elapsed;
        t.vy += gravity * elapsed;

        // Wall bounce
        let max_left = self.max_left();
        if t.left < 0.0 {
            t.left = 0.0;
            t.vx = -t.vx * THROW_WALL_RESTITUTION;
            self.wall_impact(now);
        } else if t.left > max_left {
            t.left = max_left;
            t.vx = -t.vx * THROW_WALL_RESTITUTION;
            self.wall_impact(now);
        }
        // Ceiling
        if t.top < 0.0 {
            t.top = 0.0;
            t.vy = t.vy.abs() * THROW_CEILING_RESTITUTION;
        }

        // Mouse bounce
        if now >= t.grace_until {
            if let Some((cx, cy)) = cursor {
                let contacting = cx >= t.left && cx <= t.left + self.display() && cy >= t.top && cy <= t.top + self.display();
                if t.mouse_bounce_armed && !t.cursor_contacting && contacting && t.vy > 0.0 {
                    let pointer_vx: f64 = 0.0; // simplified: no cursor velocity tracking in native v1
                    let pointer_vy: f64 = 0.0;
                    let mut hv = t.vx * MOUSE_BOUNCE_H_RETENTION + pointer_vx * MOUSE_BOUNCE_H_TRANSFER;
                    hv = hv.clamp(-MOUSE_BOUNCE_MAX_H, MOUSE_BOUNCE_MAX_H);
                    let uv = (t.vy * MOUSE_BOUNCE_V_RESTITUTION + pointer_vy.max(0.0) * MOUSE_BOUNCE_UP_TRANSFER).max(MOUSE_BOUNCE_MIN_UP);
                    t.vx = hv;
                    t.vy = -uv.min(MOUSE_BOUNCE_MAX_UP);
                    self.bounce_count += 1;
                    t.mouse_bounce_armed = false;
                }
                t.cursor_contacting = contacting;
                if !contacting {
                    t.mouse_bounce_armed = true;
                }
            }
        }

        self.left = t.left;
        self.top = t.top;

        // Land check (computed before moving `t` back into the throw slot).
        let floor_land = if self.april_fools {
            self.screen_w - self.display()
        } else {
            self.max_top()
        };
        let landed = now.saturating_sub(t.start) >= THROW_MAX_DURATION
            || (self.april_fools && t.left >= floor_land && t.vx >= 0.0)
            || (!self.april_fools && t.top >= floor_land && t.vy >= 0.0);

        if landed {
            self.finish_throw(now);
            if self.bounce_count >= CONFETTI_SCORE {
                self.bounce_count = 0;
            }
        } else {
            self.throw = Some(t);
        }
    }

    fn wall_impact(&mut self, now: u64) {
        self.set_state(State::WallImpact, now);
    }

    fn start_pong(&mut self, now: u64, vx: f64, vy: f64) {
        let speed = (vx * vx + vy * vy).sqrt().max(PONG_BALL_SPEED);
        let mut p = Pong {
            ball_x: self.left + self.display() / 2.0,
            ball_y: self.top + self.display() / 2.0,
            vx: if vx.abs() > 40.0 { vx } else { -PONG_BALL_SPEED },
            vy: vy,
            paddle_y: 0.0,
            pre_game_until: now + 400,
        };
        let _ = speed;
        p.ball_x = self.left;
        p.ball_y = self.top;
        self.pong = Some(p);
        self.set_state(State::Falling, now);
    }

    fn step_pong(&mut self, p: &mut Pong, now: u64, cursor: Option<(f64, f64)>) {
        let elapsed = 16.0 / 1000.0;
        if now < p.pre_game_until {
            // Hold the ball, follow the mouse vertically.
            if let Some((_, cy)) = cursor {
                p.paddle_y = (cy - PONG_PADDLE_HEIGHT / 2.0).clamp(0.0, self.floor - PONG_PADDLE_HEIGHT);
            }
            self.left = p.ball_x;
            self.top = p.ball_y;
            return;
        }
        p.ball_x += p.vx * elapsed;
        p.ball_y += p.vy * elapsed;
        // Top/bottom walls
        if p.ball_y < 0.0 {
            p.ball_y = 0.0;
            p.vy = -p.vy;
        }
        if p.ball_y > self.floor - self.display() {
            p.ball_y = self.floor - self.display();
            p.vy = -p.vy;
        }
        // Right wall = paddle
        let paddle_left = self.screen_w - PONG_PADDLE_WIDTH;
        if p.ball_x + self.display() >= paddle_left
            && p.ball_y + self.display() >= p.paddle_y
            && p.ball_y <= p.paddle_y + PONG_PADDLE_HEIGHT
            && p.vx > 0.0
        {
            p.ball_x = paddle_left - self.display();
            let rel = ((p.ball_y + self.display() / 2.0) - (p.paddle_y + PONG_PADDLE_HEIGHT / 2.0)) / (PONG_PADDLE_HEIGHT / 2.0);
            let angle = rel.clamp(-1.0, 1.0) * 60.0f64.to_radians();
            let sp = (p.vx * p.vx + p.vy * p.vy).sqrt().max(PONG_BALL_SPEED) * 1.02;
            p.vx = -sp * angle.cos();
            p.vy = sp * angle.sin();
        }
        // Left wall = miss
        if p.ball_x < 0.0 {
            self.pong = None;
            self.pong_score = 0;
            self.finish_throw(now);
            return;
        }
        // Score: hitting the paddle increments.
        if p.vx < 0.0 && self.pong_score == 0 {
            self.pong_score += 1;
        }
        if let Some((_, cy)) = cursor {
            p.paddle_y = (cy - PONG_PADDLE_HEIGHT / 2.0).clamp(0.0, self.floor - PONG_PADDLE_HEIGHT);
        }
        self.left = p.ball_x;
        self.top = p.ball_y;
        self.set_state(State::Falling, now);
    }

    pub fn set_scale(&mut self, s: f64) {
        self.scale = s.max(MIN_SCALE);
        self.clamp_position();
    }

    pub fn set_color(&mut self, c: String) {
        self.color = c;
    }

    pub fn set_accessory(&mut self, id: Option<String>) {
        self.accessory = id;
    }

    pub fn toggle_run(&mut self, now: u64) {
        self.on_the_run = !self.on_the_run;
        if !self.on_the_run {
            self.wake(now);
            self.place_rest();
            self.set_state(State::Idle, now);
        }
    }

    pub fn hide(&mut self) {
        self.on_the_run = true;
    }

    pub fn show(&mut self, now: u64) {
        self.on_the_run = false;
        self.wake(now);
        // Randomize the resting spot on every show.
        self.left = self.rng() * self.max_left();
        self.top = self.max_top();
        self.place_rest();
        self.set_state(State::Idle, now);
    }

    /// Serialize the current pet configuration for persistence.
    pub fn serialize(&self) -> Config {
        Config {
            color: self.color.clone(),
            accessory: self.accessory.clone(),
            scale: self.scale,
            position_x: Some(self.left),
            position_y: Some(self.top),
        }
    }
}
