# Buddy Roams Desktop

**[中文](#chinese) · [English](#english)**

<a id="chinese"></a>

Buddy Roams 桌面版 —— 把 VS Code 的 Buddy 宠物放到你的 Windows 桌面上漫游。

这是一个**纯 Rust + Win32 原生应用**（无 WebView、无 HTML/JS）：用 `WS_EX_LAYERED` 分层窗口 +
`UpdateLayeredWindow` 做逐像素 alpha 合成。透明像素由系统自动点击穿透，不透明像素可交互——
这正是成熟 Windows 桌面宠物（Shimeji 一类）的经典做法。

## 功能

- 逐像素点击穿透：只有宠物实际绘制的像素拦截鼠标，其余全部穿透到桌面和其它窗口。
- 全部状态与动画：待机、睡眠/唤醒、点击互动（buttonPress / love / cool / sing / speechless /
  worry / yapping / 变身）、拖拽 / 抛掷（重力、撞墙、落地、鼠标弹跳连击、20 连击彩带）、晕眩。
- 周期性「思考」（rendering）状态 + 语音气泡；Go on the Run 带搜寻 / 回场动画。
- 17 顶帽子 + 特殊能力（spinner 竹蜻蜓、propeller 升力、party 点击概率、wizard 隐身 + 瞬移）。
- 换色（Stable / Insiders / 8 种自定义）、缩放 grow/shrink、Go on the Run。
- 节日：万圣节隐身（只露帽子 + 橙色眼球）、愚人节右向重力 + 左右 pong。
- 原生右键菜单 + 系统托盘（显示 / 隐藏 / 退出），位置/大小/颜色/饰品持久化到
  `%APPDATA%\BuddyRoams\config.json`。
- 全局快捷键：`Ctrl+Alt+=` 放大、`Ctrl+Alt+-` 缩小（与 VS Code 插件一致）。

## 素材来源与授权

宠物精灵图与帽子图集是 **Microsoft VS Code 自带的版权素材**，来自已安装 VS Code 的
`out/vs/workbench/contrib/chat/browser/widget/media/chatPet/` 目录，由
`scripts/extract-assets.mjs` 抽取并在编译期由 `build.rs` 内嵌进二进制。将这些素材随应用分发
存在版权/合规风险，请自行评估。引擎逻辑派生自 VS Code（MIT License）。

## 开发环境（Windows）

需要 **Rust（rustc ≥ 1.90）** 和 **Microsoft C++ Build Tools（MSVC）**：

```powershell
winget install Rustlang.Rustup
winget install Microsoft.VisualStudio.2022.BuildTools --override "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --passive"
```

国内镜像（清华 TUNA）：

```powershell
$env:RUSTUP_DIST_SERVER="https://mirrors.tuna.tsinghua.edu.cn/rustup"
rustup default stable
# crates.io 走清华：写入 C:\Users\<你>\.cargo\config.toml
# [source.crates-io]
# replace-with = "tuna"
# [source.tuna]
# registry = "sparse+https://mirrors.tuna.tsinghua.edu.cn/crates.io-index/"
```

编译运行：

```powershell
git clone https://github.com/David9006/buddy_roams.git
cd buddy_roams\buddy-roams-desktop
cargo run --release
```

## 架构

默认 `cargo run --release` 编译的是**宿主架构**（在 ARM64 Windows 上就是 ARM64 原生构建）。支持三种
Windows 目标，代码无需改动：

| 架构 | Rust target | 说明 |
|---|---|---|
| ARM64 | `aarch64-pc-windows-msvc` | ARM64 Windows（含虚拟机）原生 |
| amd64 | `x86_64-pc-windows-msvc` | Intel/AMD 64 位 Windows |
| x86（32 位） | `i686-pc-windows-msvc` | 老式 32 位 Windows |

交叉编译示例（在任意一台 Windows 上均可）。下面的脚本会一次编译三个架构，并把产物
按架构重命名到 `dist\` 目录，避免同名覆盖：

```powershell
rustup target add x86_64-pc-windows-msvc   # amd64
rustup target add i686-pc-windows-msvc     # x86
rustup target add aarch64-pc-windows-msvc  # ARM64

$targets = @{
  "aarch64-pc-windows-msvc" = "arm64"
  "x86_64-pc-windows-msvc"  = "amd64"
  "i686-pc-windows-msvc"    = "x86"
}

New-Item -ItemType Directory -Force dist | Out-Null
foreach ($t in $targets.Keys) {
  cargo build --release --target $t
  Copy-Item "target\$t\release\buddy-roams.exe" "dist\buddy-roams-$($targets[$t]).exe"
}
```

产物：`dist\buddy-roams-arm64.exe`、`dist\buddy-roams-amd64.exe`、`dist\buddy-roams-x86.exe`。

只编译单个架构时，手动重命名即可：

```powershell
cargo build --release --target x86_64-pc-windows-msvc
Copy-Item target\x86_64-pc-windows-msvc\release\buddy-roams.exe dist\buddy-roams-amd64.exe
```

素材已内嵌进二进制，无需再抽取；只有需要从已安装的 VS Code 重新抽取时才运行
`node scripts/extract-assets.mjs`。

## 已知限制 / 后续

- 只覆盖主显示器；多显示器漫游待实现。
- DPI 缩放已按系统 DPI 适配；多显示器逐屏 DPI 待实现。
- macOS / Linux 移植在计划中。

---

<a id="english"></a>

# Buddy Roams Desktop

Buddy Roams desktop edition — bring VS Code's Buddy pet to your Windows desktop.

This is a **pure Rust + Win32 native app** (no WebView, no HTML/JS): a `WS_EX_LAYERED` window
presented via `UpdateLayeredWindow` for per-pixel alpha. Transparent pixels are automatically
click-through and opaque pixels are interactive — the classic technique used by mature Windows
desktop pets (Shimeji-style).

## Features

- Per-pixel click-through: only the pixels the pet actually renders intercept the mouse; everything
  else passes through to the desktop and other windows.
- All states and animations: idle, sleep/wake, click interactions (buttonPress / love / cool / sing
  / speechless / worry / yapping / transformation), drag & throw (gravity, wall bounce, landing,
  mouse-bounce combos, 20-bounce confetti burst), dizziness.
- Periodic "thinking" (rendering) state with the speech bubble; Go on the Run with search / return
  animations.
- 17 hats + special abilities (spinner propeller, propeller lift, party click chance, wizard
  invisibility + teleport).
- Colors (Stable / Insiders / 8 custom), grow/shrink scale, Go on the Run.
- Festivals: Halloween invisibility (hat + orange eyes), April Fools' rightward gravity + horizontal
  pong.
- Native right-click menu + system tray (show / hide / quit); position/size/color/accessory persist
  to `%APPDATA%\BuddyRoams\config.json`.
- Global hotkeys: `Ctrl+Alt+=` to grow, `Ctrl+Alt+-` to shrink (matches the VS Code extension).

## Assets & licensing

The pet sprite sheets and hat atlases are **Microsoft VS Code's copyrighted assets**, from the
installed VS Code's `out/vs/workbench/contrib/chat/browser/widget/media/chatPet/` directory,
extracted by `scripts/extract-assets.mjs` and embedded at compile time by `build.rs`. Distributing
them carries copyright/compliance risk — evaluate it yourself. The engine logic is derived from VS
Code (MIT License).

## Development environment (Windows)

Requires **Rust (rustc ≥ 1.90)** and **Microsoft C++ Build Tools (MSVC)**:

```powershell
winget install Rustlang.Rustup
winget install Microsoft.VisualStudio.2022.BuildTools --override "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --passive"
```

China mirrors (Tsinghua TUNA):

```powershell
$env:RUSTUP_DIST_SERVER="https://mirrors.tuna.tsinghua.edu.cn/rustup"
rustup default stable
# crates.io via Tsinghua: write to C:\Users\<you>\.cargo\config.toml
# [source.crates-io]
# replace-with = "tuna"
# [source.tuna]
# registry = "sparse+https://mirrors.tuna.tsinghua.edu.cn/crates.io-index/"
```

Build & run:

```powershell
git clone https://github.com/David9006/buddy_roams.git
cd buddy_roams\buddy-roams-desktop
cargo run --release
```

## Architectures

`cargo run --release` builds for the **host architecture** by default (native ARM64 when run on an
ARM64 Windows machine). Three Windows targets are supported with no code changes:

| Architecture | Rust target | Notes |
|---|---|---|
| ARM64 | `aarch64-pc-windows-msvc` | native on ARM64 Windows (including VMs) |
| amd64 | `x86_64-pc-windows-msvc` | Intel/AMD 64-bit Windows |
| x86 (32-bit) | `i686-pc-windows-msvc` | legacy 32-bit Windows |

Cross-compilation examples (from any Windows machine). The script below builds all three
architectures at once and renames the artifacts into `dist\` by architecture, so they never
overwrite each other:

```powershell
rustup target add x86_64-pc-windows-msvc   # amd64
rustup target add i686-pc-windows-msvc     # x86
rustup target add aarch64-pc-windows-msvc  # ARM64

$targets = @{
  "aarch64-pc-windows-msvc" = "arm64"
  "x86_64-pc-windows-msvc"  = "amd64"
  "i686-pc-windows-msvc"    = "x86"
}

New-Item -ItemType Directory -Force dist | Out-Null
foreach ($t in $targets.Keys) {
  cargo build --release --target $t
  Copy-Item "target\$t\release\buddy-roams.exe" "dist\buddy-roams-$($targets[$t]).exe"
}
```

Artifacts: `dist\buddy-roams-arm64.exe`, `dist\buddy-roams-amd64.exe`, `dist\buddy-roams-x86.exe`.

To build a single architecture, rename it manually:

```powershell
cargo build --release --target x86_64-pc-windows-msvc
Copy-Item target\x86_64-pc-windows-msvc\release\buddy-roams.exe dist\buddy-roams-amd64.exe
```

The assets are embedded in the binary; re-extraction is only needed if you want to pull them again
from an installed VS Code (`node scripts/extract-assets.mjs`).

## Known limitations / next steps

- Primary monitor only; multi-monitor roaming is planned.
- DPI scaling now adapts to the system DPI; per-monitor DPI is a follow-up.
- macOS / Linux ports are planned.
