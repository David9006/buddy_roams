# Buddy Roams (buddy-roams)

**[English](#english) · [中文](#chinese)**

<a id="english"></a>

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

## Development environment setup (Contributing)

This is a pure-TypeScript VS Code extension (CommonJS, no Rust / WebView), currently **macOS-only**. Building and debugging only require Node.js + npm.

### 1. Required dependencies

| Dependency | Version requirement | Install | Notes |
| --- | --- | --- | --- |
| Node.js (with npm) | ≥ 20 (22 LTS recommended) | `brew install node` or [nodejs.org](https://nodejs.org) | Compiles TypeScript |
| VS Code (official stable) | **1.141.0** | Install from the official site | The Install command patches the installed VS Code bundle; only this version is guaranteed |

> `@vscode/vsce` doesn't need to be preinstalled; it's pulled on demand via `npx` when packaging.

### 2. Build & debug

```bash
git clone https://github.com/David9006/buddy_roams.git
cd buddy_roams/buddy-roams

npm install          # installs devDependencies (typescript, @types/vscode, etc.)
npm run compile      # tsc + copy engine.js / chatPet.css into dist/
```

Debugging: open the `buddy-roams/` folder in VS Code and press **F5** to launch "Run Extension (patched VS Code)" (`.vscode/launch.json` is configured; its `preLaunchTask` runs `npm: compile` automatically).

Install verification: in the Extension Development Host, run **Buddy Roams: Install → fully quit and restart VS Code → Buddy Roams: Toggle**. If the patch target isn't at the default location, set it via `betterPet.appRoot`.

### 3. Package a .vsix

```bash
npx @vscode/vsce package
# output: buddy-roams-<version>.vsix
```

If downloads are slow in China, switch npm to a domestic mirror:

```bash
npm config set registry https://registry.npmmirror.com
```

## ⚠️ Notes

- Only the official **VS Code 1.141.0** build is guaranteed; Install refuses to run on other versions.
- Re-run Install after VS Code auto-updates.
- Every step is backed up with rollback; failures revert automatically.

---

<a id="chinese"></a>

# Buddy Roams（buddy-roams）

把 VS Code 的 **Buddy 宠物**从聊天框带到**代码区** —— 使用**原始精灵图、动画、物理和交互**（即 Copilot 聊天里的 `/vscode-pet`，stable 配色）。

## 命令

- **Buddy Roams: Install** —— 让宠物出现在代码区，随后提示你重启 VS Code。
- **Buddy Roams: Uninstall** —— 一键回滚。
- **Buddy Roams: Toggle** —— 显示 / 隐藏宠物，状态会被记住；启用后宠物会在启动时自动出现。
- **Buddy Roams: Diagnose** —— 显示状态与诊断信息。

## 宠物行为（与原版一致，不含键盘控制与成就）

- **待机动画**：原版 50 帧待机精灵图，周期性眨眼，视线跟随鼠标。
- **睡眠 / 唤醒**：待机 20 秒后入睡，交互时唤醒。
- **打字**：编码时进入打字状态，停止后回到待机。
- **任务成功**：构建 / 测试任务以退出码 0 结束时鼓掌。
- **光标避让**：跳离文本光标（不是鼠标）；被逼到角落时躲进角落，光标移开后恢复。
- **点击**：随机触发 buttonPress / love / cool / sing / speechless / worry / yapping，并有稀有旋转（完整实现）。
- **拖拽 & 抛掷**：拖动它；松手时带速度即抛出（重力、撞墙反弹、旋转、落地压扁）；否则自由落体。
- **鼠标弹跳**：半空中接住它可弹起并累积连击；20 连击时触发原版彩带庆祝。
- **快速变向**会晕眩。
- **饰品**：右键装备 17 顶帽子 / 饰品之一。
- **颜色**：右键切换 Stable / Insiders / 8 种自定义颜色。
- **缩放**：右键 Grow / Shrink / Reset Size。
- **Go on the Run**：右键隐藏宠物；再次点击唤回。

右键菜单使用 VS Code 的**原生上下文菜单**（macOS 上为原生系统菜单），与内置聊天宠物一致。开关状态、位置、大小、颜色与饰品都会被持久化。

## 设置

- `betterPet.appRoot`：VS Code `Resources/app` 目录的绝对路径；留空则自动检测。macOS 默认示例：`/Applications/Visual Studio Code.app/Contents/Resources/app`。

## 开发环境配置（Contributing）

这是纯 TypeScript 的 VS Code 插件（CommonJS，无 Rust / WebView），当前**仅支持 macOS**。
编译和调试只依赖 Node.js + npm。

### 1. 必需依赖

| 依赖 | 版本要求 | 安装方式 | 说明 |
| --- | --- | --- | --- |
| Node.js（含 npm） | ≥ 20（推荐 22 LTS） | `brew install node` 或[官网](https://nodejs.org) | 编译 TypeScript |
| VS Code（官方正式版） | **1.141.0** | 从官网安装 | Install 命令会 patch 已安装的 VS Code bundle，仅保证该版本 |

> `@vscode/vsce` 打包工具无需预装，打包时用 `npx` 临时拉取即可。

### 2. 编译与调试

```bash
git clone https://github.com/David9006/buddy_roams.git
cd buddy_roams/buddy-roams

npm install          # 安装 devDependencies（typescript、@types/vscode 等）
npm run compile      # tsc + 复制 engine.js / chatPet.css 到 dist/
```

调试：用 VS Code 打开 `buddy-roams/` 目录，按 **F5** 启动「Run Extension (patched VS Code)」
（`.vscode/launch.json` 已配好，`preLaunchTask` 会自动执行 `npm: compile`）。

安装验证：在 Extension Development Host 里依次运行
**Buddy Roams: Install → 完全退出并重启 VS Code → Buddy Roams: Toggle**。
若 patch 目标路径不在默认位置，可通过 `betterPet.appRoot` 指定。

### 3. 打包 .vsix

```bash
npx @vscode/vsce package
# 产物：buddy-roams-<version>.vsix
```

国内网络慢时，npm 可切国内源：

```bash
npm config set registry https://registry.npmmirror.com
```

## ⚠️ 注意事项

- 仅保证官方 **VS Code 1.141.0**；其它版本会拒绝 Install。
- VS Code 自动更新后需重新运行 Install。
- 每一步都有备份与回滚；失败时自动还原。
