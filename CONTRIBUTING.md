# 参与间歇

先阅读 [README](README.md) 和[当前交互说明](design/CURRENT-UI.md)。问题反馈请附版本、macOS 版本、芯片架构、复现步骤与脱敏截图；提醒抑制和活动估计问题请说明锁屏、媒体播放和前台切换情况。

## 开发

使用 Node.js 24 和 npm；macOS 原生辅助程序需要 Xcode Command Line Tools。

```sh
npm ci
npm run typecheck
npm test
npm run build
```

界面和原生窗口改动还应运行 `npm run test:e2e`，或先用 `INTERLUDE_QA_SMOKE=1 npm run test:e2e` 做较短检查。测试使用独立临时数据，不要让测试指向日常用户目录。网页预览只能检查渲染和模拟交互，不能代替 macOS 活动检测或窗口行为验收。

## 提交

Fork 并创建分支，一次 PR 处理一个明确问题。附实际运行的检查和未验证范围；界面改动附明暗模式截图。保持现有小窗、菜单栏和计时核心的职责边界，勿引入遥测或联网服务作为默认行为。

项目内 `.npmrc` 与锁文件使用官方 npm registry，不修改开发者的全局配置。依赖使用精确版本并同步 `package-lock.json`；新增运行时依赖后运行 `npm run licenses` 检查许可变动。素材保留来源、许可和可编辑源文件，见[素材说明](design/ASSETS.md)。不要提交 `node_modules`、本地设置、安装包或测试截图目录。

维护者审查 PR 后合并。讨论遵守[社区约定](CODE_OF_CONDUCT.md)，安全问题通过[私密流程](SECURITY.md)报告。
