# Buddy Roams Desktop

**[中文](#chinese) · [English](#english)**

<a id="chinese"></a>

Buddy Roams 桌面版 —— 把 VS Code 的 Buddy 宠物放到你的整个桌面上漫游。

当前为 **Windows 优先** 的首个版本（macOS / Ubuntu 移植在计划中）。

## 功能

- 小窗口跟随宠物：OS 窗口始终只覆盖宠物本身，其余屏幕区域完全可交互（不会挡住桌面或其它窗口）。
- 宠物全部状态与动画、17 顶帽子、换色、缩放、grow/shrink、随机出生点。
- 帽子特殊能力：spinner 竹蜻蜓、propeller 升力与抛掷、party 点击概率、wizard 隐身 + 瞬移。
- 节日：万圣节隐身（只露帽子 + 橙色眼球）、愚人节右向重力 + 左右 pong。
- 拖拽 / 抛起 / 鼠标弹跳物理、左键点击互动、原生右键菜单。
- 系统托盘：显示 / 隐藏 / 退出。

> 与 VS Code 插件版相比，以下“编辑器相关”特性在桌面版中不存在：光标避让、IntelliSense 建议框避让、任务成功鼓掌、编辑器打字检测。

## 素材来源与授权

宠物精灵图与帽子图集是 **Microsoft VS Code 自带的版权素材**，来自已安装 VS Code 的
`out/vs/workbench/contrib/chat/browser/widget/media/chatPet/` 目录，由
`scripts/extract-assets.mjs` 抽取并打包进本应用。将这些素材随应用分发存在版权/合规风险，
请自行评估。引擎 `engine.js` 与 `chatPet.css` 派生自 VS Code（MIT License）。

## 开发环境配置（Contributing）

本项目是 **Tauri v2（Rust + WebView2）+ Vite 8** 桌面应用，当前为 **Windows 优先**。
在一台全新的 Windows 机器上，按下面顺序运行命令安装依赖即可编译运行。

### 1. 必需依赖

| 依赖 | 版本要求 | 安装方式 | 说明 |
| --- | --- | --- | --- |
| Node.js（含 npm） | ≥ 20.19（推荐 22 LTS） | `winget install OpenJS.NodeJS.LTS` | Vite 8 需要较新的 Node |
| Rust（rustup，stable） | rustc ≥ 1.90 | `winget install Rustlang.Rustup` | Tauri 2.12 的 MSRV |
| Microsoft C++ Build Tools | VS 2022 Build Tools | 见下方命令 | **最容易被漏掉**，提供 `link.exe` 与 Windows SDK |
| WebView2 Runtime | Evergreen | `winget install Microsoft.EdgeWebView2Runtime` | Win11 已内置；缺失时安装包会自动补装 |
| Git | 任意较新版本 | `winget install Git.Git` | 拉取仓库 |

MSVC Build Tools 需要勾选「**使用 C++ 的桌面开发**」工作负载：

```powershell
winget install Microsoft.VisualStudio.2022.BuildTools --override "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --passive"
```

> 安装体积较大（数 GB），装完建议重启终端 / 系统，让 `link.exe`、`cargo`、`rustup` 进入 PATH。
> NSIS / WiX 打包工具由 Tauri CLI 在 `tauri build` 时自动下载，无需手动安装。

### 2. 国内镜像（下载慢时，推荐清华）

```powershell
# rustup 工具链走清华 TUNA
$env:RUSTUP_DIST_SERVER="https://mirrors.tuna.tsinghua.edu.cn/rustup"
rustup default stable

# crates.io 走清华（写入 C:\Users\<你>\.cargo\config.toml）
# [source.crates-io]
# replace-with = "tuna"
# [source.tuna]
# registry = "sparse+https://mirrors.tuna.tsinghua.edu.cn/crates.io-index/"

# npm 走国内源
npm config set registry https://registry.npmmirror.com
```

### 3. 编译与运行

```bash
# 1. 拉取仓库
git clone -b desktop --single-branch https://github.com/David9006/buddy_roams.git
cd buddy_roams/buddy-roams-desktop

# 2. 前端依赖
npm install

# 3. 开发运行（桌面窗口，首次编译 Rust 较慢）
npm run tauri dev

# 4. 打包 Windows 安装包（NSIS/MSI；需在 Windows 上构建）
npm run tauri build
```

素材说明：`src/assets/pet/` 下的 101 个精灵图 / 帽子图集**已提交进仓库**，无需重新抽取。
只有需要从已安装的 VS Code 重新抽取素材时才运行
`node scripts/extract-assets.mjs [/path/to/Visual Studio Code.app]`
（该脚本默认按 macOS 路径读取，Windows 上请传入 VS Code 的 `resources\app` 目录）。

### 4. 验证环境是否就绪

装完第 1 节后，最快的自检就是直接跑 `npm run tauri dev`。也可以分步确认：

```powershell
node -v          # ≥ v20.19
npm -v
rustc -V         # ≥ 1.90
cargo -V
link.exe         # 应能找到 MSVC 链接器（在 VS Developer Prompt 或配置好 PATH 后）
```

> macOS / Linux 上无需 MSVC 与 WebView2，分别需要 Xcode Command Line Tools 与 WebKitGTK
> 等 Tauri 系统依赖；这两个平台的移植在计划中，环境配置文档随移植补充。

## 已知限制 / 后续

- 第一版只覆盖主显示器；多显示器漫游待实现。
- 窗口在 Windows 上是「小窗跟随宠物」实现：窗口随宠物移动 / 缩放，只盖住宠物本体，因此
  不会遮挡其它窗口；macOS / Linux 的等价方案在后续移植时补充。
- 小窗模式下，超出宠物本体的瞬时特效（20 连击彩带、愚人节 pong 的球拍）可能被窗口边缘
  裁切，后续再处理。
- 开机自启、全局快捷键、通知触发鼓掌等为后续项。

---

<a id="english"></a>

# Buddy Roams Desktop

Buddy Roams desktop edition — bring VS Code's Buddy pet to roam across your entire desktop.

This is the first release, **Windows-first** (macOS / Ubuntu ports are planned).

## Features

- A small window that follows the pet: the OS window always covers only the pet itself, leaving the rest of the screen fully interactive (it never blocks the desktop or other windows).
- All pet states and animations, 17 hats, color changes, scaling, grow/shrink, random spawn point.
- Hat abilities: spinner propeller, propeller lift & throws, party click probability, wizard invisibility + teleport.
- Festivals: Halloween invisibility (hat + orange eyes only), April Fools' rightward gravity + horizontal pong.
- Drag / throw / mouse-bounce physics, left-click interactions, native right-click menu.
- System tray: show / hide / quit.

> Compared with the VS Code extension version, the following "editor-related" features don't exist in the desktop edition: cursor avoidance, IntelliSense suggest-widget avoidance, task-success clapping, editor typing detection.

## Assets & licensing

The pet sprite sheets and hat atlases are **Microsoft VS Code's copyrighted assets**, from the installed VS Code's `out/vs/workbench/contrib/chat/browser/widget/media/chatPet/` directory, extracted and bundled by `scripts/extract-assets.mjs`. Distributing these assets with the app carries copyright/compliance risk — evaluate it yourself. The `engine.js` and `chatPet.css` are derived from VS Code (MIT License).

## Development environment setup (Contributing)

This is a **Tauri v2 (Rust + WebView2) + Vite 8** desktop app, currently **Windows-first**. On a fresh Windows machine, install the dependencies below in order to compile and run.

### 1. Required dependencies

| Dependency | Version requirement | Install | Notes |
| --- | --- | --- | --- |
| Node.js (with npm) | ≥ 20.19 (22 LTS recommended) | `winget install OpenJS.NodeJS.LTS` | Vite 8 needs a recent Node |
| Rust (rustup, stable) | rustc ≥ 1.90 | `winget install Rustlang.Rustup` | Tauri 2.12's MSRV |
| Microsoft C++ Build Tools | VS 2022 Build Tools | see command below | **Most commonly missed**; provides `link.exe` and the Windows SDK |
| WebView2 Runtime | Evergreen | `winget install Microsoft.EdgeWebView2Runtime` | Built into Win11; the installer auto-fetches it if missing |
| Git | any recent version | `winget install Git.Git` | Clone the repo |

MSVC Build Tools must include the "**Desktop development with C++**" workload:

```powershell
winget install Microsoft.VisualStudio.2022.BuildTools --override "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --passive"
```

> The install is large (several GB); restart your terminal / system afterwards so `link.exe`, `cargo`, and `rustup` are on PATH.
> NSIS / WiX packaging tools are downloaded automatically by the Tauri CLI during `tauri build`; no manual install needed.

### 2. China mirrors (when downloads are slow; Tsinghua recommended)

```powershell
# rustup toolchain via Tsinghua TUNA
$env:RUSTUP_DIST_SERVER="https://mirrors.tuna.tsinghua.edu.cn/rustup"
rustup default stable

# crates.io via Tsinghua (write to C:\Users\<you>\.cargo\config.toml)
# [source.crates-io]
# replace-with = "tuna"
# [source.tuna]
# registry = "sparse+https://mirrors.tuna.tsinghua.edu.cn/crates.io-index/"

# npm via a China mirror
npm config set registry https://registry.npmmirror.com
```

### 3. Build & run

```bash
# 1. Clone the repo
git clone https://github.com/David9006/buddy_unleashed.git
cd buddy_unleashed/buddy-roams-desktop

# 2. Frontend dependencies
npm install

# 3. Dev run (desktop window; first Rust compile is slow)
npm run tauri dev

# 4. Package Windows installers (NSIS/MSI; must build on Windows)
npm run tauri build
```

Asset note: the 101 sprite sheets / hat atlases under `src/assets/pet/` are **already committed to the repo** — no extraction needed. Only run `node scripts/extract-assets.mjs [/path/to/Visual Studio Code.app]` if you need to re-extract from an installed VS Code (the script reads the macOS path by default; on Windows pass VS Code's `resources\app` directory).

### 4. Verify your environment

After section 1, the quickest self-check is to run `npm run tauri dev`. Or verify step by step:

```powershell
node -v          # ≥ v20.19
npm -v
rustc -V         # ≥ 1.90
cargo -V
link.exe         # MSVC linker should be found (from a VS Developer Prompt or with PATH configured)
```

> macOS / Linux need neither MSVC nor WebView2, but require Xcode Command Line Tools and WebKitGTK respectively (plus other Tauri system dependencies); ports for those platforms are planned, and their environment docs will be added with the port.

## Known limitations / next steps

- The first release covers only the primary monitor; multi-monitor roaming is planned.
- On Windows the window is implemented as a "small window following the pet": it moves and
  resizes with the pet and covers only the pet itself, so it never blocks other windows; the
  macOS / Linux equivalents will be added with those ports.
- In small-window mode, transient effects that extend beyond the pet itself (the 20-bounce
  confetti burst and the April Fools' pong paddle) may be clipped by the window edge; to be
  handled later.
- Auto-start, global shortcuts, notification-triggered clapping, etc. are future items.
