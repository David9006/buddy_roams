import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { log } from './log';

/**
 * A faithful port of the real Copilot "Buddy" chat pet (see
 * src/vs/workbench/contrib/chat/browser/widget/chatPetWidget.ts and
 * widget/media/chatPet.css in the VS Code source).
 *
 * The pixel-art sprite sheets and accessory atlases are shipped with the
 * installed VS Code app under
 * `out/vs/workbench/contrib/chat/browser/widget/media/chatPet/`. We read the
 * "stable" and "insiders" variants at runtime and embed them as base64 data
 * URIs. The actual engine is a plain JavaScript file (`engine.js`) that is
 * copied next to this compiled extension and written into the app bundle so it
 * can be loaded via `<script src>` under the workbench Trusted Types CSP.
 */

/**
 * Accessory hat atlases (all 96px cells). Each atlas is 4x3 cells: columns are
 * rig poses, rows are back/front/eye layers.
 */
const ACCESSORY_ATLASES = [
	'grand-top-hat-monocle',
	'cowboy-hat',
	'baseball-cap',
	'construction-hard-hat',
	'firefighter-helmet',
	'crown',
	'propeller-hat',
	'dark-sailor-hat',
	'white-chef-hat',
	'bamboo-hat',
	'straw-hat',
	'pink-party-hat',
	'wizard-hat',
	'sailor-hat',
	'full-size-spinner-hat',
	'leaning-party-hat',
	'artist-beret',
];

/**
 * Builds the list of sprite sheet files for one color variant ("stable" or
 * "insiders"), mirroring the sprite-source construction in chatPetWidget.ts.
 */
function buildSpriteFiles(variant: 'stable' | 'insiders'): string[] {
	const v = variant;
	const files: string[] = [];
	// Animated sheets + their reduced-motion single-frame PNGs.
	const add = (base: string) => {
		files.push(`${base}.spritesheet.png`);
		files.push(`${base}.png`);
	};
	// Cursor-tracking sheets.
	add(`buddy-idle-${v}-tracking-96`);
	add(`buddy-rendering-${v}-tracking-96`);
	add(`buddy-clapping-${v}-tracking-96`);
	// Regular 96x96 sheets.
	add(`buddy-idle-${v}-96`);
	add(`buddy-sleep-${v}-96`);
	add(`buddy-waking-${v}-96`);
	add(`buddy-typing-${v}-96`);
	add(`buddy-press-button-${v}-96`);
	add(`buddy-love-${v}-96`);
	add(`buddy-jump-${v}-96`);
	add(`buddy-cool-${v}-96`);
	add(`buddy-speechless-${v}-96`);
	add(`buddy-worry-${v}-96`);
	add(`buddy-falling-${v}-96`);
	add(`buddy-splat-${v}-96`);
	add(`buddy-search-${v}-96`);
	add(`buddy-speech-${v}-96`);
	add(`buddy-respawn-${v}-96`);
	// Non-square sheets.
	add(`buddy-sing-${v}-124`);
	add(`buddy-dizzy-${v}-128`);
	// Static-only states (no animated sheet).
	files.push(`buddy-wall-impact-${v}-96.png`);
	files.push(`buddy-yapping-${v}-96.png`);
	return files;
}

function chatPetMediaDir(appRoot: string): string {
	return path.join(
		appRoot,
		'out', 'vs', 'workbench', 'contrib', 'chat', 'browser', 'widget', 'media', 'chatPet',
	);
}

async function loadFilesAsDataUris(appRoot: string, files: string[], subdir?: string): Promise<Record<string, string>> {
	const base = subdir ? path.join(chatPetMediaDir(appRoot), subdir) : chatPetMediaDir(appRoot);
	const result: Record<string, string> = {};
	for (const file of files) {
		const data = await fs.promises.readFile(path.join(base, file));
		result[file] = 'data:image/png;base64,' + data.toString('base64');
	}
	return result;
}

export class Pet {
	private overlay: vscode.EditorOverlay | undefined;
	private rendered = false;
	private listenersRegistered = false;
	private started = false;

	start(): void {
		if (!this.overlay) {
			this.overlay = vscode.window.createEditorOverlay({ suppressEvents: true });
		}
		this.overlay.show();
		this.started = true;
		if (!this.listenersRegistered) {
			this.listenersRegistered = true;
			this.registerActivityListeners();
		}
		if (!this.rendered) {
			this.rendered = true;
			void this.loadAndRender();
		} else {
			// Engine is already running; drop the pet at a fresh random spot
			// every time it is shown again.
			this.randomizePosition();
		}
	}

	stop(): void {
		this.overlay?.hide();
		this.started = false;
	}

	grow(): void {
		void this.overlay?.notify('grow');
	}

	shrink(): void {
		void this.overlay?.notify('shrink');
	}

	randomizePosition(): void {
		void this.overlay?.notify('randomizePosition');
	}

	isStarted(): boolean {
		return this.started;
	}

	dispose(): void {
		this.overlay?.dispose();
		this.overlay = undefined;
		this.rendered = false;
		this.started = false;
	}

	/**
	 * Bridges workbench activity into the pet engine. Typing is detected in the
	 * engine itself (it runs in the workbench page and can watch editor keys),
	 * but build/test task results are only visible to the extension host, so we
	 * forward "task succeeded" to the engine via the overlay's notify channel.
	 */
	private registerActivityListeners(): void {
		try {
			vscode.tasks.onDidEndTaskProcess(e => {
				if (e.exitCode === 0) {
					void this.overlay?.notify('clapping');
				}
			});
		} catch (err) {
			log('Failed to register task listener: ' + (err instanceof Error ? err.message : String(err)));
		}
	}

	private async loadAndRender(): Promise<void> {
		if (!this.overlay) {
			return;
		}
		try {
			const appRoot = vscode.env.appRoot;
			const [stableSprites, insidersSprites, accessories] = await Promise.all([
				loadFilesAsDataUris(appRoot, buildSpriteFiles('stable')),
				loadFilesAsDataUris(appRoot, buildSpriteFiles('insiders')),
				loadFilesAsDataUris(appRoot, ACCESSORY_ATLASES.map(name => `${name}.png`), 'accessories'),
			]);
			const sprites: Record<string, string> = { ...stableSprites, ...insidersSprites };
			const accessoriesByName: Record<string, string> = {};
			for (const name of ACCESSORY_ATLASES) {
				accessoriesByName[name] = accessories[`${name}.png`];
			}

			const css = fs.readFileSync(path.join(__dirname, 'chatPet.css'), 'utf-8');
			const js = fs.readFileSync(path.join(__dirname, 'engine.js'), 'utf-8');

			// Write the engine as a real file inside the app bundle so it can be
			// loaded via <script src> with a TrustedScriptURL (the workbench CSP
			// blocks eval of raw strings via Trusted Types).
			const engineUrl = await this.writeEngineFile(js);
			log(`Engine URL: ${engineUrl}`);

			const anyOverlay = this.overlay as unknown as { setContent?: (css: string, engineUrl: string, config: unknown) => Thenable<void> };
			if (typeof anyOverlay.setContent !== 'function') {
				log('Overlay setContent NOT AVAILABLE (patch missing; needs reinstall).');
				return;
			}
			await anyOverlay.setContent(css, engineUrl, { sprites, accessories: accessoriesByName });
			log(`Pet content injected with ${Object.keys(sprites).length} sprite assets and ${Object.keys(accessoriesByName).length} accessories.`);

			const diag = this.overlay as unknown as { diagnose?: () => Thenable<string> };
			if (typeof diag.diagnose === 'function') {
				for (const delay of [300, 900, 2000]) {
					await new Promise(resolve => setTimeout(resolve, delay));
					try {
						const info = await diag.diagnose();
						log(`Overlay diagnose (+${delay}ms): ` + info);
					} catch (derr) {
						log(`Overlay diagnose (+${delay}ms) failed: ${derr instanceof Error ? derr.message : String(derr)}`);
					}
				}
			}
		} catch (err) {
			log('Failed to render pet: ' + (err instanceof Error ? err.stack ?? err.message : String(err)));
		}
	}

	private async writeEngineFile(js: string): Promise<string> {
		const dir = path.join(vscode.env.appRoot, 'out', 'vs', 'betterpet');
		const file = path.join(dir, 'engine.js');
		await fs.promises.mkdir(dir, { recursive: true });
		await fs.promises.writeFile(file, js, 'utf-8');
		// The workbench's vscode-file URLs carry the full absolute path after the
		// `vscode-app` authority, e.g.
		//   vscode-file://vscode-app/Applications/Visual Studio Code.app/.../out/vs/workbench/...
		// A bare `/out/vs/...` path would resolve to the filesystem root and 404.
		return 'vscode-file://vscode-app' + encodeURI(file);
	}
}
