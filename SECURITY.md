# 安全问题

请通过 [GitHub 私密漏洞报告](https://github.com/Hai-qq/Interlude/security/advisories/new)提交潜在安全问题，不要在公开 Issue 中贴出凭据、私人文件或可直接利用的细节。

报告请包含受影响的版本或提交、运行环境、最小复现步骤、预期影响，以及脱敏后的日志。报告入口不可用时，请暂缓公开细节，通过 GitHub 联系维护者 [@Hai-qq](https://github.com/Hai-qq)协调报告方式。

当前只维护默认分支的最新代码；旧版本不承诺安全补丁回移。本项目由个人维护，没有固定响应时限。修复会在验证后说明影响范围与升级方式。

## 已知构建依赖告警

2026-09-13 使用官方 npm registry 检查：运行时依赖审计为 0 项告警；包含开发依赖时有 20 个受影响包条目，集中在 Electron Forge 打包链的两个底层组件。

- `extract-zip`：解压不可信归档时的符号链接路径穿越，见 [GHSA-jmr9-qjv8-65gv](https://github.com/advisories/GHSA-jmr9-qjv8-65gv) 和 [GHSA-7pqw-9j4j-h8q3](https://github.com/advisories/GHSA-7pqw-9j4j-h8q3)。
- `image-size`：特制图像导致的解析循环，见 [GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr) 和 [GHSA-5p2g-fcmc-qvqq](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq)。

检查时上游最新发布仍未提供可直接采用的修复版本；不通过自动降级 Forge 或覆盖审计结果来隐藏告警。打包仅使用仓库内已审查的资产与校验过的官方 Electron 下载，不处理外部提交的不可信归档和图标。Dependabot 跟踪后续修复；维护时应重新运行 `npm audit`，此记录不是持续有效的安全保证。
