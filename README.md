# dsh-builtin-toggles — Verified Built-in Capability Inspector

DeepSeek Harness Web 的已审阅内置 capability 检查器与极小、fail-closed 的安全开关面。

> 非官方社区插件（unofficial community plugin）。与 DeepSeek Harness 官方无关，不受官方支持。

[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)

DSH Web 由大量官方内置插件组成。本插件在 **设置 → 插件 → 内置开关** 显示服务端生成的 capability inspection：已审阅事实、profile override、可持久化性、兼容性和 mutation eligibility 都由 Host 计算。旧版 catalog 截图不再代表当前 Inspector，因此不作为产品证据保留。

## 安装

前置：`dsh` CLI（≥ 0.1.0-rc.6，web profile 已初始化）。

```sh
dsh plugin --profile web add dsh-builtin-toggles
```

安装后需要重启 DSH web/gateway 才会首次加载（bundle 层在启动时读取）。

## 功能

- **Capability Inspector**：检查当前 Web Loader 的所有 capability（包括 external、未审阅和异常条目），逐项显示运行状态、三态 profile override、Agent Preset ownership、审核溯源、依赖证据、兼容性发现与服务端计算的 mutation eligibility。
- **Compatibility / Doctor 摘要**：明确区分 `verified`、`drifted`、`unverified`；运行时发布身份不可用时如实标为 `unverified`，不将其表述为系统故障，也不把它当作 mutation eligibility 的替代。
- **本地筛选与诊断**：按 ID/包名搜索，并可按类别、管理平面、策略、验证、运行状态及异常筛选；可复制不含本地路径和配置内容的诊断报告。
- **Agent Preset 状态解释**：`tool-*` / `plan-mode` 等由 Agent Preset 按会话组装的 capability 单独标注，绝不误认为 profile override。
- **9 个经过审核的安全 UI 开关**：`ui-deliverables`、`ui-jobs`、`ui-goal`、`ui-message-feedback`、`ui-model-selection`、`ui-agent-preset`、`ui-skill`、`ui-subagent`、`ui-trajectory` —— 都是纯界面插件；这些开关作用于 DSH 的 `web` profile，因此会影响所有 Web 会话，不会修改 Agent 预设；强制开关会更新 Host 并持久化，恢复继承则由 DSH profile/HMR 重组重新暴露下层值。
- **其余插件 fail-closed 锁定**：核心服务、Agent 能力与未知条目一律锁定，不提供开关。
- **能力检查与保守授权 API**：`GET /api/builtin-toggles/v1/inspection` 提供版本化、无本地化文案的 Loader 清单、审阅基线、配置三态、独立的 profile 可持久化预检、兼容性与服务端计算的逐条 mutation eligibility。Host 未公开运行时发布身份时，inspection 会诚实标为 `unverified`；这不会单独关闭已审核 leaf，但可观测的新增官方条目、包/`inject`/重复 id 等结构变化会因无法建立 consumer 图而保守拒绝写入。它不宣称能发现不可观测的未来内部 consumer 变化。详见 [Inspection API v1](docs/inspection-api.md)。

## 安全模型

可管理性完全来自 `src/policy.ts` 的精确显式 allowlist（`MANAGEABLE_IDS`），没有“名字看起来像 UI 所以允许”的启发式；服务端在每次开关请求时重新执行全部检查（allowlist、body 合法性、entry 存在、`@deepseek-ai/*` 包名、非插件自身），任何一条不满足都拒绝。UI 隐藏按钮不是安全边界。

inspector 只消费服务端 v1 inspection DTO；类别、审核信息、兼容性与 eligibility 都不由浏览器从 catalog、ID 模式或 compatibility 状态推导。旧目录元数据也绝不参与授权。

## 兼容性

- Reviewed/tested baseline: published `@deepseek-ai/dsh-base@0.1.0-rc.6` 与 `@deepseek-ai/dsh-web-app@0.1.0-rc.6`。这不是 `>= rc.6` 的承诺；当前公开 npm 版本仅由 scheduled workflow 观察，不会自动成为 supported。
- 开关的运行时效果是 Host 侧**立即生效**；已打开的浏览器页面需要**刷新后**才应用 client-side 改变（rc.6 行为），切换成功后面板会提示“刷新页面后生效”。
- 持久化写入 profile 的 `cordis.patch.yml`，重启后保持。
- inspection compatibility 与 mutation eligibility 是不同概念；除完整 rc.6 发布补丁结构外，`verified` 仍需要 Host 公开运行时身份。当前 DSH 没有向插件公开该稳定身份，因此真实环境会诚实标为 `unverified`，不会仅凭版本号或相同 Loader 结构声称兼容；但逐条 mutation 仍必须通过独立的 reviewed-leaf、结构漂移与 writer 安全检查。

## 卸载

```sh
dsh plugin --profile web remove dsh-builtin-toggles
```

然后重启。卸载前应在 Inspector 对每个本插件曾 force 的项执行 **恢复继承**，以只删除该顶层 literal `disabled` override。卸载不会擅自删除任意用户 profile 内容，因为那可能属于用户或其他 bundle 的配置。

## 开发

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build     # tsdown → lib/index.js (node ESM) + lib/client.js (browser bundle)
pnpm pack:check
```

维护 reviewed baseline 和上游观察的限制见 [COMPATIBILITY.md](COMPATIBILITY.md)，安全报告见 [SECURITY.md](SECURITY.md)。

## 贡献

欢迎 Issue 和 PR。贡献前请阅读 [贡献指南](CONTRIBUTING.zh-CN.md)（[English](CONTRIBUTING.md)）。

## License

MIT。
