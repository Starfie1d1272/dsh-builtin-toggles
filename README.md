# dsh-builtin-toggles

> 非官方社区插件（unofficial community plugin）。与 DeepSeek Harness 官方无关，不受官方支持。

在 DeepSeek Harness（DSH）Web 界面的 **设置 → 插件** 内新增第三个标签页 **内置开关 / Built-ins**：
查看官方 built-in Loader entries，并用 GUI 开关一小撮经过明确安全审核的、纯 Web UI / presentation 类官方插件。

## 它做什么

- 只读展示当前 Loader 树中的官方内置插件（id / module / enabled / phase）。
- 对 **明确 allowlisted** 的少量官方 Web UI 插件提供开关：
  `ui-deliverables`、`ui-jobs`、`ui-goal`、`ui-message-feedback`、`ui-model-selection`、`ui-agent-preset`、`ui-commands`、`ui-skill`、`ui-subagent`、`ui-trajectory`。
- 其他 `@deepseek-ai/*` 内置插件默认折叠展示，全部锁定（标出锁定原因），不提供开关。
- 开关同时生效于当前运行时（`entry.update({ disabled })`）与重启之后（profile `cordis.patch.yml` 持久化）。

## 它明确不是什么

- **不是插件市场**，不做第三方插件安装 / 卸载 / 更新，不做搜索，不做 npm/GitHub 管理。
- **不是通用 plugin manager**：不能任意开关 Loader entry；未知 id 默认锁定（fail closed）。
- **不做** Agent tool / MCP / 模型 prompt 注入 / agent preset 或 tool 插件管理。
- **不修改 DeepSeek Harness 源码**，不 patch/fork 官方仓库，不新建独立 Settings 导航页。
- **不提供模型可见的工具**：Host 不注册任何 tools。

## 安全 allowlist 模型

可管理性完全来自 `src/policy.ts` 中的**精确显式 allowlist**（`MANAGEABLE_IDS`），没有“名字看起来像 UI 所以允许”的启发式。服务端在每次 POST 时重新执行全部检查，UI 隐藏按钮不是安全边界：

1. id 必须在 allowlist 中，否则 403；
2. body 必须是 `{ "disabled": boolean }`，否则 400；
3. 当前 Loader 中必须存在该 entry，否则 404；
4. entry 的 module/package 必须以 `@deepseek-ai/` 开头（即使第三方抢占同名 id 也无法操作），否则 403；
5. 不能是本插件自身（`builtin-toggles` / `dsh-builtin-toggles`），否则 403。

以下类型永远锁定：loader / Cordis core、modules、connection、api-remotes、client-runtime、cordis-client-runner、ui-theme、locale、ui-layout、ui-sidebar、ui-settings、ui-settings-general、ui-settings-plugins、ui-conversation、ui-input-trigger、ui-tool、plugin-inventory、api-gateway、webserver、web-runtime、client-hmr、storage / session / workspace 等 Host 基础设施，以及 agent preset plane 的 `tool-*` / `skill-*` / compaction / subagent 等模型能力。

## 安装

前置：`dsh` CLI（≥ 0.1.0-rc.6，web profile 已初始化）。

```sh
dsh plugin --profile web add "/绝对/路径/dsh-builtin-toggles"
```

- 安装后 profile 的 `dsh.profile.bundles` 会加入 `dsh-builtin-toggles`，`cordis.patch.yml`（bundle layer）只挂载一行：
  `- insert: { - id: builtin-toggles, name: dsh-builtin-toggles }`。
- **需要手动重启 DSH web/gateway** 后插件才首次加载（bundle 层在启动时读取）。
- 构建产物 `lib/` 已提交进 Git，安装无需 prepare/build 脚本、无需授权。

## 卸载

```sh
dsh plugin --profile web remove dsh-builtin-toggles
```

然后重启。本插件写入的 `disabled` override 会保留在 profile patch 中（卸载后这些行不再被消费，可手动清理）。

## 手动恢复

本插件只写 profile patch 的**顶层** `- id: <id>` 行的 `disabled:` 字段，且只新增/替换目标行自身。若需完全手动恢复：

1. 编辑 `$DSH_HOME/profiles/web/cordis.patch.yml`（`DSH_HOME` 未设置时为 `~/.dsh/profiles/web/cordis.patch.yml`）。
2. 找到对应的顶层 `- id: <id>` 行，删除 `  disabled: true`（或改为 `  disabled: false`）；若该行是本插件追加的最小 override，整行删除即可。
3. 保存后配置 HMR 或重启生效。

绝不删除文件中的注释、`!!js` 表达式或其他行——writer 与手动编辑都应保持最小改动。

## 当前兼容的 DSH 版本 / commit

- 验证环境：`dsh 0.1.0-rc.6`（npm `@deepseek-ai/dsh`），web profile。
- 上游核对 commit：`deepseek-ai/deepseek-harness` `47f943859bef60e4160492346772ded9b24f765a`（2026-08-13）。
- 使用的官方扩展点（均已核对存在）：
  - `settings.plugins.tab` slot（`packages/client/ui-settings/src/client/contract/slots.ts`；官方设计笔记 `.agents/notes/implemented/architecture/2026-08-11-plugin-settings-tabs.zh.md`）。
  - Loader `disabled` 配置字段与 profile patch 层（`docs/cordis-tutorial/05-config.zh.md`、`docs/user/develop/basic/publish.zh.md`）。
  - `ctx.loader.entries()` / `entry.update({ disabled })`（`@deepseek-ai/cordis-plugin-loader`）。
  - `ctx.webServer.register()` 同源路由（`@deepseek-ai/dsh-host-webserver`）。
  - client bundle：`window.__ModuleLoader__.load({ id, factory })`（browser CJS wrapper，平台模块走 module table）。

## 开发验证

```sh
pnpm install
pnpm typecheck     # tsc --noEmit
pnpm test          # node --import tsx --test tests/*.spec.ts（policy / patch writer / mutation flow）
pnpm build         # tsdown → lib/index.mjs + lib/client.js
```

安装到 profile 后可用只读方式确认组合：

```sh
dsh --profile web --dump-config   # 或当前等价的只读组合查看方式
```

UI 验证：重启 web 后打开 设置 → 插件 → 内置开关。

## License

MIT。
