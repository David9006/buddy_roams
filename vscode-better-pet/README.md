# Buddy Unleashed (vscode-better-pet)

让 VS Code 聊天框里的 **Buddy 宠物** 出现在**代码区域**中 —— 使用**原版精灵图、原版动画、原版物理与交互**（即 Copilot 聊天里 `/vscode-pet` 那只，stable 配色）。

## 命令

- **Buddy Unleashed: Install** — 使宠物能够在代码区域显示，成功后提示完全退出并重启 VS Code。
- **Buddy Unleashed: Uninstall** — 一键还原。
- **Buddy Unleashed: Toggle** — 开/关宠物，并记住开关状态；开启时 VS Code 启动后自动唤出。
- **Buddy Unleashed: Diagnose** — 显示状态与诊断信息。

## 宠物行为（与原版一致，不含键盘控制与成就系统）

- **待机动画**：原版 50 帧 idle 精灵，周期性眨眼，眼睛跟随鼠标。
- **睡觉/醒来**：空闲 20 秒后入睡，交互后醒来。
- **打字**：敲代码时宠物进入 typing 状态，停止敲击后回到待机。
- **任务成功**：构建/测试任务以退出码 0 结束时，宠物鼓掌（clapping）。
- **光标躲避**：文本光标（不是鼠标）靠近时，宠物跳着躲开；被逼到墙角则躲起来，光标走远后恢复。
- **点击**：随机触发 buttonPress / love / cool / sing / speechless / worry / yapping 等原版表情，小概率触发稀有旋转（complete）。
- **拖拽 + 抛掷**：按住拖走，松手时按速度进入抛射（重力、撞墙反弹、旋转、落地 squish）；无速度则自由落体。
- **鼠标弹跳**：宠物下落时用鼠标接住会弹起并累计连击；达到 20 次落地时触发原版彩带庆祝。
- **连续快速转向**会眩晕（dizzy）。
- **换装**：右键可给 Buddy 戴上 17 种帽子/配饰。
- **换色**：右键可切换 Stable / Insiders / 8 种自定义配色。
- **调整大小**：右键可 Grow / Shrink / Reset Size。
- **Go on the Run**：右键让宠物躲起来，再点宠物唤回。

右键菜单走 VS Code 的**原生上下文菜单**（macOS 上是系统原生菜单），与内置聊天宠物一致。开关状态、位置、大小、颜色与配饰会持久保存。

## 设置

- `betterPet.appRoot`：VS Code `Resources/app` 目录的绝对路径，留空则自动检测。macOS 默认示例：`/Applications/Visual Studio Code.app/Contents/Resources/app`。

## ⚠️ 注意事项

- 仅保证匹配 **VS Code 1.141.0** 官方构建，版本不符时 Install 会拒绝执行。
- VS Code 自动更新后需重新运行 Install。
- 每一步都带备份与回滚，失败会自动还原。
