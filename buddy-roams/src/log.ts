import * as vscode from 'vscode';

let channel: vscode.OutputChannel | undefined;

export function log(message: string): void {
	if (!channel) {
		channel = vscode.window.createOutputChannel('Buddy Roams');
	}
	channel.appendLine(`[${new Date().toLocaleTimeString()}] ${message}`);
}
