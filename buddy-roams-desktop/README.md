# Buddy Roams Desktop

Buddy Roams 桌面版 —— 把 VS Code 的 Buddy 宠物放到你的整个桌面上漫游。

当前为 **Windows 优先** 的首个版本（macOS / Ubuntu 移植在计划中）。

## 功能

- 全屏透明、置顶的覆盖层：只有宠物本体可交互，其余像素鼠标穿透（点不到宠物就等于点在桌面上）。
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

## 开发

环境要求：Node.js + npm、Rust（stable）、Tauri v2 系统依赖。

```bash
# 1. 抽取素材（默认从 macOS 的 VS Code 路径读取，可传其它路径）
node scripts/extract-assets.mjs [/path/to/Visual Studio Code.app]

# 2. 前端依赖
npm install

# 3. 开发运行（桌面窗口）
npm run tauri dev

# 4. 打包（Windows: NSIS/MSI；需在 Windows 上构建）
npm run tauri build
```

## 已知限制 / 后续

- 第一版只覆盖主显示器；多显示器漫游待实现。
- 点击穿透在 Windows 上通过 `WM_NCHITTEST` 返回 `HTTRANSPARENT` 实现；macOS / Linux 的
  等价方案在后续移植时补充。
- 开机自启、全局快捷键、通知触发鼓掌等为后续项。
