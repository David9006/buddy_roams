/**
 * Buddy Roams desktop host.
 *
 * Responsibilities:
 *  1. Build the sprite/accessory URL maps from the bundled assets.
 *  2. Create the overlay host element and inject `__BETTER_PET_CONFIG__` /
 *     `__BETTER_PET_ROOT__` before the engine loads.
 *  3. Bridge the native context menu (`__BETTER_PET_MENU__`) to the Rust side.
 *  4. Keep the overlay click-through per pixel: rasterize the pet's current
 *     silhouette into a 1-bit mask and stream it (bits on frame change, rect on
 *     move) to the Rust side for WM_NCHITTEST hit-testing.
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
/* 4. Per-pixel hit-test mask                                                 */
/* -------------------------------------------------------------------------- */

// Offscreen canvas used to rasterize the pet's current body + hat + eye
// accessory into a 1-bit alpha mask: 1 = opaque (clickable), 0 = transparent
// (click-through). The Rust side checks this mask in WM_NCHITTEST so only the
// pet's actual pixels intercept the mouse.
const maskCanvas = document.createElement("canvas");
const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });

let lastMaskBits: number[] | null = null;
let lastMaskRect = "";

function buildPetMask(): { bits: number[]; width: number; height: number; left: number; top: number } | null {
	const btn = root.querySelector<HTMLElement>(".chat-pet-button");
	const sprite = root.querySelector<HTMLCanvasElement>(".chat-pet-sprite:not(.hidden) .chat-pet-canvas");
	if (!btn || !sprite || !maskCtx) {
		return null;
	}

	const display = Math.max(1, Math.round(btn.offsetWidth));
	if (maskCanvas.width !== display || maskCanvas.height !== display) {
		maskCanvas.width = display;
		maskCanvas.height = display;
	}
	maskCtx.clearRect(0, 0, display, display);
	maskCtx.drawImage(sprite, 0, 0, display, display);

	// Some hats draw extra pixels (monocle, glasses) on a separate canvas.
	const eyeAccessory = root.querySelector<HTMLCanvasElement>(
		".chat-pet-eye-accessory:not(.hidden) .chat-pet-eye-accessory-canvas",
	);
	if (eyeAccessory) {
		maskCtx.drawImage(eyeAccessory, 0, 0, display, display);
	}

	const img = maskCtx.getImageData(0, 0, display, display);
	const bytes = Math.ceil((display * display) / 8);
	const bits = new Array<number>(bytes).fill(0);
	for (let i = 0; i < img.data.length; i += 4) {
		if (img.data[i + 3] > 32) {
			const pixel = i / 4;
			bits[pixel >> 3] |= 1 << (pixel & 7);
		}
	}

	return {
		bits,
		width: display,
		height: display,
		left: btn.offsetLeft,
		top: btn.offsetTop,
	};
}

function reportPetHitMask(): void {
	const btn = root.querySelector<HTMLElement>(".chat-pet-button");
	if (!btn) {
		return;
	}

	// Pet hidden ("on the run"): clear the mask so everything is click-through.
	if (btn.offsetWidth <= 0 || btn.offsetHeight <= 0) {
		if (lastMaskBits !== null) {
			lastMaskBits = null;
			lastMaskRect = "";
			void invoke("set_pet_mask", { bits: [], width: 0, height: 0 });
		}
		return;
	}

	const mask = buildPetMask();
	if (!mask) {
		return;
	}

	// The bits only change when the animation frame changes; send them then.
	const bitsChanged =
		!lastMaskBits ||
		lastMaskBits.length !== mask.bits.length ||
		lastMaskBits.some((b, i) => b !== mask.bits[i]);
	if (bitsChanged) {
		lastMaskBits = mask.bits;
		void invoke("set_pet_mask", { bits: mask.bits, width: mask.width, height: mask.height });
	}

	// The position changes whenever the pet moves.
	const rect = `${Math.round(mask.left)},${Math.round(mask.top)}`;
	if (rect !== lastMaskRect) {
		lastMaskRect = rect;
		void invoke("set_pet_mask_rect", { left: mask.left, top: mask.top });
	}
}

function startHitMaskReporter(): void {
	const tick = (): void => {
		reportPetHitMask();
		requestAnimationFrame(tick);
	};
	requestAnimationFrame(tick);
}

/* -------------------------------------------------------------------------- */
/* 5. Load the engine                                                          */
/* -------------------------------------------------------------------------- */

void import("./engine.js").then(() => {
	startHitMaskReporter();
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
