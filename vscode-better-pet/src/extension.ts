import * as vscode from 'vscode';
import { Pet } from './pet';
import { install, uninstall, isInstalled, diagnose } from './installer';
import { log } from './log';

const ENABLED_STATE_KEY = 'betterPet.enabled';

let pet: Pet | undefined;

export function activate(context: vscode.ExtensionContext): void {
	log('Extension activated.');
	context.subscriptions.push(
		vscode.commands.registerCommand('vscode-better-pet.toggle', () => {
			log('Toggle command invoked.');
			if (pet?.isStarted()) {
				hidePet(context);
			} else {
				showPet(context);
			}
		}),
		vscode.commands.registerCommand('vscode-better-pet.install', () => {
			log('Install command invoked.');
			void install();
		}),
		vscode.commands.registerCommand('vscode-better-pet.uninstall', () => {
			log('Uninstall command invoked.');
			void uninstall();
		}),
		vscode.commands.registerCommand('vscode-better-pet.diagnose', () => {
			const summary = diagnose();
			log(`Diagnose:\n${summary}`);
			void vscode.window.showInformationMessage(summary, { modal: true });
		}),
	);

	// Auto-show the pet if it was left enabled last session.
	if (context.globalState.get<boolean>(ENABLED_STATE_KEY, false)) {
		log('Pet was enabled last session; auto-showing on startup.');
		showPet(context, true);
	}
}

export function deactivate(): void {
	pet?.dispose();
	pet = undefined;
}

function showPet(context: vscode.ExtensionContext, quiet = false): void {
	if (!isSupported(quiet)) {
		return;
	}
	if (!pet) {
		pet = new Pet();
		context.subscriptions.push(pet);
	}
	try {
		pet.start();
		void context.globalState.update(ENABLED_STATE_KEY, true);
		log('Pet started (overlay created + show + setContent).');
	} catch (err) {
		log(`Pet start threw: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
		void vscode.window.showErrorMessage(`Better Pet failed to start: ${err instanceof Error ? err.message : String(err)}`);
	}
}

function hidePet(context: vscode.ExtensionContext): void {
	pet?.stop();
	void context.globalState.update(ENABLED_STATE_KEY, false);
	log('Pet stopped (overlay hidden).');
}

/**
 * The `createEditorOverlay` API only exists in the patched VS Code build.
 * Guard so the pet commands degrade gracefully on an unpatched editor and
 * point the user at the Install command.
 */
function isSupported(quiet = false): boolean {
	const create = (vscode.window as unknown as { createEditorOverlay?: unknown }).createEditorOverlay;
	if (typeof create !== 'function') {
		log(`createEditorOverlay not available. isInstalled=${isInstalled()}`);
		if (!quiet) {
			void vscode.window.showErrorMessage(
				isInstalled()
					? 'Better Pet is installed but VS Code has not been restarted yet. Fully quit and relaunch VS Code, then run "Better Pet: Toggle" again.'
					: 'The editor overlay API is not available. Run "Better Pet: Install" to patch VS Code, restart, then try again. Run "Better Pet: Diagnose" for details.',
			);
		}
		return false;
	}
	return true;
}
