# 安全问题

请通过 [GitHub 私密漏洞报告](https://github.com/Hai-qq/Interlude/security/advisories/new)提交潜在安全问题，不要在公开 Issue 中贴出凭据、私人文件或可直接利用的细节。

报告请包含受影响的版本或提交、运行环境、最小复现步骤、预期影响，以及脱敏后的日志。报告入口不可用时，请暂缓公开细节，通过 GitHub 联系维护者 [@Hai-qq](https://github.com/Hai-qq)协调报告方式。

当前只维护默认分支的最新代码；旧版本不承诺安全补丁回移。本项目由个人维护，没有固定响应时限。修复会在验证后说明影响范围与升级方式。

## 已知构建依赖告警

2026-10-16 使用官方 npm registry 检查：运行时依赖审计为 0 项告警；包含开发依赖时只剩 1 个底层包的告警（`npm audit` 把依赖链上的 4 个包都算作高危），只在 macOS 本地打包 DMG 时运行，不进入发布的应用：

| 包 | 公告 | 引入路径 | 上游情况 |
|---|---|---|---|
| `image-size` 0.7.5 | [GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr)：ICNS 解析死循环 | `@electron-forge/maker-dmg` → `electron-installer-dmg` → `appdmg` | 2.0.3 已修复，0.7.x 没有回移；`appdmg` 最新版 0.6.6 仍依赖 `^0.7.4`，2.x 的导出方式不兼容，不能用 `overrides` 强行替换 |

`appdmg` 只用 `image-size` 读取 DMG 背景图的尺寸。本项目没有配置背景图，读到的是 `electron-installer-dmg` 自带的 PNG，不会走到公告里的 ICNS 解析路径。

2026-10-16 已升级到 Electron Forge 8（`@electron/packager` 20），原先打包链里的 `extract-zip`、`braces`、`sprintf-js` 告警随之移除，`http-cache-semantics` 也不再被引入。不通过 `npm audit fix --force` 自动升级或覆盖审计结果来隐藏告警。打包仅使用仓库内已审查的资产与校验过的官方 Electron 下载，不处理外部提交的不可信归档和图标。

Dependabot 跟踪后续修复；维护时应重新运行 `npm audit --registry=https://registry.npmjs.org`，此记录不是持续有效的安全保证。
