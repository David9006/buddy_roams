import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { log } from './log';

/**
 * Best-effort, string-level patch of the *installed* VS Code application.
 *
 * The shipped VS Code bundles (`extensionHostProcess.js` and
 * `workbench.desktop.main.js`) do not contain the TypeScript sources that the
 * top-level `patches/` are written against. This module therefore injects the
 * equivalent, hand-minified code into the compiled bundles via unique string
 * anchors. Every edit is guarded: an anchor must match exactly once or the
 * whole install aborts and rolls back. Before touching anything, the original
 * files are backed up next to themselves (`.betterpet.orig`) and a manifest is
 * written so `Uninstall` can restore them byte-for-byte.
 *
 * This is fragile by nature: it is tied to the exact build of VS Code 1.141.0.
 */

const EXPECTED_VERSION = '1.141.0';
const MANIFEST_NAME = 'betterpet-install.json';
const BACKUP_SUFFIX = '.betterpet.orig';

type TargetKey = 'ext' | 'wb';

interface Edit {
	label: string;
	file: TargetKey;
	old: string;
	replacement: string;
}

const EDITS: Edit[] = [
	// ---- Extension host: expose `vscode.window.createEditorOverlay` ----
	{
		label: 'ext-host: register MainThreadEditorOverlay in MainContext',
		file: 'ext',
		old: 'MainThreadWindow:q("MainThreadWindow"),MainThreadPower:q("MainThreadPower")',
		replacement: 'MainThreadWindow:q("MainThreadWindow"),MainThreadEditorOverlay:q("MainThreadEditorOverlay"),MainThreadPower:q("MainThreadPower")',
	},
	{
		label: 'ext-host: add window.createEditorOverlay',
		file: 'ext',
		old: 'createWebviewPanel(I,C,D,H){return O.createWebviewPanel(P,I,C,D,H)},createWebviewTextEditorInset',
		replacement: 'createWebviewPanel(I,C,D,H){return O.createWebviewPanel(P,I,C,D,H)},' +
			'createEditorOverlay(I={}){var s=I.suppressEvents!==!1,id="editor-overlay:"+Math.random().toString(36).slice(2),p=d.getProxy(W.MainThreadEditorOverlay),R=e=>e.catch(function(r){console.error("[better-pet] rpc failed:",r)});' +
			'return R(p.$create(id,s)),{id:id,setContent:function(c,j,sp){return R(p.$setContent(id,c,j,sp))},show:function(){return R(p.$show(id))},hide:function(){return R(p.$hide(id))},dispose:function(){return R(p.$dispose(id))},diagnose:function(){return R(p.$diagnose(id))},notify:function(t){return R(p.$notify(id,t))}}},' +
			'createWebviewTextEditorInset',
	},
	// ---- Workbench (renderer): implement the overlay in the main thread ----
	{
		label: 'workbench: register MainThreadEditorOverlay in MainContext',
		file: 'wb',
		old: 'MainThreadWindow:Mo("MainThreadWindow"),MainThreadPower:Mo("MainThreadPower")',
		replacement: 'MainThreadWindow:Mo("MainThreadWindow"),MainThreadEditorOverlay:Mo("MainThreadEditorOverlay"),MainThreadPower:Mo("MainThreadPower")',
	},
	{
		label: 'workbench: add MainThreadEditorOverlay customer class',
		file: 'wb',
		old: '],Qti);var Yti=de("powerService")',
					replacement: '],Qti);' +
			'var $bPEo=class extends x{constructor(e,t,i){super();this.layoutService=t,this.contextMenuService=i,this._overlays=new Map,' +
			'this._register(this.layoutService.onDidLayoutContainer(()=>this._reanchor())),' +
			'this._register(this.layoutService.onDidChangeActiveContainer(()=>this._reanchor()))}' +
			'_editorContainer(){return this.layoutService.getContainer(window,"workbench.parts.editor")||void 0}' +
			'_reanchor(){var a=this._editorContainer();this._overlays.forEach(function(o){if(a&&o.host.parentNode!==a)a.appendChild(o.host)})}' +
			'$create(e,t){if(this._overlays.has(e))throw new Error("Editor overlay \'"+e+"\' already exists");var a=this._editorContainer();' +
			'var h=document.createElement("div");h.className="better-pet-host";' +
			'h.style.cssText="position:absolute;inset:0;pointer-events:none;z-index:2147483000;overflow:hidden";' +
			'if(a)a.appendChild(h);' +
			'this._overlays.set(e,{host:h,style:null,built:false,error:null});' +
			'var self=this;window.__BETTER_PET_MENU__=function(ev,j){self.$showMenu(e,ev,j)}}' +
			'$showMenu(e,ev,j){var o=this._overlays.get(e);if(!o||!this.contextMenuService)return;var host=o.host,items=JSON.parse(j);' +
			'function build(list){var out=[];for(var i=0;i<list.length;i++){let it=list[i];' +
			'if(it.type==="separator"){out.push(new ei)}' +
			'else if(it.type==="submenu"){out.push(new zs(it.id,it.label,build(it.items||[])))}' +
			'else{var a=new Ye(it.id,it.label,void 0,it.enabled!==!1,function(){var f=window.__BETTER_PET_RUN_ACTION__;if(f)f(it.id)});if(it.checked)a.checked=!0;out.push(a)}}return out}' +
			'this.contextMenuService.showContextMenu({getAnchor:function(){return new Jn(Ce(host),ev)},getActions:function(){return build(items)},onHide:function(){}})}' +
			'$setContent(e,c,u,s){var o=this._overlays.get(e);if(!o)return;' +
			'if(!o.style){o.style=document.createElement("style");o.style.setAttribute("data-better-pet","1");o.host.appendChild(o.style)}' +
			'o.style.textContent=c;' +
			'window.__BETTER_PET_CONFIG__=s;window.__BETTER_PET_ROOT__=o.host;' +
			'var old=o.host.querySelector("script[data-better-pet]");if(old)old.remove();' +
			'var sc=document.createElement("script");sc.setAttribute("data-better-pet","1");' +
			'try{' +
			'sc.src=this.$ttu(u);' +
			'sc.onload=function(){o.built=true;o.error=null};' +
			'sc.onerror=function(){o.built=false;o.error="script load error"};' +
			'o.built=false;o.error=null;' +
			'o.host.appendChild(sc)' +
			'}catch(err){o.built=false;o.error=String(err&&err.stack||err)}' +
			'}' +
			'$ttu(u){var tt=window.trustedTypes;if(!tt)return u;var a=[],i,p,err=null;' +
			'var bp=window.__BETTER_PET_TTP;' +
			'if(!bp){try{var f=window.__BETTER_PET_ENSURE_TTP__;if(f)f()}catch(x){err=x}bp=window.__BETTER_PET_TTP}' +
			'if(bp&&bp.createScriptURL)a.push(bp);' +
			'var wp=window._VSCODE_WEB_PACKAGE_TTP;if(wp&&wp.createScriptURL)a.push(wp);' +
			'if(tt.getPolicy){try{p=tt.getPolicy("amdLoader");if(p)a.push(p)}catch(x){err=x}}' +
			'for(i=0;i<a.length;i++){var q=a[i];if(q&&q.createScriptURL){try{return q.createScriptURL(u)}catch(x){err=x}}}' +
			'throw new Error("no usable trusted-types policy"+(err&&err.message?" ("+err.message+")":""))}' +
			'$show(e){var o=this._overlays.get(e);if(o)o.host.style.display=""}' +
			'$hide(e){var o=this._overlays.get(e);if(o)o.host.style.display="none"}' +
			'$dispose(e){var o=this._overlays.get(e);if(o){this._overlays.delete(e);try{o.host.remove()}catch(t){}if(window.__BETTER_PET_ROOT__===o.host)window.__BETTER_PET_ROOT__=void 0}}' +
			'$notify(e,m){var o=this._overlays.get(e);if(o&&o.host){var ev;try{ev=new CustomEvent("betterpet-notify",{detail:m})}catch(x){ev=document.createEvent("CustomEvent");ev.initCustomEvent("betterpet-notify",false,false,m)}o.host.dispatchEvent(ev)}}' +
			'$diagnose(e){var o=this._overlays.get(e);if(!o)return JSON.stringify({found:!1});var h=o.host,cs=getComputedStyle(h),r=h.getBoundingClientRect(),btn=h.querySelector(".chat-pet-button"),cvs=h.querySelectorAll("canvas"),cvinfo=[];for(var i=0;i<cvs.length;i++){var cv=cvs[i],nz=0;try{var ctx=cv.getContext("2d");if(ctx){var d=ctx.getImageData(0,0,cv.width,cv.height).data;for(var pj=3;pj<d.length;pj+=4){if(d[pj]>0){nz++;break}}}}catch(e2){}cvinfo.push(cv.width+"x"+cv.height+":"+nz)}var br=btn?btn.getBoundingClientRect():null,geo=null;try{if(window.__BETTER_PET_API__&&window.__BETTER_PET_API__.debugGeometry)geo=JSON.parse(window.__BETTER_PET_API__.debugGeometry())}catch(e3){}return JSON.stringify({found:!0,built:o.built,error:o.error,display:cs.display,visibility:cs.visibility,width:cs.width,height:cs.height,rect:{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)},btn:!!btn,btnRect:br?{x:Math.round(br.x),y:Math.round(br.y),w:Math.round(br.width),h:Math.round(br.height)}:null,canvases:cvinfo,hostChildren:h.children.length,geometry:geo})}};' +
			'$bPEo=I([Ko(ko.MainThreadEditorOverlay),h(1,de("layoutService")),h(2,de("contextMenuService"))],$bPEo);' +
			'var Yti=de("powerService")',
	},
	// ---- Workbench: expose the AMD loader's amdLoader trusted-types policy ----
	// Chromium has no `trustedTypes.getPolicy()`, and `createPolicy("amdLoader")`
	// throws because the loader already registered it at startup. The loader
	// stores it privately (`_amdPolicy`), so we patch the loader to also stash it
	// on `window.__BETTER_PET_TTP`. `$ttu` then reuses it to build a
	// TrustedScriptURL for our engine.js (its URL check allows vscode-file://vscode-app).
	//
	// The loader creates the policy *lazily* (on the first AMD import), so we also
	// expose `window.__BETTER_PET_ENSURE_TTP__` to force that same initialization
	// path early. `$ttu` must NEVER call `createPolicy` itself: pre-creating a
	// Trusted Types policy (e.g. "amdLoader") breaks VS Code's own lazy loader,
	// which then throws "Policy with name amdLoader already exists" and takes down
	// the integrated terminal (xterm) and syntax highlighting (textmate).
	{
		label: 'workbench: expose amdLoader policy (open)',
		file: 'wb',
		old: 'this._amdPolicy=globalThis._VSCODE_WEB_PACKAGE_TTP??window.trustedTypes?.createPolicy("amdLoader"',
		replacement: 'this._amdPolicy=(window.__BETTER_PET_TTP=globalThis._VSCODE_WEB_PACKAGE_TTP??window.trustedTypes?.createPolicy("amdLoader"',
	},
	{
		label: 'workbench: expose amdLoader policy (close)',
		file: 'wb',
		old: 'Invalid script url: ${o}`)}}):',
		replacement: 'Invalid script url: ${o}`)}})):',
	},
	{
		label: 'workbench: expose eager amdLoader init hook',
		file: 'wb',
		old: 'this._state=1}static{this.INSTANCE=new s}_initialize()',
		replacement: 'this._state=1}static{this.INSTANCE=new s,typeof window!=="undefined"&&(window.__BETTER_PET_ENSURE_TTP__=()=>this.INSTANCE._initialize())}_initialize()',
	},
];

interface Manifest {
	appRoot: string;
	version: string;
	files: { file: string; backup: string; sha256: string }[];
}

function appRoot(): string {
	const configured = vscode.workspace.getConfiguration('betterPet').get<string>('appRoot');
	return (configured && configured.trim()) || vscode.env.appRoot;
}

function targetPath(root: string, key: TargetKey): string {
	return key === 'ext'
		? path.join(root, 'out', 'vs', 'workbench', 'api', 'node', 'extensionHostProcess.js')
		: path.join(root, 'out', 'vs', 'workbench', 'workbench.desktop.main.js');
}

function manifestPath(root: string): string {
	return path.join(root, 'out', 'vs', 'workbench', MANIFEST_NAME);
}

function readAppVersion(root: string): string | undefined {
	try {
		const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
		return typeof pkg.version === 'string' ? pkg.version : undefined;
	} catch {
		return undefined;
	}
}

function sha256(file: string): string {
	return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/**
 * VS Code's integrity check (`IntegrityService`) computes
 * `sha256(file).digest('base64').replace(/=+$/, '')` for each entry in
 * `product.json`'s `checksums` map and warns "installation corrupt" on
 * mismatch. Because we modify two of those files, we must update the stored
 * checksums to match the patched contents — otherwise the user sees a scary
 * "reinstall" prompt and re-installing reverts the patch (which is exactly why
 * the pet kept disappearing).
 */
const CHECKSUMMED_FILES: { file: TargetKey; rel: string }[] = [
	{ file: 'ext', rel: 'vs/workbench/api/node/extensionHostProcess.js' },
	{ file: 'wb', rel: 'vs/workbench/workbench.desktop.main.js' },
];

function sha256Base64NoPad(file: string): string {
	return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('base64').replace(/=+$/, '');
}

function syncProductChecksums(root: string): void {
	const productPath = path.join(root, 'product.json');
	if (!fs.existsSync(productPath)) {
		log('syncProductChecksums: product.json not found; skipping integrity fix.');
		return;
	}
	try {
		const product = JSON.parse(fs.readFileSync(productPath, 'utf-8'));
		const checksums: Record<string, string> = product.checksums ?? {};
		for (const entry of CHECKSUMMED_FILES) {
			const file = targetPath(root, entry.file);
			if (fs.existsSync(file)) {
				checksums[entry.rel] = sha256Base64NoPad(file);
			}
		}
		product.checksums = checksums;
		fs.writeFileSync(productPath, JSON.stringify(product, null, 2), 'utf-8');
		log('syncProductChecksums: updated checksums in product.json.');
	} catch (err) {
		log(`syncProductChecksums failed: ${errMsg(err)}`);
	}
}

function disableAutoUpdate(): void {
	try {
		const updateConfig = vscode.workspace.getConfiguration('update');
		void updateConfig.update('mode', 'none', vscode.ConfigurationTarget.Global).then(
			() => log('Auto-update disabled (update.mode=none) to prevent patch reversion.'),
			err => log(`Failed to disable auto-update: ${errMsg(err)}`),
		);
	} catch (err) {
		log(`Failed to disable auto-update: ${errMsg(err)}`);
	}
}

export function isInstalled(): boolean {
	const root = appRoot();
	if (fs.existsSync(manifestPath(root))) {
		return true;
	}
	for (const key of ['ext', 'wb'] as TargetKey[]) {
		const p = targetPath(root, key);
		if (fs.existsSync(p) && fs.readFileSync(p, 'utf-8').includes('MainThreadEditorOverlay')) {
			return true;
		}
	}
	return false;
}

export async function install(): Promise<void> {
	const root = appRoot();
	const version = readAppVersion(root);
	log(`Install: appRoot=${root} version=${version ?? 'unknown'}`);

	if (version !== EXPECTED_VERSION) {
		void vscode.window.showWarningMessage(
			`Buddy Roams supports VS Code ${EXPECTED_VERSION}, but the app at "${root}" is ${version ?? 'unknown'}. Refusing to patch. Set "betterPet.appRoot" to point at a ${EXPECTED_VERSION} install.`,
		);
		log(`Install aborted: version mismatch (expected ${EXPECTED_VERSION})`);
		return;
	}

	if (isInstalled()) {
		void vscode.window.showInformationMessage('Buddy Roams is already installed. Run "Buddy Roams: Uninstall" first if you want to re-apply.');
		return;
	}

	const targets = (['ext', 'wb'] as TargetKey[]).map(key => ({ key, path: targetPath(root, key) }));

	// Pre-flight: existence + writability
	for (const t of targets) {
		if (!fs.existsSync(t.path)) {
			void vscode.window.showErrorMessage(`Missing bundle: ${t.path}`);
			return;
		}
		try {
			fs.accessSync(t.path, fs.constants.W_OK);
		} catch {
			void vscode.window.showErrorMessage(
				`No write permission for ${t.path}. Grant write access to the VS Code app (e.g. sudo chown -R $(whoami) "${root}") and retry.`,
			);
			return;
		}
	}

	// Backup originals (never overwrite an existing backup)
	const manifest: Manifest = { appRoot: root, version: EXPECTED_VERSION, files: [] };
	try {
		for (const t of targets) {
			const backup = t.path + BACKUP_SUFFIX;
			if (!fs.existsSync(backup)) {
				fs.copyFileSync(t.path, backup);
			}
			manifest.files.push({ file: t.path, backup, sha256: sha256(t.path) });
			log(`Install: backed up ${t.path} -> ${backup}`);
		}
	} catch (err) {
		void vscode.window.showErrorMessage(`Failed to back up VS Code bundles: ${errMsg(err)}`);
		return;
	}

	// Apply edits per file, atomically in memory
	const modified: string[] = [];
	try {
		for (const key of ['ext', 'wb'] as TargetKey[]) {
			const file = targetPath(root, key);
			let content = fs.readFileSync(file, 'utf-8');
			for (const edit of EDITS.filter(e => e.file === key)) {
				const count = countOccurrences(content, edit.old);
				if (count !== 1) {
					throw new Error(`"${edit.label}" anchor matched ${count} time(s); expected exactly 1. Aborting.`);
				}
				if (content.includes(edit.replacement)) {
					throw new Error(`"${edit.label}" already appears to be applied.`);
				}
				content = content.replace(edit.old, edit.replacement);
				log(`Install: applied "${edit.label}"`);
			}
			fs.writeFileSync(file, content, 'utf-8');
			modified.push(file);
		}

		// Verify
		for (const key of ['ext', 'wb'] as TargetKey[]) {
			const content = fs.readFileSync(targetPath(root, key), 'utf-8');
			if (!content.includes('MainThreadEditorOverlay')) {
				throw new Error(`Verification failed for ${key} bundle.`);
			}
		}
		fs.writeFileSync(manifestPath(root), JSON.stringify(manifest, null, 2), 'utf-8');
		log('Install: manifest written; patch applied successfully');
		syncProductChecksums(root);
		disableAutoUpdate();
	} catch (err) {
		// Rollback everything that was touched
		for (const m of manifest.files) {
			try {
				if (fs.existsSync(m.backup)) {
					fs.copyFileSync(m.backup, m.file);
				}
			} catch { /* ignore */ }
		}
		try { fs.unlinkSync(manifestPath(root)); } catch { /* ignore */ }
		log(`Install FAILED, rolled back: ${errMsg(err)}`);
		void vscode.window.showErrorMessage(`Buddy Roams install failed and was rolled back: ${errMsg(err)}`);
		return;
	}

	const action = await vscode.window.showInformationMessage(
		'Buddy Roams installed into VS Code. Fully quit and relaunch VS Code for the patch to take effect, then run "Buddy Roams: Toggle".',
		'Restart Now',
	);
	if (action === 'Restart Now') {
		await vscode.commands.executeCommand('workbench.action.quit');
	}
}

export async function uninstall(): Promise<void> {
	const root = appRoot();
	const mPath = manifestPath(root);

	if (!fs.existsSync(mPath)) {
		void vscode.window.showInformationMessage('Buddy Roams is not installed (no manifest found).');
		return;
	}

	let manifest: Manifest;
	try {
		manifest = JSON.parse(fs.readFileSync(mPath, 'utf-8'));
	} catch {
		void vscode.window.showErrorMessage(`Buddy Roams manifest is corrupt: ${mPath}. Restore "${BACKUP_SUFFIX}" files manually.`);
		return;
	}

	let ok = true;
	for (const entry of manifest.files) {
		try {
			if (fs.existsSync(entry.backup)) {
				fs.copyFileSync(entry.backup, entry.file);
				fs.unlinkSync(entry.backup);
			} else {
				ok = false;
			}
		} catch (err) {
			ok = false;
			void vscode.window.showErrorMessage(`Failed to restore ${entry.file}: ${errMsg(err)}`);
		}
	}
	try { fs.unlinkSync(mPath); } catch { /* ignore */ }

	if (ok) {
		syncProductChecksums(root);
		void vscode.window.showInformationMessage(
			'Buddy Roams uninstalled and VS Code was reset to its original state. Restart VS Code to apply.',
		);
	} else {
		void vscode.window.showWarningMessage('Buddy Roams uninstall completed with warnings: some backups were missing and could not be restored.');
	}
}

function countOccurrences(haystack: string, needle: string): number {
	let count = 0;
	let index = haystack.indexOf(needle);
	while (index !== -1) {
		count++;
		index = haystack.indexOf(needle, index + needle.length);
	}
	return count;
}

/**
 * Returns a human-readable summary of the current patch state, used by the
 * "Buddy Roams: Diagnose" command.
 */
export function diagnose(): string {
	const root = appRoot();
	const version = readAppVersion(root);
	const lines: string[] = [];
	lines.push(`appRoot     : ${root}`);
	lines.push(`version     : ${version ?? 'unknown'} (expected ${EXPECTED_VERSION})`);
	lines.push(`isInstalled : ${isInstalled()}`);

	const ext = targetPath(root, 'ext');
	const wb = targetPath(root, 'wb');
	for (const [name, p] of [['extensionHostProcess.js', ext], ['workbench.desktop.main.js', wb]] as const) {
		const exists = fs.existsSync(p);
		let patched = false;
		if (exists) {
			try {
				patched = fs.readFileSync(p, 'utf-8').includes('MainThreadEditorOverlay');
			} catch { /* ignore */ }
		}
		const backup = fs.existsSync(p + BACKUP_SUFFIX);
		lines.push(`${name.padEnd(26)} exists=${exists} patched=${patched} backup=${backup}`);
	}
	lines.push(`manifest    : ${fs.existsSync(manifestPath(root))}`);

	const apiAvailable = typeof (vscode.window as unknown as { createEditorOverlay?: unknown }).createEditorOverlay === 'function';
	lines.push(`API (createEditorOverlay) available: ${apiAvailable}`);
	return lines.join('\n');
}

function errMsg(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}
