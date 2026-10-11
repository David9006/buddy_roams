import * as vscode from 'vscode';

let channel: vscode.OutputChannel | undefined;

export function log(message: string): void {
	if (!channel) {
		channel = vscode.window.createOutputChannel('Better Pet');
	}
	channel.appendLine(`[${new Date().toLocaleTimeString()}] ${message}`);
}
