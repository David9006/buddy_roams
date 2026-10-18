#!/usr/bin/env node
/**
 * Extracts the Buddy pet pixel-art assets (body sprite sheets + accessory
 * atlases) from an installed VS Code application and copies them into
 * `src/assets/pet/` so Vite can bundle them into the Tauri app.
 *
 * These are Microsoft's copyrighted assets, shipped with VS Code under
 * `out/vs/workbench/contrib/chat/browser/widget/media/chatPet/`. Bundling them
 * into this app carries redistribution/compliance risk — see README.
 *
 * Usage:
 *   node scripts/extract-assets.mjs [/path/to/Visual Studio Code.app]
 * The app path defaults to the standard macOS location.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

function buildSpriteFiles(variant) {
	const v = variant;
	const files = [];
	const add = (base) => {
		files.push(`${base}.spritesheet.png`);
		files.push(`${base}.png`);
	};
	add(`buddy-idle-${v}-tracking-96`);
	add(`buddy-rendering-${v}-tracking-96`);
	add(`buddy-clapping-${v}-tracking-96`);
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
	add(`buddy-sing-${v}-124`);
	add(`buddy-dizzy-${v}-128`);
	files.push(`buddy-wall-impact-${v}-96.png`);
	files.push(`buddy-yapping-${v}-96.png`);
	return files;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outBody = path.join(root, 'src', 'assets', 'pet');
const outAcc = path.join(root, 'src', 'assets', 'pet', 'accessories');

const appRoot =
	process.argv[2] ??
	'/Applications/Visual Studio Code.app/Contents/Resources/app';
const mediaDir = path.join(
	appRoot,
	'out', 'vs', 'workbench', 'contrib', 'chat', 'browser', 'widget', 'media', 'chatPet',
);

if (!fs.existsSync(mediaDir)) {
	console.error(`Media directory not found: ${mediaDir}`);
	console.error('Pass the VS Code "Resources/app" directory as the first argument.');
	process.exit(1);
}

fs.mkdirSync(outBody, { recursive: true });
fs.mkdirSync(outAcc, { recursive: true });

let copied = 0;
const missing = [];

for (const file of [...buildSpriteFiles('stable'), ...buildSpriteFiles('insiders')]) {
	const src = path.join(mediaDir, file);
	const dst = path.join(outBody, file);
	if (!fs.existsSync(src)) { missing.push(file); continue; }
	fs.copyFileSync(src, dst);
	copied++;
}

for (const name of ACCESSORY_ATLASES) {
	const file = `${name}.png`;
	const src = path.join(mediaDir, 'accessories', file);
	const dst = path.join(outAcc, file);
	if (!fs.existsSync(src)) { missing.push('accessories/' + file); continue; }
	fs.copyFileSync(src, dst);
	copied++;
}

console.log(`Copied ${copied} asset files to ${path.relative(root, outBody)}`);
if (missing.length) {
	console.warn('Missing files:');
	for (const m of missing) console.warn('  - ' + m);
} else {
	console.log('All assets extracted successfully.');
}
