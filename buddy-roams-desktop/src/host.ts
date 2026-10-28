/**
 * Buddy Roams desktop host.
 *
 * Responsibilities:
 *  1. Build the sprite/accessory URL maps from the bundled assets.
 *  2. Create the overlay host element and inject `__BETTER_PET_CONFIG__` /
 *     `__BETTER_PET_ROOT__` before the engine loads.
 *  3. Bridge the native context menu (`__BETTER_PET_MENU__`) to the Rust side.
 *  4. Keep the OS window a small box that follows the pet: measure the pet's
 *     on-screen bounds and translate them into a window frame each frame.
 *  5. Load the self-contained `engine.js`.
 */
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./global.css";
import "./chatPet.css";

/* -------------------------------------------------------------------------- */
/* 1. Assets                                                                  */
/* -------------------------------------------------------------------------- */

const bodyModules = import.meta.glob("./assets/pet/*.png", {
	eager: true,
	query: "?url",
	import: "default",
}) as Record<string, string>;

const accessoryModules = import.meta.glob("./assets/pet/accessories/*.png", {
	eager: true,
	query: "?url",
	import: "default",
}) as Record<string, string>;

function basename(p: string): string {
	return p.split("/").pop() as string;
}

function toUrlMap(modules: Record<string, string>): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [p, url] of Object.entries(modules)) {
		out[basename(p)] = url;
	}
	return out;
}

const sprites = toUrlMap(bodyModules);

// The engine looks up accessory atlases by their bare atlas name (e.g.
// "propeller-hat"), not by the filename.
function toAccessoryMap(modules: Record<string, string>): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [p, url] of Object.entries(modules)) {
		out[basename(p).replace(/\.png$/, "")] = url;
	}
	return out;
}
const accessories = toAccessoryMap(accessoryModules);

/* -------------------------------------------------------------------------- */
/* 2. Host element + engine config (must run before engine.js executes)       */
/* -------------------------------------------------------------------------- */

const root = document.getElementById("pet-host-root") as HTMLElement;
root.className = "better-pet-host";

window.__BETTER_PET_ROOT__ = root;
window.__BETTER_PET_CONFIG__ = { sprites, accessories };

// Size the overlay to the virtual (full-screen) roaming area. The OS window
// itself stays small; the engine keeps using this screen-based coordinate
// space for physics, floor and walls.
document.documentElement.style.setProperty("--pet-screen-w", `${window.screen.width}px`);
document.documentElement.style.setProperty("--pet-screen-h", `${window.screen.height}px`);

// Native context-menu bridge: the engine calls this with a JSON menu spec; the
// Rust side renders a native menu and emits "pet-menu-action" with the chosen
// id (handled below).
window.__BETTER_PET_MENU__ = (_event: Event, itemsJson: string) => {
	void invoke("show_pet_menu", { itemsJson });
};

/* -------------------------------------------------------------------------- */
/* 3. Menu actions from the native menu                                       */
/* -------------------------------------------------------------------------- */

void listen<string>("pet-menu-action", (e) => {
	const run = window.__BETTER_PET_RUN_ACTION__;
	if (typeof run === "function") {
		run(e.payload);
	}
});

// Forward host notifications (e.g. "randomizePosition" on tray show) to the
// engine via the same custom event the VS Code host used.
void listen<string>("pet-notify", (e) => {
	const detail = e.payload;
	root.dispatchEvent(new CustomEvent("betterpet-notify", { detail }));
});

/* -------------------------------------------------------------------------- */
/* 4. Small window that follows the pet                                       */
/* -------------------------------------------------------------------------- */

// Transparent margin (px) kept around the pet inside the window.
const FRAME_PADDING = 12;

// Reused for measuring the pet's visible bounding box (union of the button and
// all its overflowing descendants: sprite, hat, eyes, speech bubble).
const measureRange = document.createRange();

let lastFrame = "";

function overlayOrigin(): { x: number; y: number } {
	const overlay = root.querySelector<HTMLElement>(".chat-pet-overlay");
	if (!overlay) {
		return { x: 0, y: 0 };
	}
	const ob = overlay.getBoundingClientRect();
	return { x: ob.left, y: ob.top };
}

function measurePetAabb(): { left: number; top: number; width: number; height: number } | null {
	const btn = root.querySelector<HTMLElement>(".chat-pet-button");
	if (!btn) {
		return null;
	}
	const origin = overlayOrigin();

	// Union of the button's own (possibly rotated) box and all its overflowing
	// descendants (sprite, hat, eyes, speech bubble). The button box keeps the
	// clickable area inside the window even when the pet is shrunk.
	const box = btn.getBoundingClientRect();
	measureRange.selectNodeContents(btn);
	const content = measureRange.getBoundingClientRect();
	let left = Math.min(box.left, content.left) - origin.x;
	let top = Math.min(box.top, content.top) - origin.y;
	let right = Math.max(box.right, content.right) - origin.x;
	let bottom = Math.max(box.bottom, content.bottom) - origin.y;

	// Include the bounce counter / pong score when it is visible.
	const counter = root.querySelector<HTMLElement>(".chat-pet-bounce-counter:not(.hidden)");
	if (counter) {
		const cr = counter.getBoundingClientRect();
		left = Math.min(left, cr.left - origin.x);
		top = Math.min(top, cr.top - origin.y);
		right = Math.max(right, cr.right - origin.x);
		bottom = Math.max(bottom, cr.bottom - origin.y);
	}

	if (right - left <= 0 || bottom - top <= 0) {
		return null;
	}
	return { left, top, width: right - left, height: bottom - top };
}

function updateWindowFrame(): void {
	const aabb = measurePetAabb();
	if (!aabb) {
		return;
	}

	const vw = Math.ceil(aabb.width + FRAME_PADDING * 2);
	const vh = Math.ceil(aabb.height + FRAME_PADDING * 2);

	// Center the pet's AABB in the window. The overlay origin (0,0) maps to the
	// screen's top-left, so the window top-left is the AABB center minus half
	// the window size, and the overlay offset is the negation of that position.
	const cx = aabb.left + aabb.width / 2;
	const cy = aabb.top + aabb.height / 2;
	const winX = Math.round(cx - vw / 2);
	const winY = Math.round(cy - vh / 2);
	const offX = vw / 2 - cx;
	const offY = vh / 2 - cy;

	root.style.transform = `translate(${offX}px, ${offY}px)`;

	const frame = `${winX},${winY},${vw},${vh}`;
	if (frame !== lastFrame) {
		lastFrame = frame;
		void invoke("set_window_frame", { x: winX, y: winY, w: vw, h: vh });
	}
}

function startFrameTracker(): void {
	const tick = (): void => {
		updateWindowFrame();
		requestAnimationFrame(tick);
	};
	requestAnimationFrame(tick);
}

/* -------------------------------------------------------------------------- */
/* 5. Load the engine                                                          */
/* -------------------------------------------------------------------------- */

void import("./engine.js").then(() => {
	startFrameTracker();
});

/* TypeScript declarations for the globals the engine exposes/consumes. */
declare global {
	interface Window {
		__BETTER_PET_ROOT__?: HTMLElement;
		__BETTER_PET_CONFIG__?: { sprites: Record<string, string>; accessories: Record<string, string> };
		__BETTER_PET_MENU__?: (event: Event, itemsJson: string) => void;
		__BETTER_PET_RUN_ACTION__?: (id: string) => void;
		__BETTER_PET_DISPOSE__?: () => void;
	}
}
