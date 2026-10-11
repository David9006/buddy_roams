/**
 * Ambient augmentation for `vscode.window.createEditorOverlay`.
 *
 * This API is provided by the *patched* VS Code build (see the top-level
 * `patches/0001-editor-overlay-api.patch`), not by `@types/vscode`. This file
 * lets the extension compile against `@types/vscode` while the runtime API is
 * supplied by the patched editor itself.
 */
declare module 'vscode' {
	export interface EditorOverlayOptions {
		/**
		 * When `true` (the default) the overlay ignores all pointer events so
		 * the editor below remains fully interactive.
		 */
		readonly suppressEvents?: boolean;
	}

	export interface EditorOverlay {
		/**
		 * The unique identifier of this overlay.
		 */
		readonly id: string;

		/**
		 * Injects the pet content directly into the editor area DOM: a CSS
		 * stylesheet, the URL of an engine script already written into the app
		 * bundle, and a config object carrying the sprite and accessory data
		 * URIs. The engine runs in the workbench page context (like the
		 * built-in chat pet), so it is fully interactive.
		 */
		setContent(css: string, engineUrl: string, config: { sprites: Record<string, string>; accessories: Record<string, string> }): Thenable<void>;

		/**
		 * Makes the overlay visible.
		 */
		show(): void;

		/**
		 * Hides the overlay without disposing it.
		 */
		hide(): void;

		/**
		 * Destroys the overlay and releases its resources.
		 */
		dispose(): void;

		/**
		 * Returns a JSON string describing the overlay's runtime DOM state.
		 * Diagnostic only; only present in patched builds.
		 */
		diagnose(): Thenable<string>;

		/**
		 * Forwards a named event to the pet engine running in the workbench
		 * page, e.g. 'clapping' when a build/test task succeeds.
		 */
		notify(type: string): Thenable<void>;
	}

	export namespace window {
		/**
		 * Creates an overlay that renders HTML above the editor area.
		 */
		export function createEditorOverlay(options?: EditorOverlayOptions): EditorOverlay;
	}
}
