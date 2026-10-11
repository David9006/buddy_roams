# Buddy Unleashed — 让 Copilot 宠物出现在代码区域

让 VS Code 里的 Buddy 宠物（原本只能待在 Copilot 聊天框的 `/vscode-pet` 里）**出现在整个代码区域**，在编辑器上方自由游走。

## 安装与使用

1. 安装插件，命令面板运行 **Buddy Unleashed: Install**。
2. **完全退出并重启 VS Code**。
3. 命令面板运行 **Buddy Unleashed: Toggle**（快捷键 `⌥⌘P`），🐈 就会出现在代码区域。
4. 想还原：运行 **Buddy Unleashed: Uninstall**。

## 命令

- **Buddy Unleashed: Install** — 使宠物能够在代码区域显示，成功后提示完全退出并重启 VS Code。
- **Buddy Unleashed: Uninstall** — 一键还原。
- **Buddy Unleashed: Toggle** — 开/关宠物，并记住开关状态；开启时 VS Code 启动后自动唤出。
- **Buddy Unleashed: Diagnose** — 显示状态与诊断信息。

## 宠物功能（与原版一致，不含键盘控制与成就系统）

- 原版待机动画、眨眼、眼睛跟随鼠标；空闲 20 秒入睡，点击唤醒。
- 敲代码时进入 typing（打字）状态；构建/测试任务成功时鼓掌（clapping）。
- 文本光标靠近时，宠物跳着躲开；被逼到墙角则躲起来，光标走远后恢复。
- 点击随机触发 buttonPress / love / cool / sing / speechless / worry / yapping 等表情，小概率稀有旋转。
- 拖拽 + 抛掷物理：重力、撞墙反弹、旋转、落地 squish；空中被鼠标接住会弹起并累计连击，20 连击触发彩带。
- 快速连续转向会眩晕（dizzy）。
- 右键菜单走 VS Code 原生菜单（macOS 上是系统原生菜单）：换装、换色、缩放、Go on the Run。
- 开关状态、位置、大小、颜色与配饰均持久保存。

## 设置

- `betterPet.appRoot`：VS Code `Resources/app` 目录的绝对路径，留空则自动检测。macOS 默认示例：`/Applications/Visual Studio Code.app/Contents/Resources/app`。

## ⚠️ 注意事项

- 仅保证匹配 **VS Code 1.141.0** 官方构建，版本不符时 Install 会拒绝执行。
- VS Code 自动更新后需重新运行 Install。
- 每一步都带备份与回滚，失败会自动还原。
