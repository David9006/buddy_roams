/**
 * Buddy Roams desktop host.
 *
 * Responsibilities:
 *  1. Build the sprite/accessory URL maps from the bundled assets.
 *  2. Create the overlay host element and inject `__BETTER_PET_CONFIG__` /
 *     `__BETTER_PET_ROOT__` before the engine loads.
 *  3. Bridge the native context menu (`__BETTER_PET_MENU__`) to the Rust side.
 *  4. Report the pet's on-screen rectangle so the Windows host can make every
 *     pixel except the pet click-through.
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
/* 4. Click-through: report the pet's interactive rectangle                   */
/* -------------------------------------------------------------------------- */

let lastRect = "";

function reportInteractiveRegion(): void {
	const btn = root.querySelector<HTMLElement>(".chat-pet-button");
	let rect = "";
	if (btn) {
		const r = btn.getBoundingClientRect();
		if (r.width > 0 && r.height > 0) {
			// A little margin around the pet so clicks on its edge still land.
			const pad = 4;
			rect = `${Math.floor(r.left - pad)},${Math.floor(r.top - pad)},${Math.ceil(r.width + pad * 2)},${Math.ceil(r.height + pad * 2)}`;
		}
	}
	if (rect !== lastRect) {
		lastRect = rect;
		void invoke("set_interactive_region", { rect });
	}
}

function startRegionReporter(): void {
	const tick = (): void => {
		reportInteractiveRegion();
		requestAnimationFrame(tick);
	};
	requestAnimationFrame(tick);
}

/* -------------------------------------------------------------------------- */
/* 5. Load the engine                                                          */
/* -------------------------------------------------------------------------- */

void import("./engine.js").then(() => {
	startRegionReporter();
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
