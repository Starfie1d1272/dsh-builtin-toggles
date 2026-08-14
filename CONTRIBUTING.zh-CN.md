# 参与贡献

简体中文 | [English](CONTRIBUTING.md)

感谢你愿意为 dsh-builtin-toggles 贡献代码或内容。

## 项目范围

dsh-builtin-toggles 只做两件事：

1. 用普通人能看懂的语言解释 DeepSeek Harness 官方内置插件；
2. 提供一小组经过明确审查、显式列入 allowlist 的 Web UI 开关。

它明确**不是**：

- 通用插件管理器；
- 插件市场；
- 任意的 Cordis Loader 编辑器；
- Agent 预设编辑器；
- 通用配置编辑器。

除非另有一次独立的设计讨论确定了新方向，否则请把改动控制在这个范围内。

## 开发

代码改动请运行：

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

提交前执行与本次改动相关的检查，例如：

```sh
git diff --check
npm pack --dry-run
```

纯文档改动不需要跑完整的运行时/构建测试。

如果生成的 `lib/` 输出发生变化，它必须与提交的源码构建结果完全一致。

npm 包刻意只包含 package 白名单选中的运行时/包文件；`docs/` 和 CONTRIBUTING 这类文档不需要进入 npm tarball。

## 目录（catalog）贡献

欢迎修正和改进内置插件的：

- 名称；
- 说明；
- 分类；
- 关闭影响；
- 建议；
- 锁定原因；
- 状态说明。

对行为的描述尽量附上证据，优先来自：

1. 当前 DeepSeek Harness 源码；
2. 已安装的 DSH 运行时；
3. 可复现的运行时/浏览器行为。

不要仅凭名字推断安全。

目录只是展示元数据。

目录元数据**禁止**：

- 授予开关权限；
- 修改 MANAGEABLE_IDS；
- 充当授权来源。

未知或理解不充分的条目保持 fail-closed（默认锁定）。

## 修改可管理 allowlist

修改 MANAGEABLE_IDS 属于安全/运行时策略变更，不是普通目录编辑。

**按照当前策略，allowlist 可以收窄，但不能直接扩展。** 如果未来需要扩展，必须先经过独立的架构/设计讨论，并明确修改当前 policy 之后再实施。

如果未来考虑扩展，必须证明候选条目是一个可选的 Web UI / 展示叶子，关闭它不会破坏：

- DSH 核心服务；
- Agent 能力；
- Loader/服务依赖；
- 必要的 Web 基础设施；
- 其他依赖它的内置插件。

此类提案应附带相应证据，例如：

- 依赖与服务消费者审查；
- policy 测试；
- mutation 路径测试；
- fail-closed 测试；
- 适用的隔离运行时/浏览器 E2E。

如果无法有把握地确认安全，条目保持锁定。

## Agent 预设管理的能力

被标记为“由 Agent 预设管理”的条目，不会仅仅因为根 Loader 层显示 disabled 就暴露成 Web profile 开关。

涉及 Agent 能力的改动应保持以下两者的区别：

- Web profile 配置（Web 侧全局配置）；
- 按会话组装的 Agent 预设。

没有单独的架构评审，不要把预设管理的能力变成独立的 Loader 开关。

## Pull requests

保持 PR 聚焦。

避免无关的重构或格式改动。

对用户可见的改动：

- 适用时同步更新英文与简体中文 UI 文案；
- 行为变更要新增或更新测试；
- 说明任何 policy 或运行时行为变更背后的证据。

小的目录/文档修复不需要夹带无关的架构改动。
