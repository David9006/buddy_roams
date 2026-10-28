use serde_json::Value;
use tauri::{
	menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu},
	tray::TrayIconBuilder,
	Emitter, Manager,
};

/// Positions and sizes the small overlay window (all values in logical CSS px)
/// so it stays a tight box around the pet.
#[tauri::command]
fn set_window_frame(window: tauri::WebviewWindow, x: f64, y: f64, w: f64, h: f64) {
	let w = w.max(1.0);
	let h = h.max(1.0);
	let _ = window.set_position(tauri::LogicalPosition::new(x, y));
	let _ = window.set_size(tauri::LogicalSize::new(w, h));
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
		.invoke_handler(tauri::generate_handler![set_window_frame, show_pet_menu])
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

	// A small window, initially centered on the primary monitor. The webview
	// repositions and resizes it every frame so it stays a tight box around the
	// pet; it never covers more than the pet itself.
	let start_w = 128.0;
	let start_h = 128.0;
	let start_x = pos.x as f64 + (size.width as f64 - start_w) / 2.0;
	let start_y = pos.y as f64 + (size.height as f64 - start_h) / 2.0;

	let _window = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
		.title("Buddy Roams")
		.transparent(true)
		.decorations(false)
		.always_on_top(true)
		.skip_taskbar(true)
		.resizable(false)
		.inner_size(start_w, start_h)
		.position(start_x, start_y)
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
	use raw_window_handle::{HasWindowHandle, RawWindowHandle};
	use windows::Win32::Foundation::HWND;
	use windows::Win32::UI::WindowsAndMessaging::{
		GetWindowLongPtrW, SetWindowLongPtrW, GWL_EXSTYLE, WS_EX_NOACTIVATE,
	};

	/// The pet is mouse-only: mark the overlay window non-activating so it never
	/// steals keyboard focus from the window the user is working in.
	pub fn init(window: tauri::WebviewWindow) {
		let Ok(hwnd) = window_hwnd(&window) else { return };
		unsafe {
			let ex = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
			let _ = SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex | WS_EX_NOACTIVATE.0 as isize);
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
}
