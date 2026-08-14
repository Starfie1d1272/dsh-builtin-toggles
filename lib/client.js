window.__ModuleLoader__.load({
	id: "dsh-builtin-toggles",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/catalog.ts
		/**
		* Ids whose root Loader row is disabled by the official Web composition
		* because the capability is assembled per Session via Agent Presets.
		*
		* Display-only metadata: it explains state in the UI and NEVER participates
		* in POST authorization (see policy.ts).
		*/
		const PRESET_MANAGED_IDS = [
			"tool-bash",
			"tool-pwsh",
			"tool-jobs",
			"tool-fs",
			"tool-fs-search",
			"tool-str-replace-editor",
			"skill-filesystem",
			"tool-skill",
			"tool-goal",
			"plan-mode",
			"compaction-basic",
			"command-compact",
			"tool-result-pruner",
			"tool-subagent-control",
			"tool-subagent-list-agents",
			"tool-subagent",
			"tool-subagent-fork",
			"workflow-worker-thread",
			"tool-workflow",
			"tool-ralph",
			"agent-instructions",
			"tool-todo",
			"tool-web"
		];
		/** O(1) presentation-only membership. */
		const PRESET_MANAGED = new Set(PRESET_MANAGED_IDS);
		/** Fallback copy for official ids without a catalog entry yet (spec 4). */
		const UNKNOWN_FALLBACK_SUMMARY = "当前版本暂无补充说明。";
		const UNKNOWN_FALLBACK_LOCK_NOTE = "该条目属于官方内置插件，但尚未收录详细说明，因此保持锁定。";
		/**
		* Resolve one entry from a catalog record, falling back to the generic
		* unknown-id copy — never throws, so the UI cannot crash on an entry the
		* catalog has not documented yet. The bound convenience wrapper
		* getBuiltinCatalogEntry(id, moduleName) lives in the locale data module
		* (catalog.zh.ts today; catalog.en.ts can bind the same helper later).
		*
		* @param catalog    the display-only catalog record (keyed by loader id)
		* @param id         loader short id (e.g. ui-goal)
		* @param moduleName module/package name (e.g. @deepseek-ai/dsh-client-ui-goal)
		*/
		function resolveCatalogEntry(catalog, id, moduleName) {
			const known = catalog[id];
			if (known !== void 0) return known;
			return {
				title: moduleShortName(moduleName),
				summary: UNKNOWN_FALLBACK_SUMMARY,
				category: "系统基础",
				lockNote: UNKNOWN_FALLBACK_LOCK_NOTE,
				unknown: true
			};
		}
		/** Derive the short package name, e.g. @deepseek-ai/dsh-client-ui-goal → dsh-client-ui-goal. */
		function moduleShortName(moduleName) {
			const trimmed = moduleName.trim();
			const slash = trimmed.lastIndexOf("/");
			return slash >= 0 ? trimmed.slice(slash + 1) : trimmed;
		}
		/** Normalize a search query / haystack: trim + case-fold (ids are ASCII). */
		function normalizeSearch(input) {
			return input.trim().toLowerCase();
		}
		/**
		* Local, in-memory matcher: title / summary / loader id / module name.
		* Empty or whitespace query matches everything (restores collapsed state).
		*/
		function matchesSearch(query, target) {
			const q = normalizeSearch(query);
			if (q === "") return true;
			return normalizeSearch([
				target.title,
				target.summary,
				target.id,
				target.moduleName
			].join(" ")).includes(q);
		}
		//#endregion
		//#region src/client/catalog.zh.ts
		/**
		* 官方内置插件中文目录（Chinese-first catalog）。
		*
		* 本轮以中文用户为第一目标；英文完整 catalog 后续版本再补（预留
		* catalog.en.ts 结构）。本文件只做展示，绝不参与授权：
		* - 没有 manageable / enabled / disabled / allowToggle / policy 字段；
		* - 开关是否出现完全由服务端快照的 `manageable` 决定；
		* - PRESET_MANAGED_IDS 的展示语义见 catalog.ts。
		*
		* 文案来源：v0.2.0 规格文档整理的中文说明（按本机 rc.6 实际 Loader 核对）。
		*/
		/** 由 Agent Preset 管理的能力：统一状态说明（展示专用）。 */
		const PRESET_STATUS = "Web 顶层停用是正常状态；实际是否可用由当前会话的 Agent 预设决定。";
		const PRESET_LOCK = "该能力属于 Agent 组装，不由全局内置插件面板开关。";
		/** 生成一条 preset-managed 条目。 */
		function presetManaged(title, summary, category) {
			return {
				title,
				summary,
				category,
				presetManaged: true,
				statusNote: PRESET_STATUS,
				lockNote: PRESET_LOCK
			};
		}
		const zhCatalog = {
			"ui-deliverables": {
				title: "产出文件",
				summary: "在助手回复下方列出本轮创建或修改的文件，并把可识别的文件引用变成可点击链接。",
				category: "界面功能",
				impact: "不再显示产出文件行和文件链接；相关的最终回复文件引用提示也会移除。",
				recommendation: "如果经常让 Agent 创建或修改文件，建议保持开启。"
			},
			"ui-jobs": {
				title: "后台任务列表",
				summary: "会话存在后台任务时，在页头显示任务状态、详情和运行耗时。",
				category: "界面功能",
				impact: "后台任务仍可运行，但 Web 页头不再显示任务列表。",
				recommendation: "使用后台命令或后台子代理时建议开启。"
			},
			"ui-goal": {
				title: "目标栏",
				summary: "在输入区显示当前 Goal，可编辑、暂停、恢复或清除；Goal 仍通过 /goal 创建。",
				category: "界面功能",
				impact: "Goal 本身和 /goal 命令仍然存在，但 Web 中不再显示目标栏。",
				recommendation: "不使用 Goal 工作流时可以关闭。"
			},
			"ui-message-feedback": {
				title: "消息反馈",
				summary: "在已完成的助手回复上显示赞、踩和可选备注。",
				category: "界面功能",
				impact: "只移除反馈控件，不影响对话内容，也不会改变模型上下文。",
				recommendation: "不需要给回复做人工反馈时可以关闭。"
			},
			"ui-model-selection": {
				title: "模型选择",
				summary: "提供 /model 和输入区的模型、推理强度选择入口。",
				category: "界面功能",
				impact: "已配置的模型路由仍可工作，但 Web 中失去模型和推理强度选择界面。",
				recommendation: "需要在 Web 中切换模型时保持开启。"
			},
			"ui-agent-preset": {
				title: "Agent 预设",
				summary: "选择新会话使用的 Agent 预设，并查看和管理预设列表；已经开始的会话不会被实时切换。",
				category: "界面功能",
				impact: "Agent Preset 系统仍存在，但 Web 中失去新会话预设选择、预设标签和管理界面。",
				recommendation: "使用 Standard、Code、Minimal、Cordis 或自定义预设时建议保持开启。"
			},
			"ui-skill": {
				title: "Skill 入口",
				summary: "把可用 Skill 加入 / 输入菜单，并为 Skill 工具调用提供专用展示。",
				category: "界面功能",
				impact: "Host 的 Skill 能力仍可存在，但 Web 中失去 Skill 菜单入口和专用工具行显示。",
				recommendation: "经常手动调用 Skill 时建议开启。"
			},
			"ui-subagent": {
				title: "子代理界面",
				summary: "在会话页头显示子代理树、进入子会话，并提供 @ 子代理引用入口。",
				category: "界面功能",
				impact: "Host 的子代理能力仍可运行，但 Web 中失去子代理目录、导航和引用界面。",
				recommendation: "使用 subagent 时建议开启。"
			},
			"ui-trajectory": {
				title: "执行轨迹",
				summary: "按轮次查看用户、助手和工具事件，并检查 token、耗时、输入与输出。",
				category: "界面功能",
				impact: "对话和 Agent 执行不受影响，只移除 Trajectory 调试与分析视图。",
				recommendation: "日常不查看执行细节时可以关闭。"
			},
			"ui-theme": {
				title: "主题系统",
				summary: "提供 Web 界面的颜色、深浅色和统一视觉基础。",
				category: "系统基础",
				lockNote: "整个 Web 界面依赖这套主题基础。"
			},
			locale: {
				title: "语言系统",
				summary: "提供 Web 界面的语言选择和本地化文案。",
				category: "系统基础",
				lockNote: "其他界面依赖它获取当前语言和文本。"
			},
			"ui-layout": {
				title: "页面布局",
				summary: "负责 Web 主页面各区域的整体布局。",
				category: "系统基础",
				lockNote: "关闭会破坏页面骨架。"
			},
			"ui-sidebar": {
				title: "侧边栏框架",
				summary: "提供左侧导航和侧边区域的基础容器。",
				category: "系统基础",
				lockNote: "Workspace、Session 等界面会向其中挂载内容。"
			},
			"ui-settings": {
				title: "设置框架",
				summary: "提供 Settings 页面、设置分区和插件标签页。",
				category: "系统基础",
				lockNote: "本插件自身也运行在这套设置框架中。"
			},
			"ui-settings-general": {
				title: "通用设置",
				summary: "提供语言和其他通用偏好设置页面。",
				category: "界面功能",
				lockNote: "属于官方设置体系的一部分。"
			},
			"ui-settings-models": {
				title: "模型设置",
				summary: "提供模型提供方、模型和凭据相关的设置界面。",
				category: "模型与 Agent",
				lockNote: "它连接模型路由与设置服务，不作为纯展示插件开放关闭。"
			},
			"ui-settings-plugin-inventory": {
				title: "官方插件列表",
				summary: "DSH 自带的只读插件清单，可搜索并查看 Loader 条目的状态和配置。",
				category: "界面功能",
				lockNote: "这是官方的插件状态查看器，保持只读和稳定。"
			},
			"ui-settings-plugins": {
				title: "插件配置",
				summary: "显示 Host 插件主动暴露给用户的可配置项。",
				category: "界面功能",
				lockNote: "它是插件配置的基础页面，不是单一装饰功能。"
			},
			"ui-conversation": {
				title: "对话界面核心",
				summary: "负责聊天记录、输入框、消息渲染和主要会话交互。",
				category: "系统基础",
				lockNote: "这是 Web 对话核心，许多其他 UI 插件依赖它。"
			},
			"ui-input-trigger": {
				title: "输入触发器",
				summary: "提供 /、@ 等输入触发和候选菜单的基础管线。",
				category: "系统基础",
				lockNote: "命令、Skill 和子代理等输入入口依赖它。"
			},
			"ui-commands": {
				title: "命令界面",
				summary: "提供 / 命令目录、命令弹窗和其他界面使用的 commandUi 服务。",
				category: "系统基础",
				lockNote: "模型选择、权限界面和对话核心等功能依赖它，不能作为独立界面关闭。"
			},
			"ui-permission": {
				title: "权限控制界面",
				summary: "提供默认权限预设以及当前会话的 /permission 选择界面。",
				category: "安全与权限",
				lockNote: "它会改变沙箱和审批策略，并依赖命令服务，属于安全关键界面。"
			},
			"ui-plan": {
				title: "Plan 模式界面",
				summary: "Plan 模式启用后，在输入区显示状态控件，并提供退出入口。",
				category: "模型与 Agent",
				lockNote: "它对应会影响模型行为的 Plan policy，不作为普通视觉装饰开放关闭。"
			},
			"ui-user-questions": {
				title: "用户问答与审批",
				summary: "显示 Agent 发起的问题、选择题，以及 Plan 审阅等等待用户决定的卡片。",
				category: "安全与权限",
				lockNote: "这是 Agent 等待用户回答或批准的重要交互通道。"
			},
			"ui-workspace": {
				title: "工作区与会话浏览",
				summary: "在侧边栏浏览和管理 Workspace、Session，并提供搜索、排序、重命名和归档等界面。",
				category: "界面功能",
				lockNote: "属于工作区和会话导航核心。"
			},
			"ui-tool": {
				title: "工具调用界面",
				summary: "负责聊天中工具调用的通用展示，并承载各种专用工具视图。",
				category: "系统基础",
				lockNote: "大量工具结果界面依赖这套渲染基础。"
			},
			"ui-cordis": {
				title: "Cordis 工具视图",
				summary: "为 Cordis 相关工具调用提供专用的结果展示。",
				category: "界面功能",
				lockNote: "依赖工具调用基础界面，当前保持锁定。"
			},
			"ui-workflow-run": {
				title: "Workflow 运行视图",
				summary: "把持久 Workflow 的运行过程显示为聊天中的独立节点。",
				category: "界面功能",
				lockNote: "与 Workflow 生命周期和会话投影相连，当前未作为安全叶子开放。"
			},
			modules: {
				title: "客户端模块加载",
				summary: "扫描并向浏览器提供各个 client 插件，组成 Web 的启动模块表。",
				category: "系统基础",
				lockNote: "所有浏览器插件都依赖它加载。"
			},
			connection: {
				title: "浏览器连接",
				summary: "负责浏览器与 DSH Host 之间的 API 和事件流连接。",
				category: "系统基础",
				lockNote: "关闭后 Web 无法正常与 Host 通信。"
			},
			"api-remotes": {
				title: "浏览器 Remote API",
				summary: "把 Host 提供的类型化远程接口交给浏览器插件使用。",
				category: "系统基础",
				lockNote: "大量 UI 与 Host 的交互依赖它。"
			},
			"client-runtime": {
				title: "客户端运行时",
				summary: "维护浏览器中的 Session、事件流和各类实时状态。",
				category: "系统基础",
				lockNote: "会话界面依赖的核心状态层。"
			},
			"cordis-client-runner": {
				title: "Cordis 客户端运行器",
				summary: "在浏览器中承载 Cordis client 插件及其协作机制。",
				category: "系统基础",
				lockNote: "属于客户端插件系统基础。"
			},
			"client-hmr": {
				title: "客户端热更新",
				summary: "开发时监听 client bundle 重建并重新加载浏览器插件。",
				category: "系统基础",
				lockNote: "属于开发和运行基础，不作为用户功能开关。"
			},
			"plugin-inventory": {
				title: "插件清单服务",
				summary: "Host 侧提供当前 Loader 条目和运行状态的只读快照。",
				category: "系统基础",
				lockNote: "官方插件列表和本插件的诊断都依赖这类清单能力。"
			},
			"directory-picker": {
				title: "目录选择",
				summary: "根据本机或远程部署环境选择合适的文件夹选择方式。",
				category: "界面功能",
				lockNote: "添加 Workspace 等流程依赖它。"
			},
			webserver: {
				title: "Web 服务器",
				summary: "承载 DSH Web 页面和 HTTP API。",
				category: "系统基础",
				lockNote: "关闭会直接失去 Web 服务。"
			},
			"web-runtime": {
				title: "Web 运行层",
				summary: "连接前端静态页面、部署环境和 Web 运行上下文。",
				category: "系统基础",
				lockNote: "属于整个 Web 部署的核心。"
			},
			"web-startup": {
				title: "Web 启动参数",
				summary: "解析 Web 启动时的地址、端口和 trusted-host 等参数。",
				category: "系统基础",
				lockNote: "Web 运行层依赖这些启动信息。"
			},
			"api-gateway": {
				title: "API 网关",
				summary: "Host 侧统一分发浏览器发来的业务 API 调用。",
				category: "系统基础",
				lockNote: "客户端与 Host 的业务通信依赖它。"
			},
			"cordis-host-runner": {
				title: "Cordis Host 运行器",
				summary: "承载 Host 侧的 Cordis 插件运行能力。",
				category: "系统基础",
				lockNote: "属于 Host 插件运行基础。"
			},
			"code-runtime": {
				title: "代码执行运行时",
				summary: "提供基于 worker thread 的代码运行环境，供程序化执行功能使用。",
				category: "工具与执行",
				lockNote: "属于执行基础设施，不是纯界面功能。"
			},
			storage: {
				title: "存储接口",
				summary: "为 DSH 各类状态提供统一的持久化存储接口。",
				category: "会话与数据",
				lockNote: "多个领域服务依赖这层存储抽象。"
			},
			"storage-json": {
				title: "JSON 存储后端",
				summary: "把通用存储内容保存为 DSH_HOME 下的 JSON 数据。",
				category: "会话与数据",
				lockNote: "属于具体持久化后端。"
			},
			"storage-domain": {
				title: "领域存储绑定",
				summary: "把 DSH 的领域状态连接到当前存储后端。",
				category: "会话与数据",
				lockNote: "属于数据持久化基础。"
			},
			"message-feedback": {
				title: "消息反馈服务",
				summary: "Host 侧保存赞、踩和备注，并处理并发版本冲突。",
				category: "会话与数据",
				lockNote: "这是消息反馈 UI 背后的数据服务。"
			},
			"session-log-download": {
				title: "会话导出",
				summary: "提供 /export 和浏览器下载会话日志的能力。",
				category: "会话与数据",
				lockNote: "与会话日志和命令系统相连，当前未审计为纯界面叶子。"
			},
			workspace: {
				title: "Workspace 服务",
				summary: "Host 侧维护 Workspace、Session 归属及相关操作。",
				category: "会话与数据",
				lockNote: "工作区界面的核心数据服务。"
			},
			"session-projection-cache": {
				title: "会话投影缓存",
				summary: "缓存由会话日志计算出的界面和功能状态，减少重复重放。",
				category: "会话与数据",
				lockNote: "属于会话数据基础设施。"
			},
			"session-stats": {
				title: "会话统计",
				summary: "计算整个会话的轮次、步骤等统计信息。",
				category: "会话与数据",
				lockNote: "属于会话投影服务，而不是单一界面。"
			},
			llm: {
				title: "LLM 路由",
				summary: "统一登记模型提供方和模型调用路由。",
				category: "模型与 Agent",
				lockNote: "所有模型调用都依赖它。"
			},
			"llm-deepseek": {
				title: "DeepSeek 模型适配器",
				summary: "连接 DeepSeek 模型接口；API Key 和端点从设置与凭据系统读取。",
				category: "模型与 Agent",
				lockNote: "属于模型执行路径核心。"
			},
			"llm-pi-ai": {
				title: "多提供方模型适配器",
				summary: "按用户设置动态接入额外模型提供方；没有配置时可以保持空闲。",
				category: "模型与 Agent",
				lockNote: "属于模型路由服务，不是界面叶子。"
			},
			"llm-retry": {
				title: "模型请求重试",
				summary: "为模型请求提供统一的失败重试策略。",
				category: "模型与 Agent",
				lockNote: "直接影响模型调用可靠性。"
			},
			"token-meter": {
				title: "Token 计量",
				summary: "记录模型上下文和 token 使用，为压缩等策略提供依据。",
				category: "模型与 Agent",
				lockNote: "多个 Agent 策略会依赖这些数据。"
			},
			session: {
				title: "会话核心",
				summary: "维护 Session 的事件记录、生命周期和核心状态。",
				category: "会话与数据",
				lockNote: "对话历史和 Agent 执行都依赖它。"
			},
			"session-title": {
				title: "会话标题",
				summary: "负责会话标题及标题生成失败时的回退规则。",
				category: "会话与数据",
				lockNote: "属于会话元数据服务。"
			},
			"session-title-llm": {
				title: "智能标题生成",
				summary: "根据会话开头内容调用模型生成简短标题。",
				category: "模型与 Agent",
				lockNote: "属于标题生成链路。"
			},
			"session-persistence-jsonl": {
				title: "会话持久化",
				summary: "把会话事件以 JSONL 形式保存到 DSH_HOME/sessions。",
				category: "会话与数据",
				lockNote: "这是历史数据持久化核心。"
			},
			"attachment-local": {
				title: "附件存储",
				summary: "在本机保存会话图片和附件，并通过内容地址供消息引用。",
				category: "会话与数据",
				lockNote: "属于附件数据基础设施。"
			},
			"session-query-sqlite": {
				title: "会话查询索引",
				summary: "提供会话读取、标题和谱系查询；全文内容搜索默认不开启。",
				category: "会话与数据",
				lockNote: "导出和谱系等功能仍依赖它；不要把‘全文搜索未开启’理解为插件无用。"
			},
			"session-projection": {
				title: "会话投影",
				summary: "把追加式会话历史计算成 UI 和功能需要的当前状态。",
				category: "会话与数据",
				lockNote: "许多 Host 和 Web 功能都依赖这些派生状态。"
			},
			"session-telemetry-otel": {
				title: "会话遥测",
				summary: "按部署配置把会话遥测通过 OTLP 导出；官方默认模式为关闭。",
				category: "会话与数据",
				lockNote: "遥测启用属于部署和隐私策略，不由这个面板作为普通插件开关管理。"
			},
			"session-checkpoint-policy": {
				title: "会话检查点",
				summary: "在关键执行边界保存检查点，提高中断后的可恢复性。",
				category: "会话与数据",
				lockNote: "属于可靠性基础设施。"
			},
			agent: {
				title: "Agent 核心",
				summary: "维护 Agent 实例、会话绑定和执行生命周期。",
				category: "模型与 Agent",
				lockNote: "Agent 运行核心。"
			},
			"agent-loop": {
				title: "Agent 执行循环",
				summary: "负责模型调用、工具执行和下一步模型调用之间的主循环。",
				category: "模型与 Agent",
				lockNote: "这是 Agent 执行核心。"
			},
			"agent-default-model": {
				title: "默认模型",
				summary: "定义新 Agent 或会话默认使用的模型提供方和模型。",
				category: "模型与 Agent",
				lockNote: "属于会话创建路径。"
			},
			"system-prompt": {
				title: "系统提示词组装",
				summary: "组合 Harness 身份、部署 persona 和各功能加入的系统提示词。",
				category: "模型与 Agent",
				lockNote: "会直接改变模型看到的上下文。"
			},
			settings: {
				title: "设置文件",
				summary: "读取和更新 DSH_HOME/settings.yaml，模型页等设置会写入这里。",
				category: "系统基础",
				lockNote: "用户配置体系依赖它。"
			},
			credentials: {
				title: "凭据管理",
				summary: "从受管凭据文件、环境变量和 .env 等来源解析 API Key 等机密信息。",
				category: "安全与权限",
				lockNote: "属于密钥和凭据基础设施。"
			},
			"user-questions": {
				title: "用户问答服务",
				summary: "Host 侧维护 Agent 向用户提问并等待回答的请求。",
				category: "安全与权限",
				lockNote: "用户问答 UI 和 Agent 提问能力依赖它。"
			},
			jobs: {
				title: "后台任务注册表",
				summary: "登记后台任务及其状态，并按 Agent 和 Session 提供查询。",
				category: "工具与执行",
				lockNote: "后台执行工具和后台任务 UI 都依赖它。"
			},
			subagent: {
				title: "子代理注册表",
				summary: "维护子代理的谱系、状态和继续交互能力。",
				category: "模型与 Agent",
				lockNote: "Host、Web 和子代理工具共同依赖它。"
			},
			"subagent-spawn-in-process": {
				title: "Spawn 子代理后端",
				summary: "在当前 DSH 进程中创建新的子代理会话。",
				category: "模型与 Agent",
				lockNote: "属于 Agent delegation 执行后端。"
			},
			"subagent-fork-in-process": {
				title: "Fork 子代理后端",
				summary: "从父会话历史 fork 一个一次性的子代理执行。",
				category: "模型与 Agent",
				lockNote: "属于 Agent delegation 执行后端。"
			},
			"agent-presets": {
				title: "Agent 预设目录",
				summary: "扫描系统和用户预设，并决定新会话默认采用哪套 Agent 组装；Web 默认使用 standard。",
				category: "模型与 Agent",
				lockNote: "Preset 决定每个会话拥有哪些模型能力和工具，不能当普通插件开关。"
			},
			commands: {
				title: "命令注册表",
				summary: "Host 侧登记并执行 /goal、/permission、/compact 等命令。",
				category: "系统基础",
				lockNote: "多个 Web 和 Agent 功能依赖统一命令系统。"
			},
			"command-feedback": {
				title: "反馈命令",
				summary: "注册与反馈流程相关的 Host 命令入口。",
				category: "会话与数据",
				lockNote: "属于 Host 命令体系。"
			},
			goal: {
				title: "Goal 服务",
				summary: "持久保存并维护当前会话的 Goal 状态。",
				category: "模型与 Agent",
				lockNote: "Goal 命令、Agent 和 Web 目标栏共同依赖它。"
			},
			"goal-round-driver": {
				title: "Goal 轮次驱动",
				summary: "把持久 Goal 接入同一会话后续的 Agent 执行过程。",
				category: "模型与 Agent",
				lockNote: "属于 Goal 执行语义，而不是界面装饰。"
			},
			"command-goal": {
				title: "Goal 命令",
				summary: "提供 /goal 命令，用来创建和管理会话目标。",
				category: "模型与 Agent",
				lockNote: "Goal 工作流依赖这个 Host 命令入口。"
			},
			approval: {
				title: "用户审批",
				summary: "决定工具操作何时需要用户确认，并承接审批流程。",
				category: "安全与权限",
				lockNote: "这是执行安全边界的一部分。"
			},
			permission: {
				title: "权限预设",
				summary: "定义只读、工作区可写和完全访问等沙箱与审批组合。",
				category: "安全与权限",
				lockNote: "直接决定工具能做什么，属于安全策略核心。"
			},
			sandbox: {
				title: "沙箱服务",
				summary: "为文件和进程操作提供统一的本机安全边界。",
				category: "安全与权限",
				lockNote: "执行安全依赖它。"
			},
			"sandbox-policy": {
				title: "沙箱策略",
				summary: "根据当前权限模式和 Workspace 决定允许访问和写入的范围。",
				category: "安全与权限",
				lockNote: "属于执行权限核心。"
			},
			"bash-sandbox": {
				title: "Bash 沙箱",
				summary: "在 macOS/Linux 等非 Windows 平台提供受限制的 Shell 执行环境。",
				category: "安全与权限",
				statusNote: "按操作系统自动选择；在 Windows 上显示停用是正常现象。",
				lockNote: "平台执行和沙箱安全依赖它。"
			},
			"pwsh-sandbox": {
				title: "PowerShell 沙箱",
				summary: "在 Windows 上提供受限制的 PowerShell 执行环境。",
				category: "安全与权限",
				statusNote: "按操作系统自动选择；在非 Windows 平台显示停用是正常现象。",
				lockNote: "平台执行和沙箱安全依赖它。"
			},
			subprocess: {
				title: "子进程执行",
				summary: "Host 侧统一启动和管理本地子进程。",
				category: "工具与执行",
				lockNote: "多个执行类工具依赖它。"
			},
			"shell-env": {
				title: "Shell 环境",
				summary: "向 Shell 工具提供 DSH 运行环境和必要的上下文变量。",
				category: "工具与执行",
				lockNote: "属于 Shell 执行基础。"
			},
			"fs-sandbox": {
				title: "沙箱文件系统",
				summary: "把文件系统操作限制在当前沙箱和 Workspace 策略允许的范围内。",
				category: "安全与权限",
				lockNote: "文件操作安全依赖它。"
			},
			"fs-observation-policy": {
				title: "文件读取展示策略",
				summary: "控制文件读取和搜索结果如何稳定地交给 Agent。",
				category: "工具与执行",
				lockNote: "属于文件工具执行链路。"
			},
			tools: {
				title: "工具注册表",
				summary: "登记当前 Agent 可以看到的工具，并控制工具的呈现方式。",
				category: "模型与 Agent",
				lockNote: "模型工具目录的核心。"
			},
			"timeout-policy": {
				title: "工具超时策略",
				summary: "为不同工具调用提供统一的超时规则。",
				category: "工具与执行",
				lockNote: "执行可靠性依赖它。"
			},
			"spill-local": {
				title: "大结果落盘",
				summary: "把不适合直接内联的超大工具结果保存到本地。",
				category: "会话与数据",
				lockNote: "属于工具结果存储基础。"
			},
			"spill-policy": {
				title: "大结果策略",
				summary: "决定工具结果超过多大时改用本地 spill 引用。",
				category: "会话与数据",
				lockNote: "用于控制上下文大小和结果可靠性。"
			},
			"repeat-tool-reminder": {
				title: "重复调用提醒",
				summary: "当 Agent 连续重复相似工具调用时加入提醒，减少无效循环。",
				category: "模型与 Agent",
				lockNote: "会直接影响 Agent 的后续行为。"
			},
			web: {
				title: "Web 能力",
				summary: "登记 Web 搜索能力和当前使用的搜索提供方。",
				category: "工具与执行",
				lockNote: "属于 Agent Web 工具的 Host 服务。"
			},
			"web-search-deepseek": {
				title: "DeepSeek Web 搜索",
				summary: "使用 DeepSeek 的搜索接口作为默认 Web 搜索后端。",
				category: "工具与执行",
				lockNote: "属于搜索服务后端。"
			},
			typert: {
				title: "Typed RPC 注册表",
				summary: "登记 DSH 内部 Host 与客户端之间的类型化远程接口。",
				category: "系统基础",
				lockNote: "属于内部通信基础。"
			},
			"typert-loader": {
				title: "RPC 协议加载",
				summary: "加载并连接 DSH 的类型化远程接口定义。",
				category: "系统基础",
				lockNote: "属于内部通信基础。"
			},
			"typert-gateway": {
				title: "Typed API 网关",
				summary: "负责在传输层分发类型化 RPC 调用。",
				category: "系统基础",
				lockNote: "属于内部通信核心。"
			},
			timer: {
				title: "定时器服务",
				summary: "提供 Cordis 插件使用的定时和周期任务基础能力。",
				category: "系统基础",
				lockNote: "属于基础运行服务。"
			},
			hmr: {
				title: "配置热重载",
				summary: "用于 Cordis 配置的热重载。",
				category: "系统基础",
				statusNote: "官方 Web 当前明确关闭这项能力；显示停用是正常状态。",
				lockNote: "不要通过本面板强行开启。"
			},
			"tool-bash": presetManaged("Bash 工具", "让 Agent 在 macOS/Linux 等环境执行 Shell 命令。", "工具与执行"),
			"tool-pwsh": presetManaged("PowerShell 工具", "让 Agent 在 Windows 环境执行 PowerShell 命令。", "工具与执行"),
			"tool-jobs": presetManaged("后台任务工具", "让 Agent 查询和管理后台任务。", "工具与执行"),
			"tool-fs": presetManaged("文件系统工具", "让 Agent 读取、写入和管理文件。", "工具与执行"),
			"tool-fs-search": presetManaged("文件搜索工具", "让 Agent 搜索文件、目录和内容。", "工具与执行"),
			"tool-str-replace-editor": presetManaged("文本编辑工具", "提供结构化的文件查看、替换和插入编辑。", "工具与执行"),
			"skill-filesystem": presetManaged("本地 Skill 发现", "从文件系统发现并注册当前 Agent 可用的 Skill。", "模型与 Agent"),
			"tool-skill": presetManaged("Skill 工具", "让 Agent 查看和加载 Skill，并处理用户显式调用的 Skill。", "模型与 Agent"),
			"tool-goal": presetManaged("Goal 工具", "让 Agent 读取和更新持久化的会话 Goal。", "模型与 Agent"),
			"plan-mode": presetManaged("Plan 模式", "为 Agent 提供规划模式、退出工具和对应的规划规则。", "模型与 Agent"),
			"compaction-basic": presetManaged("上下文压缩", "上下文过长时生成压缩摘要，为后续模型请求腾出空间。", "模型与 Agent"),
			"command-compact": presetManaged("手动压缩命令", "提供 /compact，让用户主动触发一次上下文压缩。", "模型与 Agent"),
			"tool-result-pruner": presetManaged("工具结果裁剪", "在整体压缩之前先缩减过大的工具结果，同时保留头尾关键信息。", "模型与 Agent"),
			"tool-subagent-control": presetManaged("子代理控制", "为可继续子代理提供继续交互和控制通道。", "模型与 Agent"),
			"tool-subagent-list-agents": presetManaged("子代理列表工具", "让 Agent 查看可用和已创建的子代理。", "模型与 Agent"),
			"tool-subagent": presetManaged("创建子代理", "让 Agent 创建一个可继续交互的 Spawn 子代理。", "模型与 Agent"),
			"tool-subagent-fork": presetManaged("Fork 子代理", "让 Agent 从当前历史 fork 一个一次性子代理。", "模型与 Agent"),
			"workflow-worker-thread": presetManaged("Workflow 执行后端", "在线程工作器中执行持久 Workflow。", "工具与执行"),
			"tool-workflow": presetManaged("Workflow 工具", "让 Agent 启动和管理 Workflow。", "工具与执行"),
			"tool-ralph": presetManaged("Ralph 迭代工具", "按固定流程反复启动新的 Agent 轮次，用于多轮迭代执行。", "工具与执行"),
			"agent-instructions": presetManaged("工作区指令", "为 Agent 自动加载 AGENTS.md、CLAUDE.md 等工作区指令。", "模型与 Agent"),
			"tool-todo": presetManaged("Todo 工具", "让 Agent 维护任务清单和执行状态。", "模型与 Agent"),
			"tool-web": presetManaged("Web 搜索工具", "让 Agent 使用 web_search；官方默认组合只开放搜索，不开放任意 URL fetch。", "工具与执行"),
			skill: {
				title: "Skill 注册表",
				summary: "维护可用 Skill 目录，并把系统、用户和预设提供的 Skill 合并给当前 Agent。",
				category: "模型与 Agent",
				lockNote: "属于 Skill 基础服务。"
			},
			"skill-badge": {
				title: "Skill 标记",
				summary: "提供 Skill 相关的辅助标记能力。",
				category: "模型与 Agent",
				statusNote: "官方 base 当前默认停用。",
				lockNote: "保持官方默认状态。"
			},
			"tool-subagent-report": {
				title: "子代理回报通道",
				summary: "为可继续子代理提供向父 Agent 回报结果的通道。",
				category: "模型与 Agent",
				lockNote: "它需要保持 Host 层单例，不能按普通插件随意开关。"
			},
			loader: {
				title: "插件加载器",
				summary: "负责加载和管理整个 Cordis/DSH 插件树。",
				category: "系统基础",
				lockNote: "属于系统基础，保持锁定。"
			},
			include: {
				title: "配置包含",
				summary: "配置树内部用于组合其他配置的节点。",
				category: "系统基础",
				lockNote: "属于系统基础，保持锁定。"
			},
			group: {
				title: "配置分组",
				summary: "配置树内部用于组织插件条目的分组节点。",
				category: "系统基础",
				lockNote: "属于系统基础，保持锁定。"
			}
		};
		/** 按 Loader id 查询中文条目；未知官方 id 返回通用 fallback（不 crash）。 */
		function getBuiltinCatalogEntry(id, moduleName) {
			return resolveCatalogEntry(zhCatalog, id, moduleName);
		}
		//#endregion
		//#region src/client/BuiltinTogglesTab.tsx
		/**
		* Built-ins tab: Settings → Plugins → Built-ins (内置插件).
		*
		* v0.2.0 — an official built-in plugin CATALOG plus the small allowlisted
		* toggle set:
		*
		* - Section A (可管理) lists the manageable allowlisted entries with a real
		*   switch. Section B (其他内置插件) lists every other official built-in as
		*   locked rows (collapsed by default) so users can see why most built-ins
		*   cannot be turned off.
		* - Every row is annotated from the display-only catalog (catalog.zh.ts):
		*   Chinese title, one-sentence summary, category tag, and — on request —
		*   the impact/recommendation for manageable rows or the lock/status note
		*   for locked rows. Preset-managed rows (tool-*, plan-mode, …) show the
		*   "由 Agent 预设管理" tag and a status note instead of a misleading
		*   "已停用" label.
		* - A local search box filters title / summary / loader id / package name;
		*   it never hits the network.
		*
		* SECURITY: manageability comes ONLY from the server snapshot
		* (the `manageable` field, from policy.ts). The catalog never carries
		* an authorization field, and a locked row never renders a switch. The server
		* re-checks every rule on every POST; hiding a button is never a security
		* boundary.
		*
		* The server is the authority: after every toggle the snapshot is re-read,
		* and failures re-read it too instead of trusting optimistic local state.
		* Mutations are serialized — only one toggle request runs at a time.
		*/
		const API = "/api/builtin-toggles";
		const sectionStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 14,
			width: "100%",
			maxWidth: 760,
			color: "var(--dsw-alias-label-primary)"
		};
		const headingStyle = {
			margin: 0,
			fontSize: 15,
			lineHeight: "22px",
			fontWeight: 600,
			color: "var(--dsw-alias-label-primary)"
		};
		const introStyle = {
			margin: 0,
			fontSize: 13,
			lineHeight: "20px",
			color: "var(--dsw-alias-label-tertiary)"
		};
		const statusLineStyle = {
			margin: 0,
			fontSize: 13,
			lineHeight: "20px",
			color: "var(--dsw-alias-label-tertiary)"
		};
		const errorStyle = {
			margin: 0,
			fontSize: 13,
			lineHeight: "20px",
			color: "var(--dsw-alias-state-error-primary)"
		};
		const retryButtonStyle = {
			border: "1px solid var(--dsw-alias-border-l2)",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit",
			cursor: "pointer",
			background: "transparent",
			borderRadius: 6,
			padding: "4px 10px",
			fontSize: 13
		};
		const searchInputStyle = {
			width: "100%",
			boxSizing: "border-box",
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 8,
			background: "var(--dsw-alias-bg-layer-1)",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit",
			fontSize: 13,
			lineHeight: "20px",
			padding: "7px 10px",
			outline: "none"
		};
		const blockStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 10,
			margin: 0,
			padding: 0,
			listStyle: "none"
		};
		const cardStyle = {
			border: "1px solid var(--dsw-alias-border-l2)",
			background: "var(--dsw-alias-bg-layer-3)",
			borderRadius: 10,
			padding: "12px 14px",
			display: "flex",
			flexDirection: "column",
			gap: 0
		};
		const cardRowStyle = {
			display: "flex",
			alignItems: "center",
			gap: 12
		};
		const cardMainStyle = {
			flex: 1,
			minWidth: 0,
			display: "flex",
			flexDirection: "column",
			gap: 3
		};
		const titleLineStyle = {
			display: "flex",
			alignItems: "center",
			gap: 8,
			minWidth: 0
		};
		const titleStyle = {
			margin: 0,
			fontSize: 14,
			lineHeight: "20px",
			fontWeight: 600,
			color: "var(--dsw-alias-label-primary)",
			overflowWrap: "anywhere"
		};
		const idStyle = {
			margin: 0,
			fontSize: 11,
			lineHeight: "16px",
			color: "var(--dsw-alias-label-tertiary)",
			fontFamily: "var(--ds-font-family-code)",
			overflowWrap: "anywhere"
		};
		const descStyle = {
			margin: 0,
			fontSize: 12,
			lineHeight: "18px",
			color: "var(--dsw-alias-label-secondary)"
		};
		const tagBaseStyle = {
			borderRadius: 5,
			padding: "1px 6px",
			fontSize: 11,
			lineHeight: "16px",
			whiteSpace: "nowrap",
			fontVariantNumeric: "tabular-nums"
		};
		const categoryTagStyle = {
			...tagBaseStyle,
			color: "var(--dsw-alias-label-secondary)",
			background: "var(--dsw-alias-bg-layer-1)"
		};
		const enabledTagStyle = {
			...tagBaseStyle,
			color: "var(--dsw-alias-state-success-primary)",
			background: "color-mix(in srgb, var(--dsw-alias-state-success-primary) 10%, transparent)"
		};
		const disabledTagStyle = {
			...tagBaseStyle,
			color: "var(--dsw-alias-label-tertiary)"
		};
		const lockedTagStyle = {
			...tagBaseStyle,
			color: "var(--dsw-alias-label-tertiary)",
			background: "color-mix(in srgb, var(--dsw-alias-state-error-primary) 8%, transparent)"
		};
		const presetTagStyle = {
			...tagBaseStyle,
			color: "var(--dsw-alias-state-business-primary)",
			background: "color-mix(in srgb, var(--dsw-alias-state-business-primary) 10%, transparent)"
		};
		const unknownTagStyle = {
			...tagBaseStyle,
			color: "var(--dsw-alias-label-tertiary)",
			background: "var(--dsw-alias-bg-layer-1)",
			borderStyle: "dashed",
			borderWidth: 1,
			borderColor: "var(--dsw-alias-border-l2)"
		};
		const detailsButtonStyle = {
			border: "none",
			background: "transparent",
			padding: 0,
			cursor: "pointer",
			font: "inherit",
			fontSize: 12,
			lineHeight: "18px",
			color: "var(--dsw-alias-label-secondary)",
			alignSelf: "flex-start",
			marginTop: 4
		};
		const detailStyle = {
			marginTop: 8,
			paddingTop: 8,
			borderTop: "1px solid var(--dsw-alias-border-l2)",
			display: "flex",
			flexDirection: "column",
			gap: 6
		};
		const detailBlockStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 1
		};
		const detailLabelStyle = {
			margin: 0,
			fontSize: 11,
			lineHeight: "16px",
			fontWeight: 600,
			color: "var(--dsw-alias-label-tertiary)"
		};
		const detailTextStyle = {
			margin: 0,
			fontSize: 12,
			lineHeight: "18px",
			color: "var(--dsw-alias-label-secondary)",
			whiteSpace: "pre-wrap",
			overflowWrap: "anywhere"
		};
		const toggleButtonStyle = {
			border: "1px solid var(--dsw-alias-border-l2)",
			color: "var(--dsw-alias-label-secondary)",
			font: "inherit",
			fontSize: 12,
			cursor: "pointer",
			background: "transparent",
			borderRadius: 6,
			padding: "3px 8px"
		};
		const switchStyle = {
			position: "relative",
			flex: "none",
			width: 36,
			height: 20,
			borderRadius: 999,
			border: "none",
			padding: 0,
			cursor: "pointer",
			background: "var(--dsw-alias-bg-layer-1)",
			boxShadow: "inset 0 0 0 1px var(--dsw-alias-border-l2)",
			transition: "background .14s var(--ds-ease-in-out)"
		};
		const switchOnStyle = {
			...switchStyle,
			background: "var(--dsw-alias-state-business-primary)",
			boxShadow: "none"
		};
		const switchDisabledStyle = {
			...switchStyle,
			cursor: "default",
			opacity: .55
		};
		const knobStyle = {
			position: "absolute",
			top: 2,
			left: 2,
			width: 16,
			height: 16,
			borderRadius: 999,
			background: "var(--dsw-alias-bg-base)",
			transition: "transform .14s var(--ds-ease-in-out)"
		};
		const knobOnStyle = {
			...knobStyle,
			transform: "translateX(16px)"
		};
		function Switch(props) {
			const { on, disabled, label, onToggle } = props;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				role: "switch",
				"aria-checked": on,
				"aria-label": label,
				"aria-disabled": disabled || void 0,
				disabled,
				onClick: onToggle,
				style: disabled ? switchDisabledStyle : on ? switchOnStyle : switchStyle,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					style: on ? knobOnStyle : knobStyle,
					"aria-hidden": "true"
				})
			});
		}
		function phaseKey(phase) {
			if (phase === null) return "phaseUnobserved";
			switch (phase) {
				case "pending": return "phasePending";
				case "loading": return "phaseLoading";
				case "active": return "phaseActive";
				case "failed": return "phaseFailed";
				case "unloading": return "phaseUnloading";
				default: return null;
			}
		}
		const REASON_KEY = {
			self: "reasonSelf",
			core: "reasonCore",
			unlisted: "reasonUnlisted",
			external: "reasonExternal"
		};
		/** One rendered card. Manageability comes from the snapshot, never the catalog. */
		function PluginCard(props) {
			const { plugin, entry, t, busy, expanded, onToggleExpanded, onToggle } = props;
			const presetManaged = PRESET_MANAGED.has(plugin.id);
			const on = !plugin.disabled;
			const phase = phaseKey(plugin.phase);
			const manageable = plugin.manageable === true;
			const hasManageableDetails = manageable && (entry.impact !== void 0 || entry.recommendation !== void 0);
			const hasLockedDetails = !manageable && (entry.lockNote !== void 0 || entry.statusNote !== void 0);
			const hasDetails = hasManageableDetails || hasLockedDetails;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				style: cardStyle,
				"aria-busy": busy || void 0,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: cardRowStyle,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: cardMainStyle,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: titleLineStyle,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
										style: titleStyle,
										children: entry.title
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: categoryTagStyle,
										children: entry.category
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
									style: idStyle,
									children: [plugin.id, plugin.name !== "" ? " · " + plugin.name : ""]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									style: descStyle,
									children: entry.summary
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: {
										display: "flex",
										gap: 6,
										alignItems: "center",
										marginTop: 2,
										flexWrap: "wrap"
									},
									children: [
										manageable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											style: on ? enabledTagStyle : disabledTagStyle,
											children: on ? t("enabled") : t("disabled")
										}) : presetManaged ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											style: presetTagStyle,
											children: t("presetManaged")
										}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											style: lockedTagStyle,
											title: t("reasonLabel"),
											children: plugin.reason !== void 0 ? t(REASON_KEY[plugin.reason] ?? "reasonUnlisted") : t("reasonUnlisted")
										}),
										entry.unknown === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											style: unknownTagStyle,
											children: t("unknownNote")
										}) : null,
										manageable && phase !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											style: tagBaseStyle,
											children: t(phase)
										}) : null,
										busy ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											style: tagBaseStyle,
											children: t("busy")
										}) : null
									]
								})
							]
						}), manageable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Switch, {
							on,
							disabled: busy,
							label: t(on ? "toggleDisable" : "toggleEnable", { name: plugin.id }),
							onToggle: () => {
								onToggle(plugin.id, on);
							}
						}) : null]
					}),
					hasDetails ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						style: detailsButtonStyle,
						"aria-expanded": expanded,
						onClick: onToggleExpanded,
						children: expanded ? t("detailsHide") : t("detailsShow")
					}) : null,
					expanded && hasDetails ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: detailStyle,
						children: manageable ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [entry.impact !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: detailBlockStyle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: detailLabelStyle,
								children: t("impactLabel")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: detailTextStyle,
								children: entry.impact
							})]
						}) : null, entry.recommendation !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: detailBlockStyle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: detailLabelStyle,
								children: t("recommendationLabel")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: detailTextStyle,
								children: entry.recommendation
							})]
						}) : null] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [entry.lockNote !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: detailBlockStyle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: detailLabelStyle,
								children: t("lockNoteLabel")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: detailTextStyle,
								children: entry.lockNote
							})]
						}) : null, entry.statusNote !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: detailBlockStyle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: detailLabelStyle,
								children: t("statusNoteLabel")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: detailTextStyle,
								children: entry.statusNote
							})]
						}) : null] })
					}) : null
				]
			});
		}
		function BuiltinTogglesTab({ t }) {
			const [view, setView] = (0, react.useState)({ status: "loading" });
			const [busyId, setBusyId] = (0, react.useState)(null);
			const [toggleError, setToggleError] = (0, react.useState)(null);
			const [notice, setNotice] = (0, react.useState)(null);
			const [showLocked, setShowLocked] = (0, react.useState)(false);
			const [query, setQuery] = (0, react.useState)("");
			const [expanded, setExpanded] = (0, react.useState)({});
			const [attempt, setAttempt] = (0, react.useState)(0);
			const queue = (0, react.useRef)(Promise.resolve());
			const load = (0, react.useCallback)(async (silent = false) => {
				if (!silent) setView({ status: "loading" });
				try {
					const res = await fetch(API);
					if (!res.ok) throw new Error("HTTP " + res.status);
					const data = await res.json();
					setView({
						status: "ready",
						plugins: data.plugins
					});
				} catch {
					setView((previous) => silent && previous.status === "ready" ? previous : { status: "error" });
				}
			}, []);
			(0, react.useEffect)(() => {
				load();
			}, [load, attempt]);
			const toggle = (0, react.useCallback)((id, disabled) => {
				const run = async () => {
					setBusyId(id);
					setToggleError(null);
					setNotice(null);
					let succeeded = false;
					try {
						const res = await fetch("/api/builtin-toggles/" + encodeURIComponent(id), {
							method: "POST",
							headers: { "content-type": "application/json" },
							body: JSON.stringify({ disabled })
						});
						if (!res.ok) {
							const data = await res.json().catch(() => null);
							throw new Error(data?.message ?? "HTTP " + res.status);
						}
						succeeded = true;
					} catch (error) {
						setToggleError(error instanceof Error ? error.message : String(error));
					} finally {
						setBusyId(null);
						await load(true);
						if (succeeded) setNotice(t("refreshHint"));
					}
				};
				queue.current = queue.current.then(run, run);
			}, [load, t]);
			const toggleExpanded = (0, react.useCallback)((id) => {
				setExpanded((previous) => ({
					...previous,
					[id]: !(previous[id] ?? false)
				}));
			}, []);
			const annotate = (plugin) => ({
				plugin,
				entry: getBuiltinCatalogEntry(plugin.id, plugin.name)
			});
			const searchMatch = (row) => matchesSearch(query, {
				title: row.entry.title,
				summary: row.entry.summary,
				id: row.plugin.id,
				moduleName: row.plugin.name
			});
			const readyPlugins = view.status === "ready" ? view.plugins : [];
			const manageable = (0, react.useMemo)(() => readyPlugins.filter((plugin) => plugin.manageable).map(annotate), [readyPlugins]);
			const locked = (0, react.useMemo)(() => readyPlugins.filter((plugin) => !plugin.manageable).map(annotate), [readyPlugins]);
			if (view.status === "loading") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: sectionStyle,
				"aria-busy": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					style: statusLineStyle,
					children: t("loading")
				})
			});
			if (view.status === "error") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: sectionStyle,
				role: "alert",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					style: errorStyle,
					children: t("error")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					style: retryButtonStyle,
					onClick: () => setAttempt((n) => n + 1),
					children: t("retry")
				}) })]
			});
			const isSearching = query.trim().length > 0;
			const manageableFiltered = isSearching ? manageable.filter(searchMatch) : manageable;
			const lockedFiltered = isSearching ? locked.filter(searchMatch) : locked;
			const showLockedSection = isSearching ? true : showLocked;
			const lockedCount = isSearching ? lockedFiltered.length : locked.length;
			const emptyResult = isSearching && manageableFiltered.length === 0 && lockedFiltered.length === 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: sectionStyle,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: introStyle,
						children: t("intro")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						type: "search",
						value: query,
						onChange: (event) => setQuery(event.target.value),
						placeholder: t("searchPlaceholder"),
						"aria-label": t("searchPlaceholder"),
						style: searchInputStyle
					}),
					toggleError !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: errorStyle,
						role: "alert",
						children: t("toggleFailed", { message: toggleError })
					}) : null,
					notice !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: {
							...statusLineStyle,
							color: "var(--dsw-alias-state-success-primary)"
						},
						role: "status",
						children: notice
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
						style: headingStyle,
						children: t("manageableHeading")
					}),
					manageableFiltered.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						style: blockStyle,
						children: manageableFiltered.map(({ plugin, entry }) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PluginCard, {
							plugin,
							entry,
							t,
							busy: busyId === plugin.id,
							expanded: expanded[plugin.id] ?? false,
							onToggleExpanded: () => {
								toggleExpanded(plugin.id);
							},
							onToggle: toggle
						}, plugin.id))
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							alignItems: "center",
							gap: 10,
							marginTop: 6
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
							style: {
								...headingStyle,
								margin: 0
							},
							children: t("lockedHeading")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: toggleButtonStyle,
							"aria-expanded": showLockedSection,
							onClick: () => setShowLocked((v) => !v),
							children: showLockedSection ? t("hideLocked") : t("lockedHint") + " · " + String(lockedCount)
						})]
					}),
					emptyResult ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: statusLineStyle,
						children: t("searchEmpty")
					}) : showLockedSection ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						style: blockStyle,
						children: lockedFiltered.map(({ plugin, entry }) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PluginCard, {
							plugin,
							entry,
							t,
							busy: busyId === plugin.id,
							expanded: expanded[plugin.id] ?? false,
							onToggleExpanded: () => {
								toggleExpanded(plugin.id);
							},
							onToggle: toggle
						}, plugin.id))
					}) : null
				]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/** 中文词典。 */
		const zh = {
			tab: "内置插件",
			loading: "正在读取内置插件…",
			error: "内置插件暂时不可用。",
			retry: "重试",
			intro: "查看 DSH Web 的官方内置插件及其作用。可管理开关作用于当前 Web Profile，会影响该 Profile 下的所有会话，不会修改 Agent Preset；核心服务和 Agent 能力保持锁定。",
			searchPlaceholder: "搜索名称、功能、ID 或包名",
			searchEmpty: "没有匹配的内置插件。",
			manageableHeading: "可管理",
			lockedHeading: "其他内置插件",
			lockedHint: "以下官方内置插件已锁定，不能通过本面板操作。",
			showLocked: "查看其他内置插件",
			hideLocked: "收起",
			enabled: "已启用",
			disabled: "已停用",
			phasePending: "等待依赖",
			phaseLoading: "加载中",
			phaseActive: "运行中",
			phaseFailed: "挂载失败",
			phaseUnloading: "卸载中",
			phaseUnobserved: "未挂载",
			toggleEnable: "启用 {name}",
			toggleDisable: "停用 {name}",
			busy: "正在应用…",
			toggleFailed: "操作失败：{message}",
			refreshHint: "已保存。刷新页面后生效。",
			reasonSelf: "自身",
			reasonCore: "核心",
			reasonUnlisted: "未收录",
			reasonExternal: "外部",
			reasonLabel: "锁定原因",
			detailsShow: "查看详情",
			detailsHide: "收起详情",
			impactLabel: "关闭后",
			recommendationLabel: "建议",
			lockNoteLabel: "为什么锁定",
			statusNoteLabel: "状态说明",
			presetManaged: "由 Agent 预设管理",
			unknownNote: "未收录说明"
		};
		/** English dictionary checked against the Chinese key set. */
		const en = {
			tab: "Built-ins",
			loading: "Reading built-in plugins…",
			error: "Built-in plugins are temporarily unavailable.",
			retry: "Retry",
			intro: "View DSH Web’s official built-in plugins and what they do. The manageable toggles apply to the current Web Profile and affect all its sessions; they do not modify Agent Presets. Core services and Agent capabilities stay locked.",
			searchPlaceholder: "Search name, function, ID, or package",
			searchEmpty: "No matching built-ins.",
			manageableHeading: "Manageable",
			lockedHeading: "Other built-ins",
			lockedHint: "The following official built-ins are locked and cannot be operated from this panel.",
			showLocked: "Show other built-ins",
			hideLocked: "Collapse",
			enabled: "Enabled",
			disabled: "Disabled",
			phasePending: "Waiting for dependencies",
			phaseLoading: "Loading",
			phaseActive: "Active",
			phaseFailed: "Mount failed",
			phaseUnloading: "Unloading",
			phaseUnobserved: "Not mounted",
			toggleEnable: "Enable {name}",
			toggleDisable: "Disable {name}",
			busy: "Applying…",
			toggleFailed: "Toggle failed: {message}",
			refreshHint: "Saved. Refresh the page to apply.",
			reasonSelf: "Self",
			reasonCore: "Core",
			reasonUnlisted: "Unlisted",
			reasonExternal: "External",
			reasonLabel: "Lock reason",
			detailsShow: "Show details",
			detailsHide: "Hide details",
			impactLabel: "After disabling",
			recommendationLabel: "Recommendation",
			lockNoteLabel: "Why locked",
			statusNoteLabel: "Status note",
			presetManaged: "Managed by Agent Preset",
			unknownNote: "No description yet"
		};
		//#endregion
		//#region src/client/index.ts
		/** Dictionary namespace owned by this plugin. */
		const NS = "settings.builtins";
		/** Services required by the Settings registration. */
		const inject = ["slots", "locale"];
		/** Contribute the lazy Built-ins tab to the Plugins settings section. */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "builtin-toggles: dictionaries");
			const t = ctx.locale.bind(NS);
			ctx.slots.inject("settings.plugins.tab", () => ctx.slots.register({
				name: "settings.plugins.tab",
				id: "builtins",
				order: 20,
				label: () => t("tab"),
				locale: NS,
				inject: () => ({})
			}, BuiltinTogglesTab));
		}
		//#endregion
		exports.NS = NS;
		exports.PRESET_MANAGED = PRESET_MANAGED;
		exports.PRESET_MANAGED_IDS = PRESET_MANAGED_IDS;
		exports.apply = apply;
		exports.getBuiltinCatalogEntry = getBuiltinCatalogEntry;
		exports.inject = inject;
		exports.matchesSearch = matchesSearch;
		exports.moduleShortName = moduleShortName;
		exports.normalizeSearch = normalizeSearch;
		exports.resolveCatalogEntry = resolveCatalogEntry;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map