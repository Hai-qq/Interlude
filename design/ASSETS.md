# 当前设计素材

只保留现役素材和最新选定参考，不包含旧设计方案、旧安装包或历史源码压缩包。

| 路径 | 用途与来源 |
|---|---|
| `editorial-reference/selected.png` | 用户确认的图生视觉参考。 |
| `editorial-reference/current.png` | 最新原生窗口的同状态捕获，剩余 18 分钟、本轮已用 27 分钟。 |
| `../assets/graphite-bird/` | 已确认胖雀的日夜呼吸、抬头与招呼图集。内置 ImageGen 制作，配准见 `registration.json`，呼吸提示词见 `idle-generation.md`。 |
| `../assets/editorial/digits-handdrawn-white.png` | 内置 ImageGen 按参考绘制的 0–9 与冒号，1536×1024，提示词见同目录 `digits-prompt.txt`。 |
| `../assets/editorial/paper.png` | 内置 ImageGen 生成纸纹，以 18% 不透明度显示。提示词见同目录 `paper-prompt.txt`。 |
| `../assets/fonts/` | 未修改的 LXGW WenKai Lite Regular，固定来源提交见 `SOURCE.md`，SIL OFL 许可随字体保留。 |
| `../assets/interlude.icns`、`interlude.ico`、`icon.png`、`interlude.iconset/` | 当前应用图标及其多尺寸原文件，为本项目制作。 |
| `../assets/menuTemplate.png`、`menuTemplate@2x.png` | 当前静态菜单栏模板图。 |

胖雀直接播放完整绘制帧，不拼接头身，不对整鸟缩放来制造呼吸。渲染时只去除与边界连通的浅色纸底，夜间共享日间遮罩，内部笔触保留。日常、休息和归来共用位置与大小。

数字按单元格测量笔画，显示时将白底亮度转换为透明度，再组合为真实计时值。原 PNG 文件不修改；不是将整张设计稿当作界面截图。

Vite 将现用 PNG 与字体打包至 renderer，运行时不从网络加载。字体许可、Electron 和 Chromium 许可在构建时复制到 `assets/legal/` 并随应用分发。操作图标使用 Phosphor Icons（MIT）。图生素材不声称拥有商标注册或独占权。
