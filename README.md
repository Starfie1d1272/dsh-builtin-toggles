# dsh-builtin-toggles

> 非官方社区插件（unofficial community plugin）。与 DeepSeek Harness 官方无关，不受官方支持。

## Status

- Community plugin / unofficial
- **v0.1.0 已正式发布到 npm**：`dsh-builtin-toggles@0.1.0`
- Tested with DSH 0.1.0-rc.6（含真实 headless-browser E2E）
- **v0.2.0（当前开发版）：官方内置插件目录 + 安全开关**（尚未发布）

在 DeepSeek Harness（DSH）Web 界面的 **设置 → 插件** 内新增第三个标签页 **内置插件 / Built-ins**：
一个面向普通中文用户的「官方内置插件目录 + 安全开关」——解释当前 DSH Web 中每个官方内置插件是干什么的、现在是什么状态、为什么有些可以关闭、有些必须锁定。

## 安装

前置：`dsh` CLI（≥ 0.1.0-rc.6，web profile 已初始化）。

**从 npm 安装（v0.1.0 正式版）：**

```sh
dsh plugin --profile web add dsh-builtin-toggles
```

**从源码 / GitHub 安装（v0.2.0 开发版）：**

```sh
dsh plugin --profile web add "/绝对/路径/dsh-builtin-toggles"
```

两种方式安装后：

- profile 的 `dsh.profile.bundles` 会加入 `dsh-builtin-toggles`，`cordis.patch.yml`（bundle layer）只挂载一行：
  `- insert: { - id: builtin-toggles, name: dsh-builtin-toggles }`。
- **需要手动重启 DSH web/gateway** 后插件才首次加载（bundle 层在启动时读取）。
- 源码安装无需 prepare/build 脚本、无需授权（构建产物 `lib/` 已提交进 Git）；npm 安装同理（发布内容自带 `lib/`）。

## 界面预览

> 截图占位：后续迭代补充「设置 → 插件 → 内置插件」的真实 UI 截图。

## 它做什么

- **中文目录**：为当前 Web Loader 中的每个官方内置插件提供中文名称、一句话说明、分类标签，展开后显示“关闭后 / 建议”（可管理项）或“为什么锁定 / 状态说明”（锁定项）。
- **本地搜索**：按名称、功能、ID 或包名过滤全部条目，不请求网络，无服务端搜索。
- **安全开关（9 个）**：仅对明确 allowlisted 的纯界面官方 Web UI 插件提供开关：
  `ui-deliverables`、`ui-jobs`、`ui-goal`、`ui-message-feedback`、`ui-model-selection`、`ui-agent-preset`、`ui-skill`、`ui-subagent`、`ui-trajectory`。
  （`ui-commands` 不在 allowlist 中：rc.6 中它的 client half 提供 `commandUi` 服务，被 `ui-conversation`、`ui-model-selection`、`ui-permission-presets` 消费，不是安全的独立 leaf——始终锁定、无开关。）
- **其他官方内置插件默认折叠展示**，全部锁定并标出锁定原因，不提供开关；未知官方 id 使用通用 fallback 文案（不 crash）。
- **Agent Preset 管理的插件明确标识**：`tool-*` / `skill-*` / plan / compaction / subagent 等能力的根 Loader row 顶层 `disabled` 是 Web 官方组合的正常状态（这些能力按 Session 由 Agent Preset 组装），面板统一显示“由 Agent 预设管理”，绝不误导为“功能已关闭”。
- 开关立即生效于 Host 运行时（`entry.update({ disabled })`）并持久化到 profile `cordis.patch.yml`（重启后保持）。
- **已打开的浏览器页面需要刷新才应用开关**（rc.6 真实行为，见 E2E）。切换成功后面板会提示“刷新页面后生效”。

## 它明确不是什么

- **不是插件市场**：不做第三方插件安装 / 卸载 / 更新，不做远程搜索，不做 npm/GitHub 管理；第三方插件的发现与安装请使用社区 plugin marketplace。
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

以下类型永远锁定：loader / Cordis core、modules、connection、api-remotes、client-runtime、cordis-client-runner、ui-theme、locale、ui-layout、ui-sidebar、ui-settings、ui-settings-general、ui-settings-plugins、ui-conversation、ui-input-trigger、ui-tool、ui-commands（服务提供者）、plugin-inventory、api-gateway、webserver、web-runtime、client-hmr、storage / session / workspace 等 Host 基础设施，以及 agent preset plane 的 `tool-*` / `skill-*` / compaction / subagent 等模型能力。未知 id 一律锁定（`unlisted`）。

## 目录与授权的边界（catalog ≠ policy）

- 目录（`src/client/catalog.zh.ts` + `src/client/catalog.ts`）是**纯展示层**：条目没有 `manageable` / `enabled` / `disabled` / `allowToggle` / `policy` 字段；
- 可管理性的唯一来源是 `src/policy.ts` 的 `MANAGEABLE_IDS`；UI 是否显示开关完全由服务端快照的 `manageable` 决定；
- POST 仍由原 server-side allowlist gate 决定；目录中的任何字段都无法让一个 id 变得可开关；
- `PRESET_MANAGED_IDS`（catalog.ts）只是 presentation metadata（“由 Agent 预设管理”的展示语义），绝不参与 POST 授权。

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

版本说明（区分两层，不要混用）：

- **实际运行 / 构建验证**：npm `@deepseek-ai/dsh` **0.1.0-rc.6**（本机 web profile），client 契约与 Loader/webserver 行为均按 rc.6 的已安装包核对。
- **公开源码架构交叉核对**：`deepseek-ai/deepseek-harness` `47f943859bef60e4160492346772ded9b24f765a`（2026-08-13）——该 commit 对应 **rc.5 release** 的源码（仓库内 package.json 版本为 0.1.0-rc.5），不是 rc.6 源码；仅用于核对架构与扩展点存在性，实现细节以 rc.6 已安装包为准。
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
pnpm test          # node --import tsx --test tests/*.spec.ts（policy / patch writer / mutation flow / catalog）
pnpm build         # tsdown → lib/index.js (node ESM) + lib/client.js (browser bundle)
```

安装到 profile 后可用只读方式确认组合：

```sh
dsh --profile web --dump-config   # 或当前等价的只读组合查看方式
```

UI 验证：重启 web 后打开 设置 → 插件 → 内置插件。

### 真实浏览器 E2E（rc.6 实测行为）

在隔离 `DSH_HOME` + 独立 web profile + 独立端口（127.0.0.1:3099）上，用真实 headless Chromium（Playwright）验证。

**v0.1 基线（2026-08，ui-goal toggle 生命周期）：**

| 步骤 | 观测 |
| --- | --- |
| A 初始 | API snapshot：`disabled:false, phase:active, manageable:true`；页面打开 内置开关 tab 显示开关开启；ui-goal client bundle 已挂载（bundle 注入的 `style[data-plugin=…ui-goal]` 存在） |
| B UI 关闭 | 点击开关 → API：`disabled:true, phase:null`（Host 运行时立即 dispose fiber）；tab 快照显示已停用 |
| C 不刷新 | **ui-goal 的 bundle style tag 仍在** → 已打开的页面不会立即卸载 client fiber |
| D 刷新 | tab 显示已停用；style tag 消失（bundle 已从 boot graph 移除） |
| E 再开启 | 真实浏览器 same-origin fetch（过信任围栏）→ 200，`runtime:true, persisted:true` |
| F 不刷新 | style tag 仍不存在 → 已打开的页面不会立即恢复 |
| F2 刷新 | 开关恢复开启，style tag 恢复 |
| G 重启 | 杀掉隔离实例重启 → snapshot 仍为 `disabled:true`（profile patch 持久化生效）；patch 文件为最小 `- id: ui-goal` / `  disabled: true` override，模板注释原样保留 |

**v0.2.0（catalog + 搜索 + preset-managed，2026-08，隔离实例 127.0.0.1:3099 + headless Chromium，实测通过）：**

| 项 | 观测 |
| --- | --- |
| A 加载 | 设置 → 插件 → 内置插件 正常加载；intro 与两个分区渲染；真实 snapshot 133 条 entry |
| B 开关 | 可管理区恰好 9 个 switch（ui-goal 卡片显示中文标题“目标栏”） |
| C 搜索 | “模型”命中 模型选择 / LLM 路由 / 智能标题生成 / 默认模型 等，且过滤掉无关卡片 |
| D 搜索 | “ui-goal”唯一命中“目标栏”；清空查询后锁定区恢复折叠（aria-expanded=false） |
| E ui-commands | 显示中文说明 + 锁定原因（commandUi 消费者依赖），无 switch |
| F preset-managed | tool-bash / tool-web 等根 Loader disabled 行显示“由 Agent 预设管理”（英文 UI 显示 Managed by Agent Preset），绝不显示“已停用”；展开显示统一状态说明 |
| G 生命周期 | ui-goal disable→refresh→开关 OFF 且 bundle style tag 消失；enable→refresh→恢复；profile patch 无残留 disabled:true；全程无 React/页面错误 |
| 未知 id | rc.6 每启动重新生成的 hash 内部行（directory-picker 子行等）走通用 fallback（“未收录说明”+“当前版本暂无补充说明”），不 crash、无 switch |

**结论**：rc.6 中 `entry.update({disabled})` 的运行时效果是 Host 侧立即生效，浏览器需要刷新页面才应用 —— 所以本插件不自己造 HMR，toggle 成功后提示“刷新页面后生效”。（"E2E PASS" 仅指上述可观测事实，非官方 test harness。）

## License

MIT。
