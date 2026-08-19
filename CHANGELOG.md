# Changelog

## 0.3.2

### UX / i18n

- Doctor 摘要不再把上游未提供的 `runtime_release_identity_unavailable`
  当作默认健康状态：无结构漂移时改为正向“未发现结构漂移”，运行时身份
  不可用仍保留在机器证据与复制诊断中。
- 每张 capability 卡片不再无条件平铺“未验证”：已审阅宿主行显示“结构未见
  漂移”，Agent 预设显示“不参与基线验证”，外部/未审阅项显示“未审阅”，
  真正漂移/身份不匹配仍显式展示。
- Verification 筛选器改为按快照中实际出现的用户语义派生，不再保留当前
  环境下不可达的固定三态。
- 远程只读提示改为页面级单条横幅；只有“本可修改、仅因远程只读无法执行”
  的条目才在控制附近补充说明，不再用传输限制覆盖真实 policy/eligibility。
- locked 行的默认文案改为简洁锁定原因；完整 eligibility reason /
  limitation 仍保留在展开的机器证据中。
- “仅异常项 = 0” 时显示正向空状态“当前未发现异常项”。
- 中文 locale/catalog 按 DSH 官方产品术语重新对齐：普通 UX 概念使用自然中文；
  Agent 预设、skill、plan mode、Host Loader、Shell、Cordis、Bash、PowerShell
  等沿用上游现有命名；机器 ID、package name 与 raw code 保持原样。
- 展开的机器证据对 `observed / writable / reason / limitation` 等提供
  中文人类解释，同时以括号保留 raw code 供调试。

### Correctness

- Cordis framework/core 条目不按 bare id 提前判 core：通过精确的
  `cordis:*` / Loader service 名称证据识别，第三方借用同名 id 仍显示
  “外部插件”。

### API & compatibility

- Inspection API v1 contract、`MANAGEABLE_IDS`、mutation eligibility
  服务端授权与 fail-closed 行为均未改变。

## 0.3.1

### Correctness

- Fixed a false `duplicate_runtime_id` anomaly for legal Host and Agent
  Preset rows that share the same bare ID: duplicate detection is now scoped
  by composition instead of raw id.
- Added explicit composition-scope modeling (Host vs Agent Preset) so every
  row is evaluated against its own scope.
- Agent Preset rows are locked and ineligible server-side; they no longer
  borrow Host mutation or profile state.

### API & semantics

- Aligned anomalies-only filtering with compatibility semantics.
- Inspection API v1 stays backward compatible: the existing
  `profileOverride` / `profilePersistence` value domains are unchanged, and
  an additive `profileApplicability` field carries the Agent Preset
  not-applicable semantics for new consumers.
- Improved copy-diagnostics feedback with inline copied/failed status.

### Verification

- Added a real rc.6 Host + shipped `standard` Agent Preset smoke covering
  the cross-scope regression, `unverified` compatibility, and 9/9 eligible
  managed UI leaves.
- Added a new Inspector screenshot to the README.

## 0.3.0

### Positioning

- Evolved from a catalog/toggle utility into an evidence-backed built-in
  capability inspector.

### User-facing

- Added Capability Inspector / Doctor, semantic Chinese and English
  presentation, profile-override tri-state, and a clear separation between
  effective state and the Agent Preset plane.
- Added filters, anomaly diagnostics, redacted diagnostic copy, and restore
  inheritance.
- Retained only 9 reviewed, fail-closed UI controls as a narrow adjunct to the
  Inspector.

### Safety & compatibility

- Recorded the reviewed rc.6 baseline/evidence and separated compatibility
  from mutation eligibility.
- Kept the exact allowlist, hardened profile writes with concurrency checks and
  atomic writes, and made configuration mutation loopback-only.
- Added diagnostics redaction and current-public observational drift reporting.

### Integration / release

- Froze Inspection API v1, validated the npm tarball, and tested the package on
  Node 22.19 and 24.
- Added the real rc.6 gate and npm Trusted Publishing preparation.
