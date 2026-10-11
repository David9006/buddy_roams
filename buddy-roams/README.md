# Buddy Roams (buddy-roams)

Brings VS Code's **Buddy pet** from the chat box into the **code area** — using the **original sprites, animations, physics, and interactions** (the same `/vscode-pet` from Copilot chat, stable colorway).

## Commands

- **Buddy Roams: Install** — makes the pet available in the code area, then prompts you to restart VS Code.
- **Buddy Roams: Uninstall** — one-click rollback.
- **Buddy Roams: Toggle** — show/hide the pet, with the state remembered; when enabled, the pet reappears automatically on startup.
- **Buddy Roams: Diagnose** — show status and diagnostic information.

## Pet Behavior (same as the original, excluding keyboard control and achievements)

- **Idle animation**: the original 50-frame idle sprite, periodic blinking, gaze follows the mouse.
- **Sleep/wake**: falls asleep after 20 idle seconds and wakes on interaction.
- **Typing**: enters a typing state while you code, returning to idle after you stop.
- **Task success**: claps when a build/test task finishes with exit code 0.
- **Cursor avoidance**: hops away from the text cursor (not the mouse); hides in a corner when trapped and recovers once the cursor moves away.
- **Clicks**: randomly trigger buttonPress / love / cool / sing / speechless / worry / yapping, with a rare spin (complete).
- **Drag & throw**: drag it around; release with speed to throw it (gravity, wall bounces, rotation, landing squish); otherwise it free-falls.
- **Mouse bounce**: catch it mid-air to bounce it and build a combo; at 20 bounces it celebrates with the original confetti burst.
- **Rapid direction changes** cause dizziness.
- **Accessories**: right-click to equip one of 17 hats/accessories.
- **Colors**: right-click to switch between Stable / Insiders / 8 custom colors.
- **Resize**: right-click to Grow / Shrink / Reset Size.
- **Go on the Run**: right-click to hide the pet; click it again to bring it back.

The right-click menu uses VS Code's **native context menu** (the native system menu on macOS), just like the built-in chat pet. Toggle state, position, size, color, and accessories are all persisted.

## Settings

- `betterPet.appRoot`: absolute path to VS Code's `Resources/app` directory; leave empty to auto-detect. macOS default example: `/Applications/Visual Studio Code.app/Contents/Resources/app`.

## ⚠️ Notes

- Only the official **VS Code 1.141.0** build is guaranteed; Install refuses to run on other versions.
- Re-run Install after VS Code auto-updates.
- Every step is backed up with rollback; failures revert automatically.
