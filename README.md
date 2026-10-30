# Buddy Roams

**[中文](#chinese) · [English](#english)**

<a id="chinese"></a>

把 VS Code 的 Buddy 宠物从聊天框（`/vscode-pet`）里放出来：要么让它漫游整个**代码区**
（macOS 插件），要么让它漫游你**整个 Windows 桌面**（原生桌面版）。两个版本共享同一套宠物
行为（原版精灵图、动画与物理）。

## 两个版本

| 版本 | 位置 | 平台 | 说明 |
| --- | --- | --- | --- |
| **VS Code 插件** | [buddy-roams/](buddy-roams/) | macOS（VS Code 1.141.0） | 把宠物注入**代码区**（编辑器上方） |
| **Windows 桌面版** | [buddy-roams-desktop/](buddy-roams-desktop/) | Windows（ARM64 / amd64 / x86） | 纯 Rust + Win32 原生应用，宠物在**整个桌面**漫游 |

### 1. VS Code 插件（macOS）

把宠物注入 **VS Code 的代码区**，使用原版精灵图、动画与物理。安装方式：

1. 安装插件，运行命令面板中的 **Buddy Roams: Install**。
2. **完全退出并重启 VS Code**。
3. 运行 **Buddy Roams: Toggle**（快捷键 `⌥⌘P`）—— 🐈 出现在代码区。

完整命令、行为说明与编译调试见 [buddy-roams/README.md](buddy-roams/README.md)。

### 2. Windows 桌面版

**纯 Rust + Win32 原生应用**（无 WebView），用 `WS_EX_LAYERED` + `UpdateLayeredWindow` 做逐像素
alpha 合成：透明像素点击穿透、宠物本体可交互。支持系统托盘（右键菜单仅 Exit）、全局快捷键
`Ctrl+Alt+=` 放大 / `Ctrl+Alt+-` 缩小、系统 DPI 缩放，位置/大小/颜色/饰品持久化到
`%APPDATA%\BuddyRoams\config.json`。支持 ARM64 / amd64 / x86 三种架构。

编译运行（Windows）：

```powershell
git clone https://github.com/David9006/buddy_roams.git
cd buddy_roams\buddy-roams-desktop
cargo run --release
```

完整功能与交叉编译说明见 [buddy-roams-desktop/README.md](buddy-roams-desktop/README.md)。

## 宠物行为（两版共有）

- 原版待机动画、眨眼、视线跟随鼠标；20 秒无操作后入睡，交互唤醒。
- 你敲代码时进入打字状态；构建/测试任务成功后鼓掌。
- 躲开文本光标；被逼到角落时躲起，光标移开后恢复。
- 点击随机触发 buttonPress / love / cool / sing / speechless / worry / yapping，偶发旋转。
- 拖拽 & 抛掷：重力、撞墙、旋转、落地压扁；空中用鼠标接住可连击，20 连击放彩带。
- 快速变向会晕眩。
- 右键菜单：17 顶帽子、换色（Stable / Insiders / 8 种自定义）、缩放、Go on the Run。
- 状态、位置、大小、颜色、饰品全部持久化。

桌面版另有：周期性「思考」+ 语音气泡、节日彩蛋（万圣节隐身、愚人节右向重力 + pong）、连击数徽章。

## 素材与授权

宠物精灵图与帽子图集是 **Microsoft VS Code 自带的版权素材**，来自已安装 VS Code 的
`out/vs/workbench/contrib/chat/browser/widget/media/chatPet/` 目录。插件版在运行时从 `appRoot`
读取，桌面版由 `build.rs` 在编译期内嵌进二进制。分发存在版权/合规风险，请自行评估。引擎逻辑
派生自 VS Code（MIT License）。

---

<a id="english"></a>

# Buddy Roams

Take VS Code's Buddy pet out of the chat box (`/vscode-pet`): let it roam the entire **code area**
(macOS extension) or your **whole Windows desktop** (native desktop app). Both versions share the
same pet behavior (original sprites, animations, and physics).

## Two flavors

| Flavor | Location | Platform | Description |
| --- | --- | --- | --- |
| **VS Code extension** | [buddy-roams/](buddy-roams/) | macOS (VS Code 1.141.0) | Inject the pet into the **code area** (above the editor) |
| **Windows desktop app** | [buddy-roams-desktop/](buddy-roams-desktop/) | Windows (ARM64 / amd64 / x86) | Pure Rust + Win32 native app; the pet roams the **whole desktop** |

### 1. VS Code extension (macOS)

Injects the pet into VS Code's **code area**, using the original sprites, animations, and physics.
To install:

1. Install the extension, then run **Buddy Roams: Install** from the command palette.
2. **Quit and restart VS Code completely**.
3. Run **Buddy Roams: Toggle** (shortcut `⌥⌘P`) — 🐈 appears in the code area.

See [buddy-roams/README.md](buddy-roams/README.md) for the full command list, behavior, and
build/debug instructions.

### 2. Windows desktop app

A **pure Rust + Win32 native app** (no WebView) using `WS_EX_LAYERED` + `UpdateLayeredWindow` for
per-pixel alpha: transparent pixels are click-through and the pet itself is interactive. It includes
a system tray (right-click menu with only **Exit**), global hotkeys `Ctrl+Alt+=` to grow /
`Ctrl+Alt+-` to shrink, system DPI scaling, and persists position/size/color/accessory to
`%APPDATA%\BuddyRoams\config.json`. ARM64 / amd64 / x86 are supported.

Build & run (Windows):

```powershell
git clone https://github.com/David9006/buddy_roams.git
cd buddy_roams\buddy-roams-desktop
cargo run --release
```

See [buddy-roams-desktop/README.md](buddy-roams-desktop/README.md) for the full feature list and
cross-compilation instructions.

## Pet behavior (shared by both)

- Original idle animation, blinking, and mouse-following gaze; falls asleep after 20 seconds and
  wakes on interaction.
- Typing state while you code; claps when a build/test task succeeds.
- Hops away from the text cursor; hides in a corner when trapped and recovers once the cursor moves
  away.
- Clicks randomly trigger buttonPress / love / cool / sing / speechless / worry / yapping, with a
  rare spin.
- Drag & throw physics: gravity, wall bounces, rotation, landing squish; catch it mid-air to build a
  combo, with confetti at 20.
- Rapid direction changes cause dizziness.
- Right-click menu: 17 hats/accessories, colors (Stable / Insiders / 8 custom), resize, Go on the
  Run.
- Toggle state, position, size, color, and accessories are all persisted.

The desktop app additionally has periodic "thinking" with a speech bubble, festival surprises
(Halloween invisibility, April Fools' rightward gravity + pong), and a combo-count badge.

## Assets & licensing

The pet sprite sheets and hat atlases are **Microsoft VS Code's copyrighted assets**, from the
installed VS Code's `out/vs/workbench/contrib/chat/browser/widget/media/chatPet/` directory. The
extension reads them at runtime from `appRoot`; the desktop app embeds them at compile time via
`build.rs`. Distributing them carries copyright/compliance risk — evaluate it yourself. The engine
logic is derived from VS Code (MIT License).
