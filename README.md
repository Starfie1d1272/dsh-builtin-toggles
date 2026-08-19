# dsh-builtin-toggles — Evidence-backed Built-in Capability Inspector

简体中文 | [English](README.en.md)

DeepSeek Harness Web 的 evidence-backed 内置 capability Inspector；9 个经过审阅的 UI controls 只是极窄、fail-closed 的附加能力。

> 非官方社区插件（unofficial community plugin）。与 DeepSeek Harness 官方无关，不受官方支持。

[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)
[![npm version](https://img.shields.io/npm/v/dsh-builtin-toggles?logo=npm)](https://www.npmjs.com/package/dsh-builtin-toggles)
[![CI](https://github.com/Starfie1d1272/dsh-builtin-toggles/actions/workflows/ci.yml/badge.svg)](https://github.com/Starfie1d1272/dsh-builtin-toggles/actions/workflows/ci.yml)

本插件位于 **设置 → 插件 → 内置插件**。它显示由 Host 生成的 capability inspection：审阅事实、profile override、可持久化性、兼容性和 mutation eligibility 均由服务端计算。检查结果按 composition scope 区分：Host/profile 组合与按会话挂载的 Agent 预设组合即使使用相同 id（如 `tool-bash`）也不会互相误判为重复。

![Capability Inspector 主视图](https://raw.githubusercontent.com/Starfie1d1272/dsh-builtin-toggles/main/docs/assets/builtin-toggles-inspector.png)

截图环境：published `@deepseek-ai/dsh@0.1.0-rc.6`、内置 `standard` Agent 预设、本插件当前版本；数据未伪造。Host 不公开稳定 runtime release identity，因此 Compatibility 如实显示 `unverified / 运行时身份不可用`。（另两张真实截图保存在 `docs/assets/`：`builtin-toggles-anomalies.png` 展示干净 rc.6 + 内置 `standard` Agent 预设下仅异常项为 0，`builtin-toggles-agent-preset-scope.png` 展示 26 个按会话挂载的 Agent 预设组合条目。）

## 安装

前置：已初始化的 DSH `web` profile。后续公开 DSH 版本可能仍可安装或运行，但除非经过明确 review，不自动成为 supported/reviewed baseline。

已安装 `dsh` CLI：

```sh
dsh plugin --profile web add dsh-builtin-toggles
dsh web
```

使用 npx（无需全局安装 `dsh`）：

```sh
npx @deepseek-ai/dsh plugin --profile web add dsh-builtin-toggles
npx @deepseek-ai/dsh web
```

安装后重启 DSH web/gateway，使启动时读取 bundle 层。

## 功能

- **Capability Inspector / Doctor**：检查当前 Web Loader 的所有 capability，包括 external、未审阅和异常条目；逐项展示运行状态、profile override 三态、Agent 预设 ownership、composition scope（Host 组合 / Agent 预设组合）、审阅溯源、依赖证据、兼容性与服务端计算的 mutation eligibility。
- **筛选与诊断**：按 ID/包名、类别、管理平面、组合范围、策略、验证、运行状态及异常筛选；可复制不含本地路径和配置内容的脱敏诊断报告。复制成功/失败反馈显示在按钮旁。
- **Composition-scope 建模**：duplicate 检查使用 Loader 的公开 `Entry.id`（含 tree-owner 链）。Host 与内置 `standard` Agent 预设中合法的同 ID 各自归属不同 composition scope，不产生 `duplicate_runtime_id` 或 `new_official_entry`；同一 scope 内的真正碰撞仍然 `drifted` 并 fail-closed。Agent 预设条目由服务端 DTO 直接锁定：`policy=locked`（reason `agent-preset`）、`mutationEligibility=ineligible`，绝不借用同 bare-id Host 行的可管理性，也不会变成 Web-profile 可管理项。v1 的 `profileOverride.state` / `profilePersistence.status` 值域保持不变（preset 行保守投影为 `unavailable`/`unwritable`），真实语义由新增 additive 字段 `configuration.profileApplicability`（`applicable`/`not-applicable`）表达，且不把这种「不适用」当异常。
- **Agent 预设平面**：`tool-*` / `plan-mode` 等按会话由 Agent 预设组装，单独标注，绝不误认为 profile override。
- **9 个 reviewed UI controls**：仅 `ui-deliverables`、`ui-jobs`、`ui-goal`、`ui-message-feedback`、`ui-model-selection`、`ui-agent-preset`、`ui-skill`、`ui-subagent`、`ui-trajectory`。它们是纯界面 leaf，作用于 `web` profile、影响全部 Web 会话、不编辑 Agent 预设；强制开关更新 Host 并持久化，恢复继承交由 DSH profile/HMR 重组下层值。
- **Fail-closed**：核心服务、Agent 能力、第三方与未知条目一律锁定；没有 generic plugin manager、marketplace 或安装/更新生命周期。
- **Inspection API v1**：`GET /api/builtin-toggles/v1/inspection` 是稳定、无本地化文案的机器接口，提供 inventory、审阅基线、配置三态、compatibility 和 eligibility。详见 [Inspection API v1](docs/inspection-api.md)。

## 安全与访问边界

可管理性只来自 `src/policy.ts` 中的精确 `MANAGEABLE_IDS` allowlist。每次 POST 都在服务端重新校验 allowlist、body、entry、`@deepseek-ai/*` 包身份、self protection、eligibility 和 profile writer；浏览器从不是授权边界。

loopback 和显式 trusted host 都能读取 API；所有 configuration mutation 则额外要求 loopback same-origin。`trustedHosts` 只用于 DNS rebinding 防御，**不是认证**。v1 的 `access.mutation` 如实表示当前请求的传输访问；它不同于每条 capability 的 `mutationEligibility`。远程 Inspector 是只读。

## 兼容性与 support policy

- 唯一 reviewed/tested baseline 是 published `@deepseek-ai/dsh-base@0.1.0-rc.6` 与 `@deepseek-ai/dsh-web-app@0.1.0-rc.6` artifacts，不是 `>= rc.6` 的版本范围承诺。
- later public releases 可能仍可安装/运行；未经明确 review 前不成为 supported/reviewed baseline。current-public workflow 只发布 observational drift report，不升级 support claim。
- live Host 没有稳定公开 runtime release identity 时，inspection 诚实保持 `unverified`；不从模块路径、私有字段或版本猜测身份。`runtime_release_identity_unavailable` 只导致 `unverified`，不会单独把兼容性变成 `drifted`。
- “仅异常项”与 compatibility evaluator 语义一致：已被 evaluator 接受的合法 runtime augmentation（Host 生成的 helper id、按会话挂载的 Agent 预设行）不因缺少 baseline row 而显示为异常；真正的 drift、failed lifecycle、profile unavailable/unwritable、新的官方结构变化仍然显示。
- compatibility 与 mutation eligibility 分层：身份缺失不会伪造 verified，逐条 mutation 仍需独立的 safe-leaf、结构漂移与 writer 安全检查。

完整维护边界见 [COMPATIBILITY.md](COMPATIBILITY.md)，安全报告见 [SECURITY.md](SECURITY.md)。

## 发行版与集成方

- package identity：`dsh-builtin-toggles`；display product：**Evidence-backed Built-in Capability Inspector**；仅 Web profile。
- 建议精确版本 pin，不随上游自动漂移；reviewed baseline 是上述 rc.6 artifacts。baseline/compatibility review 责任仍由发行版或集成方明确承担。
- v1 read API 是稳定机器接口；trusted-host inspection 为只读，configuration mutation 仅 loopback；mutation 始终 fail-closed。
- 不管理第三方插件生命周期，不提供 marketplace，不编辑 Agent 预设。卸载前请对本插件 force 过的条目执行 **恢复继承**，只删除自己的顶层 literal `disabled` override。

## 卸载

已安装 `dsh` CLI：

```sh
dsh plugin --profile web remove dsh-builtin-toggles
```

使用 npx：

```sh
npx @deepseek-ai/dsh plugin --profile web remove dsh-builtin-toggles
```

然后重启。插件不会擅自删除用户 profile 内容。

## 开发

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm pack:check
```

## 贡献与 License

请阅读[贡献指南](CONTRIBUTING.zh-CN.md)（[English](CONTRIBUTING.md)）。MIT。
