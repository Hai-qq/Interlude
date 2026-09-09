# 第三方依赖与素材许可

原创应用代码采用 MIT。胖雀、手绘数字和纸纹由本项目通过 OpenAI ImageGen 制作；素材及提示词见 [设计素材](design/ASSETS.md)。

中文字体使用未修改的 LXGW WenKai Lite Regular，随应用分发；采用 SIL Open Font License 1.1，见 [字体来源](assets/fonts/SOURCE.md) 和 [完整许可](assets/fonts/LXGWWenKaiLite-OFL.txt)。界面操作图标来自 Phosphor Icons（MIT）。

Electron 使用 MIT。构建时从锁定的 Electron 依赖复制 Chromium / Node 许可至 assets/legal，随应用打包。运行时不联网加载字体或设计素材。

| 依赖 | 版本 | 许可 | 用途 |
|---|---|---|---|
| @phosphor-icons/react | 2.1.10 | MIT | 运行时 |
| debug | 2.6.9 | MIT | 运行时 |
| electron-squirrel-startup | 1.0.1 | Apache-2.0 | 运行时 |
| ms | 2.0.0 | MIT | 运行时 |
| react | 19.2.8 | MIT | 运行时 |
| react-dom | 19.2.8 | MIT | 运行时 |
| scheduler | 0.27.0 | MIT | 运行时 |
| zod | 4.5.4 | MIT | 运行时 |

运行 `npm run licenses` 可重建许可清单。
