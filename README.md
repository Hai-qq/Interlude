# 间歇 · Interlude

一款通过菜单栏和小窗提醒你离开屏幕的本地桌面应用。手绘数字显示剩余使用时间，胖雀用呼吸、抬头和招呼表达提醒状态。

当前保留的是最新设计与可运行源码：主小窗 **320×320**，设置 **320×396**。日常、休息与归来共用小鸟的尺寸和位置，切换不会突然缩放。仓库不包含历史版本归档和安装包。

![当前小窗](design/editorial-reference/current.png)

## 本机运行

需要 Node.js 24 或更新版本、npm；macOS 构建还需要 Xcode Command Line Tools。当前原生活动检测面向 macOS，Windows 尚未具备等效检测能力。

```sh
npm ci
npm start
```

首次点「开启提醒」启用；之后常规后台启动仅保留菜单栏，点击菜单栏图标打开小窗。

### 看稿与交互预览

```sh
npm run preview:native
```

打开真正的本机窗口，使用独立临时数据，不更改正常用户设置。看稿模式置顶，不因失焦或屏幕捕获指示收起。再次运行命令会重启本项目记录的预览进程。设置与计时仍可操作。

```sh
npm run preview:web
```

打开 `http://127.0.0.1:5173/design/editorial-preview/index.html`。网页复用同一界面和计时核心，但仅模拟系统桥接，不能验证菜单栏、原生窗口收起或活动检测。

## 使用流程

- 近期输入、媒体播放或前台切换参与使用时长估计；小窗显示剩余分钟和本轮已用时间。
- 到点出现提醒，可以开始休息或推迟；推迟依次为 5、8、12 分钟，之后保持 12 分钟。关闭提醒或 12 秒未处理也会推迟。
- 点击「现在休息」或小鸟进入倒计时。休息窗 8 秒后收起，后台继续计时；可提前结束。
- 休息结束显示归来反馈，6.5 秒后收起。最长连续无输入达到设定休息时长的约 80% 才计入有效间歇，否则保留使用量。这些信号不能判断站立或身体姿态。
- 设置可调整使用时长、休息时长、小窗位置、外观和登录后台运行。未保存的草稿有离开保护。

生产模式下，小窗失焦会收起；屏幕捕获、锁屏及特定全屏活动会抑制提醒。应用不播放声音。

## 验证与构建

```sh
npm run typecheck
npm test
npm run build
npm run test:e2e
```

原生检查默认运行开发构建，使用独立数据和活动信号夹具，输出至 `reports/current/`。基本流程可加 `INTERLUDE_QA_SMOKE=1`；完整检查包含真实一分钟休息。检查打包产物时设置 `INTERLUDE_QA_EXECUTABLE` 为其可执行文件的绝对路径。

需要安装包时运行 `npm run make`，产物输出至 `out/v<版本号>/`。macOS 未配置 Developer ID 时使用本机 ad-hoc 签名，不包含公证。GitHub Actions 仅支持手动触发打包，不随推送自动发布。

## 文件与数据

- `src/`：Electron 主进程、原生活动辅助程序、React 界面与计时核心。
- `assets/`：当前胖雀、手绘数字、字体、纸纹及应用图标。
- `design/`：[当前交互说明](design/CURRENT-UI.md)、[素材与来源](design/ASSETS.md)、选定参考和网页预览。
- `tests/`、`scripts/`：测试、构建、看稿和许可清单工具。

正常用户数据位于 `~/Library/Application Support/Interlude`，包含设置、启用状态及本地每日活动估计；不联网同步。运行产物、试运行数据和依赖目录不提交到 Git。

代码采用 [MIT](LICENSE)，第三方依赖和字体许可见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。
