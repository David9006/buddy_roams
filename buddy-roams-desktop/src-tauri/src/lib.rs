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
	use std::sync::{Mutex, OnceLock};

	use raw_window_handle::{HasWindowHandle, RawWindowHandle};
	use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
	use windows::Win32::UI::WindowsAndMessaging::{
		CallWindowProcW, DefWindowProcW, GetWindowLongPtrW, ScreenToClient, SetWindowLongPtrW,
		GWLP_WNDPROC, HTCLIENT, HTTRANSPARENT, POINT, WM_NCHITTEST,
	};

	static ORIG_PROC: OnceLock<usize> = OnceLock::new();
	// x, y, width, height in logical (client) coordinates. width<=0 => fully
	// click-through.
	static REGION: Mutex<[f64; 4]> = Mutex::new([0.0, 0.0, 0.0, 0.0]);

	pub fn init(window: tauri::WebviewWindow) {
		let Ok(hwnd) = window_hwnd(&window) else { return };
		unsafe {
			let prev = GetWindowLongPtrW(hwnd, GWLP_WNDPROC);
			let _ = ORIG_PROC.set(prev as usize);
			let _ = SetWindowLongPtrW(hwnd, GWLP_WNDPROC, wndproc as usize as isize);
		}
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

	unsafe extern "system" fn wndproc(
		hwnd: HWND,
		msg: u32,
		wparam: WPARAM,
		lparam: LPARAM,
	) -> LRESULT {
		if msg == WM_NCHITTEST {
			let x = ((lparam.0 as i64 & 0xffff) as i16) as i32;
			let y = ((lparam.0 as i64 >> 16) as i16) as i32;
			let mut pt = POINT { x, y };
			let _ = ScreenToClient(hwnd, &mut pt);
			let region = *REGION.lock().unwrap();
			let inside = region[2] > 0.0
				&& (pt.x as f64) >= region[0]
				&& (pt.x as f64) <= region[0] + region[2]
				&& (pt.y as f64) >= region[1]
				&& (pt.y as f64) <= region[1] + region[3];
			if inside {
				return LRESULT(HTCLIENT as isize);
			}
			return LRESULT(HTTRANSPARENT as isize);
		}

		if let Some(prev) = ORIG_PROC.get() {
			let proc: unsafe extern "system" fn(HWND, u32, WPARAM, LPARAM) -> LRESULT =
				std::mem::transmute(*prev);
			return proc(hwnd, msg, wparam, lparam);
		}
		DefWindowProcW(hwnd, msg, wparam, lparam)
	}
}
