# 安全问题

请通过 [GitHub 私密漏洞报告](https://github.com/Hai-qq/Interlude/security/advisories/new)提交潜在安全问题，不要在公开 Issue 中贴出凭据、私人文件或可直接利用的细节。

报告请包含受影响的版本或提交、运行环境、最小复现步骤、预期影响，以及脱敏后的日志。报告入口不可用时，请暂缓公开细节，通过 GitHub 联系维护者 [@Hai-qq](https://github.com/Hai-qq)协调报告方式。

当前只维护默认分支的最新代码；旧版本不承诺安全补丁回移。本项目由个人维护，没有固定响应时限。修复会在验证后说明影响范围与升级方式。

## 已知构建依赖告警

2026-10-16 使用官方 npm registry 检查：运行时依赖审计为 0 项告警；包含开发依赖时还有 5 个底层包的告警，都在 Electron Forge 7 的打包链里，只在本地打包时运行，不进入发布的应用。这几个包本身都还没有发布修复版本：

| 包 | 公告 | 引入路径 | 上游情况 |
|---|---|---|---|
| `extract-zip` 2.0.1 | [GHSA-jmr9-qjv8-65gv](https://github.com/advisories/GHSA-jmr9-qjv8-65gv)、[GHSA-7pqw-9j4j-h8q3](https://github.com/advisories/GHSA-7pqw-9j4j-h8q3)：解压不可信归档时的符号链接路径穿越 | `@electron/packager` 18 | Forge 8 使用的 `@electron/packager` 20 已换成 `@electron-internal/extract-zip` |
| `braces` 3.0.3 | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)：深层嵌套模式导致栈耗尽 | `fast-glob` → `micromatch` | Forge 8 不再引入 |
| `sprintf-js` 1.1.3 | [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c)：超大精度参数导致拒绝服务 | `@electron/get` 3 → `global-agent` | Forge 8 不再引入 |
| `image-size` 0.7.5 | [GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr)：ICNS 解析死循环 | `@electron-forge/maker-dmg` → `appdmg` | 升到 Forge 8 后仍在 |

Forge 8 是大版本升级，需要单独验证打包产物后再进行；不通过 `npm audit fix --force` 自动升级或覆盖审计结果来隐藏告警。打包仅使用仓库内已审查的资产与校验过的官方 Electron 下载，不处理外部提交的不可信归档和图标。

`http-cache-semantics` 的 [GHSA-ch52-4w7c-c8xp](https://github.com/advisories/GHSA-ch52-4w7c-c8xp) 标注影响 4.2.0 及以前的版本，没有给出修复版本。上游维护者认为这份报告不成立（RFC 9111 允许共享缓存复用带 `Set-Cookie` 的响应），[争议](https://github.com/kornelski/http-cache-semantics/issues/56)已提交到 GitHub Advisory Database。锁文件已升到 4.3.0，不在标注范围内，但 4.3.0 没有改动公告指出的逻辑。本项目只在打包时经由它发起 HTTP 请求，没有多用户共享缓存的场景。

Dependabot 跟踪后续修复；维护时应重新运行 `npm audit --registry=https://registry.npmjs.org`，此记录不是持续有效的安全保证。
