use std::sync::Mutex;

use serde_json::Value;
use tauri::{
	menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu},
	tray::TrayIconBuilder,
	Emitter, Manager,
};

/// The pet's interactive rectangle in logical window coordinates: "x,y,w,h".
/// An empty string means "fully click-through" (no interactive area).
#[derive(Default)]
struct InteractiveRegion {
	rect: String,
}

/// Reports the pet's current bounding box (in logical CSS pixels) so the host
/// can make every pixel except the pet click-through.
#[tauri::command]
fn set_interactive_region(state: tauri::State<'_, Mutex<InteractiveRegion>>, rect: String) {
	if let Ok(mut s) = state.lock() {
		s.rect = rect.clone();
	}
	#[cfg(target_os = "windows")]
	crate::win32::update_hit_region(&rect);
}

/// Renders a native context menu from the engine's JSON menu spec and emits
/// "pet-menu-action" with the selected action id.
#[tauri::command]
fn show_pet_menu(app: tauri::AppHandle, window: tauri::WebviewWindow, items_json: String) {
	let Ok(items) = serde_json::from_str::<Value>(&items_json) else {
		return;
	};
	let Some(arr) = items.as_array() else {
		return;
	};

	let entries = build_menu_items(&app, arr);
	if entries.is_empty() {
		return;
	}
	let refs: Vec<&dyn tauri::menu::IsMenuItem<tauri::Wry>> =
		entries.iter().map(|b| b.as_ref()).collect();
	let Ok(menu) = Menu::with_items(&app, &refs) else {
		return;
	};
	let _ = window.popup_menu(&menu);
}

type MenuEntryBox = Box<dyn tauri::menu::IsMenuItem<tauri::Wry>>;

fn build_menu_items(app: &tauri::AppHandle, items: &[Value]) -> Vec<MenuEntryBox> {
	let mut out: Vec<MenuEntryBox> = Vec::new();
	for it in items {
		let Some(obj) = it.as_object() else { continue };
		let ty = obj.get("type").and_then(|v| v.as_str()).unwrap_or("action");
		let id = obj.get("id").and_then(|v| v.as_str()).unwrap_or("");
		let label = obj.get("label").and_then(|v| v.as_str()).unwrap_or("");
		let enabled = obj.get("enabled").map(|v| v.as_bool().unwrap_or(true)).unwrap_or(true);
		let checked = obj.get("checked").and_then(|v| v.as_bool());

		match ty {
			"separator" => {
				if let Ok(m) = PredefinedMenuItem::separator(app) {
					out.push(Box::new(m));
				}
			}
			"submenu" => {
				let children = obj
					.get("items")
					.and_then(|v| v.as_array())
					.cloned()
					.unwrap_or_default();
				let sub = build_menu_items(app, &children);
				if !sub.is_empty() {
					let sub_refs: Vec<&dyn tauri::menu::IsMenuItem<tauri::Wry>> =
						sub.iter().map(|b| b.as_ref()).collect();
					if let Ok(m) = Submenu::with_items(app, label, enabled, &sub_refs) {
						out.push(Box::new(m));
					}
				}
			}
			_ => {
				if let Some(checked) = checked {
					if let Ok(m) = CheckMenuItem::with_id(app, id, label, enabled, checked, None::<&str>) {
						out.push(Box::new(m));
					}
				} else if let Ok(m) = MenuItem::with_id(app, id, label, enabled, None::<&str>) {
					out.push(Box::new(m));
				}
			}
		}
	}
	out
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
	let app = tauri::Builder::default()
		.manage(Mutex::new(InteractiveRegion::default()))
		.invoke_handler(tauri::generate_handler![set_interactive_region, show_pet_menu])
		.setup(|app| {
			create_overlay_window(app.handle())?;
			create_tray(app.handle())?;

			// Pet context-menu actions: forward the selected id to the webview.
			app.on_menu_event(|app, event| {
				let id = event.id().as_ref().to_string();
				if id == "pet_quit" || id == "pet_show" || id == "pet_hide" {
					return; // tray items are handled in the tray's own handler
				}
				let _ = app.emit("pet-menu-action", id);
			});

			Ok(())
		})
		.build(tauri::generate_context!())
		.expect("error while building tauri application");

	app.run(|_app_handle, _event| {});
}

fn create_overlay_window(app: &tauri::AppHandle) -> tauri::Result<()> {
	use tauri::{WebviewUrl, WebviewWindowBuilder};

	let monitor = app.primary_monitor()?.ok_or_else(|| {
		std::io::Error::new(std::io::ErrorKind::NotFound, "no primary monitor")
	})?;
	let size = monitor.size();
	let pos = monitor.position();

	let _window = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
		.title("Buddy Roams")
		.transparent(true)
		.decorations(false)
		.always_on_top(true)
		.skip_taskbar(true)
		.resizable(false)
		.inner_size(size.width as f64, size.height as f64)
		.position(pos.x as f64, pos.y as f64)
		.build()?;

	#[cfg(target_os = "windows")]
	{
		if let Some(w) = app.get_webview_window("main") {
			crate::win32::init(w);
		}
	}

	Ok(())
}

fn create_tray(app: &tauri::AppHandle) -> tauri::Result<()> {
	let show = MenuItem::with_id(app, "pet_show", "Show Buddy", true, None::<&str>)?;
	let hide = MenuItem::with_id(app, "pet_hide", "Hide Buddy", true, None::<&str>)?;
	let quit = MenuItem::with_id(app, "pet_quit", "Quit", true, None::<&str>)?;
	let menu = Menu::with_items(app, &[&show, &hide, &quit])?;

	let mut builder = TrayIconBuilder::with_id("buddy-roams-tray")
		.menu(&menu)
		.show_menu_on_left_click(false)
		.tooltip("Buddy Roams");
	if let Some(icon) = app.default_window_icon() {
		builder = builder.icon(icon.clone());
	}
	builder
		.on_menu_event(|app, event| match event.id().as_ref() {
			"pet_show" => {
				if let Some(w) = app.get_webview_window("main") {
					let _ = w.show();
					let _ = w.set_focus();
					// Drop the pet at a fresh random spot each time it is shown.
					let _ = app.emit("pet-notify", "randomizePosition");
				}
			}
			"pet_hide" => {
				if let Some(w) = app.get_webview_window("main") {
					let _ = w.hide();
				}
			}
			"pet_quit" => {
				app.exit(0);
			}
			_ => {}
		})
		.build(app)?;
	Ok(())
}

#[cfg(target_os = "windows")]
mod win32 {
	use std::collections::HashMap;
	use std::sync::atomic::{AtomicIsize, Ordering};
	use std::sync::Mutex;
	use std::time::{Duration, Instant};

	use raw_window_handle::{HasWindowHandle, RawWindowHandle};
	use windows::Win32::Foundation::{BOOL, HWND, LPARAM, LRESULT, POINT, WPARAM};
	use windows::Win32::Graphics::Gdi::ScreenToClient;
	use windows::Win32::UI::WindowsAndMessaging::{
		DefWindowProcW, EnumChildWindows, GetWindowLongPtrW, SetWindowLongPtrW, GWLP_WNDPROC,
		GWL_EXSTYLE, HTCLIENT, HTTRANSPARENT, WM_NCHITTEST, WS_EX_NOACTIVATE,
	};

	/// Original window procedures, keyed by HWND (as isize), so non-hit-test
	/// messages are forwarded to the right window's original proc.
	static ORIG_PROCS: Mutex<HashMap<isize, usize>> = Mutex::new(HashMap::new());
	/// Top-level overlay window handle.
	static TOP_HWND: AtomicIsize = AtomicIsize::new(0);
	/// Serializes child-window enumeration (may run from multiple threads).
	static ENUM_LOCK: Mutex<()> = Mutex::new(());
	/// Last time we enumerated child windows (throttles re-enumeration).
	static LAST_ENUM: Mutex<Option<Instant>> = Mutex::new(None);
	/// Pet interactive rect in logical (CSS) pixels: [x, y, w, h]. width <= 0
	/// means fully click-through.
	static REGION: Mutex<[f64; 4]> = Mutex::new([0.0, 0.0, 0.0, 0.0]);
	/// Window scale factor (physical px per CSS px).
	static SCALE: Mutex<f64> = Mutex::new(1.0);

	pub fn init(window: tauri::WebviewWindow) {
		let Ok(hwnd) = window_hwnd(&window) else { return };
		let scale = window.scale_factor().unwrap_or(1.0);
		*SCALE.lock().unwrap() = scale;
		TOP_HWND.store(hwnd.0 as isize, Ordering::Relaxed);

		unsafe {
			// The pet is mouse-only: never let the overlay steal keyboard focus
			// from the window the user was working in.
			let ex = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
			let _ = SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex | WS_EX_NOACTIVATE.0 as isize);

			let prev = GetWindowLongPtrW(hwnd, GWLP_WNDPROC);
			ORIG_PROCS.lock().unwrap().insert(hwnd.0 as isize, prev as usize);
			let _ = SetWindowLongPtrW(hwnd, GWLP_WNDPROC, wndproc as usize as isize);

			// Subclass any descendants that already exist.
			ensure_children_subclassed();
		}

		// WebView2 creates its child windows (the windows that actually receive
		// WM_NCHITTEST) asynchronously after the window is built. Re-scan for a
		// while so they get subclassed too. SetWindowLongPtrW is not thread
		// affine, so this is safe to do from here.
		std::thread::spawn(|| {
			for _ in 0..120 {
				std::thread::sleep(Duration::from_millis(250));
				unsafe { ensure_children_subclassed(); }
			}
		});
	}

	pub fn update_hit_region(rect: &str) {
		let parts: Vec<f64> = rect
			.split(',')
			.filter_map(|p| p.trim().parse::<f64>().ok())
			.collect();
		let region = if parts.len() == 4 {
			[parts[0], parts[1], parts[2], parts[3]]
		} else {
			[0.0, 0.0, 0.0, 0.0]
		};
		if let Ok(mut r) = REGION.lock() {
			*r = region;
		}
	}

	fn window_hwnd(window: &tauri::WebviewWindow) -> Result<HWND, ()> {
		match window.window_handle() {
			Ok(handle) => match handle.as_raw() {
				RawWindowHandle::Win32(h) => Ok(HWND(h.hwnd.get() as *mut core::ffi::c_void)),
				_ => Err(()),
			},
			Err(_) => Err(()),
		}
	}

	/// Walk the whole descendant tree and subclass every window we haven't seen
	/// yet. Called from `init`, from the re-scan thread, and (self-healing) from
	/// the hit-test path.
	unsafe fn ensure_children_subclassed() {
		let Ok(_guard) = ENUM_LOCK.try_lock() else { return };
		let now = Instant::now();
		{
			let mut last = LAST_ENUM.lock().unwrap();
			if let Some(t) = *last {
				if now.duration_since(t) < Duration::from_millis(200) {
					return;
				}
			}
			*last = Some(now);
		}
		let top = TOP_HWND.load(Ordering::Relaxed);
		if top == 0 {
			return;
		}
		let _ = EnumChildWindows(HWND(top as *mut _), Some(enum_proc), LPARAM(0));
	}

	unsafe extern "system" fn enum_proc(hwnd: HWND, _lparam: LPARAM) -> BOOL {
		let key = hwnd.0 as isize;
		let mut map = ORIG_PROCS.lock().unwrap();
		if map.contains_key(&key) {
			return BOOL(1);
		}
		let prev = GetWindowLongPtrW(hwnd, GWLP_WNDPROC);
		if prev == 0 || prev as usize == wndproc as usize {
			return BOOL(1);
		}
		map.insert(key, prev as usize);
		let _ = SetWindowLongPtrW(hwnd, GWLP_WNDPROC, wndproc as usize as isize);
		BOOL(1)
	}

	unsafe extern "system" fn wndproc(
		hwnd: HWND,
		msg: u32,
		wparam: WPARAM,
		lparam: LPARAM,
	) -> LRESULT {
		if msg == WM_NCHITTEST {
			// Keep the subclass list fresh (children can appear lazily).
			ensure_children_subclassed();

			let x = ((lparam.0 as i64 & 0xffff) as i16) as i32;
			let y = ((lparam.0 as i64 >> 16) as i16) as i32;
			let mut pt = POINT { x, y };

			// Convert to the top-level window's client coordinates so the check
			// is consistent no matter which descendant received the message.
			let top = TOP_HWND.load(Ordering::Relaxed);
			let _ = ScreenToClient(HWND(top as *mut _), &mut pt);

			let scale = *SCALE.lock().unwrap();
			let region = *REGION.lock().unwrap();
			let inside = region[2] > 0.0
				&& (pt.x as f64) >= region[0] * scale
				&& (pt.x as f64) <= (region[0] + region[2]) * scale
				&& (pt.y as f64) >= region[1] * scale
				&& (pt.y as f64) <= (region[1] + region[3]) * scale;
			if inside {
				return LRESULT(HTCLIENT as isize);
			}
			return LRESULT(HTTRANSPARENT as isize);
		}

		let prev = ORIG_PROCS.lock().unwrap().get(&(hwnd.0 as isize)).copied();
		if let Some(prev) = prev {
			if prev != 0 {
				let proc: unsafe extern "system" fn(HWND, u32, WPARAM, LPARAM) -> LRESULT =
					std::mem::transmute(prev);
				return proc(hwnd, msg, wparam, lparam);
			}
		}
		DefWindowProcW(hwnd, msg, wparam, lparam)
	}
}
