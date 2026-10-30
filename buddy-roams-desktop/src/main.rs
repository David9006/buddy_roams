//! Buddy Roams — a native Windows desktop pet.
//!
//! Uses a `WS_EX_LAYERED` window with `UpdateLayeredWindow` so per-pixel alpha
//! is handled by the OS: transparent pixels pass clicks through to the desktop,
//! opaque pixels are interactive. No WebView, no HTML, no hit-test hacks.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod assets;
mod engine;

use std::cell::RefCell;
use std::ffi::c_void;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use engine::{Config, Pet};
use windows::core::{w, PCWSTR};
use windows::Win32::Foundation::{COLORREF, HINSTANCE, HWND, LPARAM, LRESULT, POINT, SIZE, WPARAM};
use windows::Win32::Graphics::Gdi::{
    CreateCompatibleDC, CreateDIBSection, DeleteDC, DeleteObject, GetDC, GetDeviceCaps, ReleaseDC,
    SelectObject, AC_SRC_ALPHA, AC_SRC_OVER, BI_RGB, BLENDFUNCTION, BITMAPINFO, BITMAPINFOHEADER,
    DIB_RGB_COLORS, LOGPIXELSX,
};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::UI::Input::KeyboardAndMouse::{
    ReleaseCapture, RegisterHotKey, SetCapture, UnregisterHotKey, MOD_ALT, MOD_CONTROL,
    MOD_NOREPEAT, VK_OEM_MINUS, VK_OEM_PLUS,
};
use windows::Win32::UI::Shell::{
    Shell_NotifyIconW, NIF_ICON, NIF_MESSAGE, NIF_TIP, NIM_ADD, NIM_DELETE, NOTIFYICONDATAW,
};
use windows::Win32::UI::WindowsAndMessaging::*;

const TIMER_ID: usize = 1;
const TRAY_MSG: u32 = WM_APP + 1;

// Global hotkey ids (WM_HOTKEY wparam), mirroring the extension's keybindings:
// Ctrl+Alt+= grows, Ctrl+Alt+- shrinks.
const HOTKEY_GROW: i32 = 1;
const HOTKEY_SHRINK: i32 = 2;

// Menu item ids.
const ID_SHOW: usize = 1;
const ID_QUIT: usize = 3;
const ID_RUN: usize = 4;
const ID_GROW: usize = 5;
const ID_SHRINK: usize = 6;
const ID_RESET_SIZE: usize = 7;
const ID_RESET_POS: usize = 8;
const ID_COLOR_BASE: usize = 100;
const ID_ACC_BASE: usize = 200;

const COLORS: &[(&str, &str)] = &[
    ("stable", "Stable"),
    ("insiders", "Insiders"),
    ("#ff8c00", "Exploration"),
    ("#e6536f", "Red"),
    ("#e6c94d", "Yellow"),
    ("#55b85a", "Green"),
    ("#a277e6", "Purple"),
    ("#ed83b5", "Pink"),
    ("#ffffff", "White"),
    ("#000000", "Black"),
];

const ACCESSORIES: &[(&str, &str)] = &[
    ("topHatMonocle", "Grand Top Hat & Monocle"),
    ("cowboyHat", "Cowboy Hat"),
    ("baseballCap", "Baseball Cap"),
    ("constructionHardHat", "Construction Hard Hat"),
    ("firefighterHelmet", "Firefighter Helmet"),
    ("crown", "Crown"),
    ("propellerHat", "Propeller Hat"),
    ("darkSailorHat", "Dark Sailor Hat"),
    ("whiteChefHat", "White Chef Hat"),
    ("bambooHat", "Bamboo Hat"),
    ("strawHat", "Straw Hat"),
    ("pinkPartyHat", "Pink Party Hat"),
    ("wizardHat", "Wizard Hat"),
    ("sailorHat", "Sailor Hat"),
    ("spinnerHat", "Spinner Hat"),
    ("partyHat", "Party Hat"),
    ("artistBeret", "Artist Beret"),
];

struct App {
    hwnd: isize,
    pet: Pet,
    config_path: PathBuf,
    dragging: bool,
    mouse_down_at: u64,
    mouse_down_pos: (f64, f64),
    drag_samples: Vec<(f64, f64, u64)>,
    cursor_samples: Vec<(f64, f64, u64)>,
}

thread_local! {
    static APP: RefCell<Option<App>> = RefCell::new(None);
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn is_april_fools() -> bool {
    let (_, m, d) = utc_date();
    m == 4 && d == 1
}

fn is_halloween() -> bool {
    let (_, m, d) = utc_date();
    m == 10 && d == 31
}

fn utc_date() -> (i64, u32, u32) {
    let days = (SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() / 86_400) as i64;
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}

fn config_path() -> PathBuf {
    let base = std::env::var("APPDATA").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(base).join("BuddyRoams").join("config.json")
}

fn load_config() -> Config {
    let path = config_path();
    if let Ok(text) = std::fs::read_to_string(&path) {
        if let Ok(c) = serde_json::from_str::<Config>(&text) {
            return c;
        }
    }
    Config {
        color: "stable".to_string(),
        accessory: None,
        scale: 1.0,
        position_x: None,
        position_y: None,
    }
}

fn save_config(app: &App) {
    if let Some(dir) = app.config_path.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    let _ = std::fs::write(
        &app.config_path,
        serde_json::to_string_pretty(&app.pet.serialize()).unwrap_or_default(),
    );
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

unsafe fn present(hwnd: HWND, img: &assets::Image, x: i32, y: i32) {
    if img.width == 0 || img.height == 0 {
        return;
    }
    let screen_dc = GetDC(None);
    let mem_dc = CreateCompatibleDC(screen_dc);
    let mut bits: *mut c_void = std::ptr::null_mut();
    let bmi = BITMAPINFO {
        bmiHeader: BITMAPINFOHEADER {
            biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: img.width as i32,
            biHeight: -(img.height as i32),
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB.0,
            biSizeImage: 0,
            biXPelsPerMeter: 0,
            biYPelsPerMeter: 0,
            biClrUsed: 0,
            biClrImportant: 0,
        },
        bmiColors: [Default::default()],
    };
    let dib = CreateDIBSection(mem_dc, &bmi, DIB_RGB_COLORS, &mut bits, None, 0);
    if dib.is_err() {
        DeleteDC(mem_dc);
        ReleaseDC(None, screen_dc);
        return;
    }
    let dib = dib.unwrap();
    let old = SelectObject(mem_dc, dib);

    // Copy RGBA -> premultiplied BGRA (UpdateLayeredWindow expects premultiplied
    // alpha with AC_SRC_ALPHA).
    let buf = std::slice::from_raw_parts_mut(bits as *mut u8, (img.width * img.height * 4) as usize);
    for (src, dst) in img.rgba.chunks_exact(4).zip(buf.chunks_exact_mut(4)) {
        let a = src[3] as u32;
        dst[0] = (src[2] as u32 * a / 255) as u8;
        dst[1] = (src[1] as u32 * a / 255) as u8;
        dst[2] = (src[0] as u32 * a / 255) as u8;
        dst[3] = src[3];
    }

    let blend = BLENDFUNCTION {
        BlendOp: AC_SRC_OVER as u8,
        BlendFlags: 0,
        SourceConstantAlpha: 255,
        AlphaFormat: AC_SRC_ALPHA as u8,
    };
    let pt_src = POINT { x: 0, y: 0 };
    let size = SIZE {
        cx: img.width as i32,
        cy: img.height as i32,
    };
    let pt_dst = POINT { x, y };
    let _ = UpdateLayeredWindow(
        hwnd,
        screen_dc,
        Some(&pt_dst),
        Some(&size),
        mem_dc,
        Some(&pt_src),
        COLORREF(0),
        Some(&blend),
        ULW_ALPHA,
    );
    SelectObject(mem_dc, old);
    DeleteObject(dib);
    DeleteDC(mem_dc);
    ReleaseDC(None, screen_dc);
}

// ---------------------------------------------------------------------------
// Menus
// ---------------------------------------------------------------------------

fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

unsafe fn append(menu: HMENU, flags: MENU_ITEM_FLAGS, id: usize, label: &str) {
    let w = wide(label);
    let _ = AppendMenuW(menu, flags, id, PCWSTR(w.as_ptr()));
}

unsafe fn append_submenu(menu: HMENU, sub: HMENU, label: &str) {
    let w = wide(label);
    let _ = AppendMenuW(menu, MF_POPUP, sub.0 as usize, PCWSTR(w.as_ptr()));
}

unsafe fn build_pet_menu(app: &App) -> HMENU {
    let menu = CreatePopupMenu().unwrap();

    // Accessories submenu.
    let acc_menu = CreatePopupMenu().unwrap();
    append(acc_menu, if app.pet.accessory.is_none() { MF_STRING | MF_CHECKED } else { MF_STRING }, ID_ACC_BASE, "None");
    for (i, (id, label)) in ACCESSORIES.iter().enumerate() {
        let flags = if app.pet.accessory.as_deref() == Some(id) {
            MF_STRING | MF_CHECKED
        } else {
            MF_STRING
        };
        append(acc_menu, flags, ID_ACC_BASE + 1 + i, label);
    }
    append_submenu(menu, acc_menu, "Accessories");

    // Colors submenu.
    let color_menu = CreatePopupMenu().unwrap();
    for (i, (id, label)) in COLORS.iter().enumerate() {
        let flags = if app.pet.color == *id {
            MF_STRING | MF_CHECKED
        } else {
            MF_STRING
        };
        append(color_menu, flags, ID_COLOR_BASE + i, label);
    }
    append_submenu(menu, color_menu, "Colors");

    append(menu, MF_SEPARATOR, 0, "");
    append(menu, MF_STRING, ID_GROW, "Grow");
    append(menu, MF_STRING, ID_SHRINK, "Shrink");
    append(menu, MF_STRING, ID_RESET_SIZE, "Reset Size");
    append(menu, MF_STRING, ID_RESET_POS, "Reset Position");
    append(menu, MF_SEPARATOR, 0, "");
    append(menu, MF_STRING, ID_RUN, "Go on the Run");

    menu
}

unsafe fn build_tray_menu() -> HMENU {
    let menu = CreatePopupMenu().unwrap();
    append(menu, MF_STRING, ID_QUIT, "Exit");
    menu
}

// ---------------------------------------------------------------------------
// Tray
// ---------------------------------------------------------------------------

unsafe fn add_tray(hwnd: HWND) -> HICON {
    let icon = LoadIconW(None, IDI_APPLICATION).unwrap_or_default();
    let mut tip = [0u16; 128];
    for (i, c) in "Buddy Roams".encode_utf16().take(127).enumerate() {
        tip[i] = c;
    }
    let data = NOTIFYICONDATAW {
        cbSize: std::mem::size_of::<NOTIFYICONDATAW>() as u32,
        hWnd: hwnd,
        uID: 1,
        uFlags: NIF_MESSAGE | NIF_ICON | NIF_TIP,
        uCallbackMessage: TRAY_MSG,
        hIcon: icon,
        szTip: tip,
        ..Default::default()
    };
    let _ = Shell_NotifyIconW(NIM_ADD, &data);
    icon
}

unsafe fn remove_tray(icon: HICON) {
    let data = NOTIFYICONDATAW {
        cbSize: std::mem::size_of::<NOTIFYICONDATAW>() as u32,
        uID: 1,
        hIcon: icon,
        ..Default::default()
    };
    let _ = Shell_NotifyIconW(NIM_DELETE, &data);
}

// ---------------------------------------------------------------------------
// Window proc
// ---------------------------------------------------------------------------

unsafe extern "system" fn wndproc(hwnd: HWND, msg: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    match msg {
        WM_LBUTTONDOWN => {
            let mut pt = POINT::default();
            let _ = GetCursorPos(&mut pt);
            APP.with(|cell| {
                let mut app = cell.borrow_mut();
                if let Some(a) = app.as_mut() {
                    // Always track the press so a click on the peeking pet can
                    // bring it back on release.
                    a.dragging = true;
                    a.mouse_down_at = now_ms();
                    a.mouse_down_pos = (pt.x as f64, pt.y as f64);
                    a.drag_samples = vec![(pt.x as f64, pt.y as f64, a.mouse_down_at)];
                    a.pet.begin_drag(a.mouse_down_at);
                }
            });
            let _ = SetCapture(hwnd);
            LRESULT(0)
        }
        WM_MOUSEMOVE => {
            let mut pt = POINT::default();
            let _ = GetCursorPos(&mut pt);
            APP.with(|cell| {
                let mut app = cell.borrow_mut();
                if let Some(a) = app.as_mut() {
                    if a.dragging {
                        let t = now_ms();
                        a.drag_samples.push((pt.x as f64, pt.y as f64, t));
                        while a.drag_samples.len() > 2
                            && t - a.drag_samples[0].2 > 100
                        {
                            a.drag_samples.remove(0);
                        }
                        a.pet.drag_to((pt.x as f64, pt.y as f64));
                    }
                }
            });
            LRESULT(0)
        }
        WM_LBUTTONUP => {
            let mut pt = POINT::default();
            let _ = GetCursorPos(&mut pt);
            APP.with(|cell| {
                let mut app = cell.borrow_mut();
                if let Some(a) = app.as_mut() {
                    if a.dragging {
                        a.dragging = false;
                        let t = now_ms();
                        if a.pet.on_the_run {
                            // Clicking the peeking pet brings it back.
                            a.pet.click(t, (pt.x as f64, pt.y as f64));
                        } else {
                            let (vx, vy) = drag_velocity(&a.drag_samples, t);
                            let moved = (pt.x as f64 - a.mouse_down_pos.0).hypot(pt.y as f64 - a.mouse_down_pos.1) > 2.0;
                            if moved {
                                a.pet.end_drag(t, vx, vy);
                            } else {
                                a.pet.click(t, (pt.x as f64, pt.y as f64));
                            }
                            save_config(a);
                        }
                    }
                }
            });
            let _ = ReleaseCapture();
            LRESULT(0)
        }
        WM_RBUTTONUP => {
            // Build the menu first, then DROP the borrow before TrackPopupMenu:
            // that call runs a modal message loop that re-enters wndproc, and a
            // still-held RefCell borrow would panic there.
            let menu = APP.with(|cell| {
                let mut app = cell.borrow_mut();
                match app.as_mut() {
                    Some(a) => Some(build_pet_menu(a)),
                    None => None,
                }
            });
            if let Some(menu) = menu {
                let mut pt = POINT::default();
                let _ = GetCursorPos(&mut pt);
                let _ = SetForegroundWindow(hwnd);
                let _ = TrackPopupMenu(
                    menu,
                    TPM_RIGHTBUTTON | TPM_BOTTOMALIGN | TPM_LEFTALIGN,
                    pt.x,
                    pt.y,
                    0,
                    hwnd,
                    None,
                );
                let _ = DestroyMenu(menu);
            }
            LRESULT(0)
        }
        WM_TIMER => {
            APP.with(|cell| {
                let mut app = cell.borrow_mut();
                if let Some(a) = app.as_mut() {
                    tick_and_render(a);
                }
            });
            LRESULT(0)
        }
        WM_COMMAND => {
            let id = (wparam.0 & 0xffff) as usize;
            handle_command(hwnd, id);
            LRESULT(0)
        }
        WM_HOTKEY => {
            match wparam.0 as i32 {
                HOTKEY_GROW => handle_command(hwnd, ID_GROW),
                HOTKEY_SHRINK => handle_command(hwnd, ID_SHRINK),
                _ => {}
            }
            LRESULT(0)
        }
        TRAY_MSG => {
            let mouse = lparam.0 as u32;
            if mouse == WM_RBUTTONUP as u32 || mouse == WM_CONTEXTMENU as u32 {
                // Same as above: drop the borrow before TrackPopupMenu.
                let menu = APP.with(|cell| {
                    let app = cell.borrow();
                    if app.is_some() {
                        Some(build_tray_menu())
                    } else {
                        None
                    }
                });
                if let Some(menu) = menu {
                    let mut pt = POINT::default();
                    let _ = GetCursorPos(&mut pt);
                    let _ = SetForegroundWindow(hwnd);
                    let _ = TrackPopupMenu(menu, TPM_RIGHTBUTTON, pt.x, pt.y, 0, hwnd, None);
                    let _ = DestroyMenu(menu);
                }
            } else if mouse == WM_LBUTTONUP as u32 {
                handle_command(hwnd, ID_SHOW);
            }
            LRESULT(0)
        }
        WM_DESTROY => {
            PostQuitMessage(0);
            LRESULT(0)
        }
        _ => DefWindowProcW(hwnd, msg, wparam, lparam),
    }
}

fn drag_velocity(samples: &[(f64, f64, u64)], release: u64) -> (f64, f64) {
    if samples.len() < 2 {
        return (0.0, 0.0);
    }
    let first = *samples.first().unwrap();
    let last = *samples.last().unwrap();
    if release - last.2 > 80 {
        return (0.0, 0.0);
    }
    let elapsed = (last.2 - first.2).max(16) as f64;
    ((last.0 - first.0) / elapsed * 1000.0, (last.1 - first.1) / elapsed * 1000.0)
}

/// Velocity of the cursor from the recent sample history, used to transfer the
/// pointer's own motion into a mouse bounce.
fn sample_velocity(samples: &[(f64, f64, u64)]) -> (f64, f64) {
    if samples.len() < 2 {
        return (0.0, 0.0);
    }
    let first = *samples.first().unwrap();
    let last = *samples.last().unwrap();
    let elapsed = (last.2 - first.2).max(16) as f64;
    ((last.0 - first.0) / elapsed * 1000.0, (last.1 - first.1) / elapsed * 1000.0)
}

unsafe fn handle_command(hwnd: HWND, id: usize) {
    APP.with(|cell| {
        let mut app = cell.borrow_mut();
        let Some(a) = app.as_mut() else { return };
        match id {
            ID_SHOW => {
                a.pet.show(now_ms());
                save_config(a);
            }
            ID_QUIT => {
                save_config(a);
                PostQuitMessage(0);
            }
            ID_RUN => {
                a.pet.toggle_run(now_ms());
                save_config(a);
            }
            ID_GROW => {
                a.pet.set_scale(a.pet.scale + 0.2);
                save_config(a);
            }
            ID_SHRINK => {
                a.pet.set_scale(a.pet.scale - 0.2);
                save_config(a);
            }
            ID_RESET_SIZE => {
                a.pet.set_scale(1.0);
                save_config(a);
            }
            ID_RESET_POS => {
                a.pet.left = 0.0;
                a.pet.top = 0.0;
                a.pet.place_rest();
                save_config(a);
            }
            id if (ID_COLOR_BASE..ID_COLOR_BASE + COLORS.len()).contains(&id) => {
                a.pet.set_color(COLORS[id - ID_COLOR_BASE].0.to_string());
                save_config(a);
            }
            ID_ACC_BASE => {
                a.pet.set_accessory(None, now_ms());
                save_config(a);
            }
            id if (ID_ACC_BASE + 1..ID_ACC_BASE + 1 + ACCESSORIES.len()).contains(&id) => {
                a.pet.set_accessory(Some(ACCESSORIES[id - ID_ACC_BASE - 1].0.to_string()), now_ms());
                save_config(a);
            }
            _ => {}
        }
    });
}

unsafe fn tick_and_render(a: &mut App) {
    let hwnd = HWND(a.hwnd as *mut c_void);
    let mut pt = POINT::default();
    let _ = GetCursorPos(&mut pt);
    let cursor = Some((pt.x as f64, pt.y as f64));

    // Track the cursor's recent positions to derive its velocity, so mouse
    // bounces can transfer the pointer's own motion (plugin parity).
    let now = now_ms();
    a.cursor_samples.push((pt.x as f64, pt.y as f64, now));
    while a.cursor_samples.len() > 2 && now - a.cursor_samples[0].2 > 100 {
        a.cursor_samples.remove(0);
    }
    let cursor_velocity = sample_velocity(&a.cursor_samples);

    a.pet.tick(now, cursor, cursor_velocity);
    let frame = a.pet.render(now, cursor);

    if let Some((img, x, y)) = frame {
        present(hwnd, &img, x as i32, y as i32);
    }
}

fn main() {
    let hmod = unsafe { GetModuleHandleW(None) }.unwrap();
    let hinst = HINSTANCE(hmod.0);
    let class_name = w!("BuddyRoamsWindow");

    unsafe {
        // DPI-aware rendering: the pet's 48px logical size is scaled by the
        // system DPI so it stays the same physical size on high-DPI monitors.
        let _ = SetProcessDPIAware();
        let dpi_scale = {
            let hdc = GetDC(None);
            let dpi = GetDeviceCaps(hdc, LOGPIXELSX);
            ReleaseDC(None, hdc);
            (dpi.max(96) as f64) / 96.0
        };

        let wc = WNDCLASSW {
            style: CS_HREDRAW | CS_VREDRAW,
            lpfnWndProc: Some(wndproc),
            hInstance: hinst,
            lpszClassName: class_name,
            hCursor: LoadCursorW(None, IDC_ARROW).unwrap_or_default(),
            ..Default::default()
        };
        RegisterClassW(&wc);

        let screen_w = GetSystemMetrics(SM_CXSCREEN) as f64;
        let screen_h = GetSystemMetrics(SM_CYSCREEN) as f64;

        let hwnd = CreateWindowExW(
            WS_EX_LAYERED | WS_EX_TOPMOST | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE,
            class_name,
            w!("Buddy Roams"),
            WS_POPUP,
            0,
            0,
            1,
            1,
            None,
            None,
            hinst,
            None,
        )
        .unwrap();

        let config = load_config();
        let pet = Pet::new(
            screen_h,
            screen_w,
            config,
            is_april_fools(),
            is_halloween(),
            dpi_scale,
        );

        APP.with(|cell| {
            *cell.borrow_mut() = Some(App {
                hwnd: hwnd.0 as isize,
                pet,
                config_path: config_path(),
                dragging: false,
                mouse_down_at: 0,
                mouse_down_pos: (0.0, 0.0),
                drag_samples: Vec::new(),
                cursor_samples: Vec::new(),
            });
        });

        let icon = add_tray(hwnd);
        let _ = ShowWindow(hwnd, SW_SHOWNA);
        let _ = SetTimer(hwnd, TIMER_ID, 16, None);
        // Global hotkeys, mirroring the VS Code extension's keybindings.
        let _ = RegisterHotKey(
            hwnd,
            HOTKEY_GROW,
            MOD_CONTROL | MOD_ALT | MOD_NOREPEAT,
            VK_OEM_PLUS.0 as u32,
        );
        let _ = RegisterHotKey(
            hwnd,
            HOTKEY_SHRINK,
            MOD_CONTROL | MOD_ALT | MOD_NOREPEAT,
            VK_OEM_MINUS.0 as u32,
        );

        let mut msg = MSG::default();
        loop {
            let r = GetMessageW(&mut msg, None, 0, 0);
            if r.0 <= 0 {
                break;
            }
            let _ = TranslateMessage(&msg);
            let _ = DispatchMessageW(&msg);
        }

        let _ = KillTimer(hwnd, TIMER_ID);
        let _ = UnregisterHotKey(hwnd, HOTKEY_GROW);
        let _ = UnregisterHotKey(hwnd, HOTKEY_SHRINK);
        remove_tray(icon);
    }
}
