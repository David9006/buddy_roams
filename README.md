# Buddy Unleashed — Bring the Copilot pet to the code area

Buddy Unleashed lets VS Code's Buddy pet (originally confined to the `/vscode-pet` chat command) roam the **entire code area**, walking, napping, and playing above the editor.

## Install & Use

1. Install the extension, then run **Buddy Unleashed: Install** from the command palette.
2. **Quit and restart VS Code completely**.
3. Run **Buddy Unleashed: Toggle** (shortcut `⌥⌘P`) — 🐈 appears in the code area.
4. To roll back: run **Buddy Unleashed: Uninstall**.

## Commands

- **Buddy Unleashed: Install** — makes the pet available in the code area, then prompts you to restart VS Code.
- **Buddy Unleashed: Uninstall** — one-click rollback.
- **Buddy Unleashed: Toggle** — show/hide the pet, with the state remembered; when enabled, the pet reappears automatically on startup.
- **Buddy Unleashed: Diagnose** — show status and diagnostic information.

## Pet Features (same as the original, excluding keyboard control and achievements)

- Original idle animation, blinking, and gaze that follows the mouse; falls asleep after 20 seconds and wakes on click.
- Enters a typing state while you code; claps when a build/test task succeeds.
- Hops away from the text cursor; hides in a corner when trapped, and recovers once the cursor moves away.
- Clicking randomly triggers buttonPress / love / cool / sing / speechless / worry / yapping, with a rare spin.
- Drag & throw physics: gravity, wall bounces, rotation, landing squish; bounce it mid-air with the mouse to build a combo, with confetti at 20.
- Rapid direction changes cause dizziness.
- Right-click menu uses VS Code's native menu (native system menu on macOS): accessories, colors, resize, Go on the Run.
- Toggle state, position, size, color, and accessories are all persisted.

## Settings

- `betterPet.appRoot`: absolute path to VS Code's `Resources/app` directory; leave empty to auto-detect. macOS default example: `/Applications/Visual Studio Code.app/Contents/Resources/app`.

## ⚠️ Notes

- Only the official **VS Code 1.141.0** build is guaranteed; Install refuses to run on other versions.
- Re-run Install after VS Code auto-updates.
- Every step is backed up with rollback; failures revert automatically.
