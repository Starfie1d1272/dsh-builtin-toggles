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

import { resolveCatalogEntry, type BuiltinCatalogEntry } from './catalog.ts'

/** 由 Agent 预设管理的能力：统一状态说明（展示专用）。 */
const PRESET_STATUS =
  '网页端顶层停用是正常状态；实际是否可用由当前会话的 Agent 预设决定。'
const PRESET_LOCK = '该能力由 Agent 预设组装，不由全局内置插件面板开关。'

/** 生成一条 preset-managed 条目。 */
function presetManaged(
  title: string,
  summary: string,
  category: BuiltinCatalogEntry['category'],
): BuiltinCatalogEntry {
  return { title, summary, category, presetManaged: true, statusNote: PRESET_STATUS, lockNote: PRESET_LOCK }
}

export const zhCatalog: Readonly<Record<string, BuiltinCatalogEntry>> = {
  /* ── 5A. 可管理（9 个，纯界面插件，有开关）────────────────────────── */
  'ui-deliverables': {
    title: '产出文件',
    summary: '在助手回复下方列出本轮创建或修改的文件，并把可识别的文件引用变成可点击链接。',
    category: '界面功能',
    impact: '不再显示产出文件行和文件链接；相关的最终回复文件引用提示也会移除。',
    recommendation: '如果经常让智能体创建或修改文件，建议保持开启。',
  },
  'ui-jobs': {
    title: '后台任务列表',
    summary: '会话存在后台任务时，在页头显示任务状态、详情和运行耗时。',
    category: '界面功能',
    impact: '后台任务仍可运行，但网页端页头不再显示任务列表。',
    recommendation: '使用后台命令或后台子代理时建议开启。',
  },
  'ui-goal': {
    title: '目标栏',
    summary: '在输入区显示当前目标，可编辑、暂停、恢复或清除；目标仍通过 /goal 创建。',
    category: '界面功能',
    impact: '目标本身和 /goal 命令仍然存在，但网页端不再显示目标栏。',
    recommendation: '不使用目标工作流时可以关闭。',
  },
  'ui-message-feedback': {
    title: '消息反馈',
    summary: '在已完成的助手回复上显示赞、踩和可选备注。',
    category: '界面功能',
    impact: '只移除反馈控件，不影响对话内容，也不会改变模型上下文。',
    recommendation: '不需要给回复做人工反馈时可以关闭。',
  },
  'ui-model-selection': {
    title: '模型选择',
    summary: '提供 /model 和输入区的模型、推理强度选择入口。',
    category: '界面功能',
    impact: '已配置的模型路由仍可工作，但网页端失去模型和推理强度选择界面。',
    recommendation: '需要在网页端切换模型时保持开启。',
  },
  'ui-agent-preset': {
    title: 'Agent 预设',
    summary: '选择新会话使用的 Agent 预设，并查看和管理预设列表；已经开始的会话不会被实时切换。',
    category: '界面功能',
    impact: 'Agent 预设系统仍存在，但网页端失去新会话预设选择、预设标签和管理界面。',
    recommendation: '使用内置或自定义 Agent 预设时建议保持开启。',
  },
  'ui-skill': {
    title: 'skill 入口',
    summary: '把可用 skill 加入 / 输入菜单，并为 skill 工具调用提供专用展示。',
    category: '界面功能',
    impact: '宿主的 skill 能力仍可存在，但网页端失去 skill 菜单入口和专用工具行显示。',
    recommendation: '经常手动调用 skill 时建议开启。',
  },
  'ui-subagent': {
    title: '子代理界面',
    summary: '在会话页头显示子代理树、进入子会话，并提供 @ 子代理引用入口。',
    category: '界面功能',
    impact: '宿主的子代理能力仍可运行，但网页端失去子代理目录、导航和引用界面。',
    recommendation: '使用子代理时建议开启。',
  },
  'ui-trajectory': {
    title: '执行轨迹',
    summary: '按轮次查看用户、助手和工具事件，并检查词元、耗时、输入与输出。',
    category: '界面功能',
    impact: '对话和智能体执行不受影响，只移除执行轨迹调试与分析视图。',
    recommendation: '日常不查看执行细节时可以关闭。',
  },

  /* ── 5B. Web 界面与浏览器基础 ────────────────────────────────────── */
  'ui-theme': {
    title: '主题系统',
    summary: '提供网页端界面的颜色、深浅色和统一视觉基础。',
    category: '系统基础',
    lockNote: '整个网页端界面依赖这套主题基础。',
  },
  locale: {
    title: '语言系统',
    summary: '提供网页端界面的语言选择和本地化文案。',
    category: '系统基础',
    lockNote: '其他界面依赖它获取当前语言和文本。',
  },
  'ui-layout': {
    title: '页面布局',
    summary: '负责网页端主页面各区域的整体布局。',
    category: '系统基础',
    lockNote: '关闭会破坏页面骨架。',
  },
  'ui-sidebar': {
    title: '侧边栏框架',
    summary: '提供左侧导航和侧边区域的基础容器。',
    category: '系统基础',
    lockNote: '工作区、会话等界面会向其中挂载内容。',
  },
  'ui-settings': {
    title: '设置框架',
    summary: '提供设置页面、设置分区和插件标签页。',
    category: '系统基础',
    lockNote: '本插件自身也运行在这套设置框架中。',
  },
  'ui-settings-general': {
    title: '通用设置',
    summary: '提供语言和其他通用偏好设置页面。',
    category: '界面功能',
    lockNote: '属于官方设置体系的一部分。',
  },
  'ui-settings-models': {
    title: '模型设置',
    summary: '提供模型提供方、模型和凭据相关的设置界面。',
    category: '模型与智能体',
    lockNote: '它连接模型路由与设置服务，不作为纯展示插件开放关闭。',
  },
  'ui-settings-plugin-inventory': {
    title: '官方插件列表',
    summary: 'DSH 自带的只读插件清单，可搜索并查看 Loader 条目的状态和配置。',
    category: '界面功能',
    lockNote: '这是官方的插件状态查看器，保持只读和稳定。',
  },
  'ui-settings-plugins': {
    title: '插件配置',
    summary: '显示宿主插件主动暴露给用户的可配置项。',
    category: '界面功能',
    lockNote: '它是插件配置的基础页面，不是单一装饰功能。',
  },
  'ui-conversation': {
    title: '对话界面核心',
    summary: '负责聊天记录、输入框、消息渲染和主要会话交互。',
    category: '系统基础',
    lockNote: '这是网页端对话核心，许多其他界面插件依赖它。',
  },
  'ui-input-trigger': {
    title: '输入触发器',
    summary: '提供 /、@ 等输入触发和候选菜单的基础管线。',
    category: '系统基础',
    lockNote: '命令、skill 和子代理等输入入口依赖它。',
  },
  'ui-commands': {
    title: '命令界面',
    summary: '提供 / 命令目录、命令弹窗和其他界面使用的 commandUi 服务。',
    category: '系统基础',
    lockNote: '模型选择、权限界面和对话核心等功能依赖它，不能作为独立界面关闭。',
  },
  'ui-permission': {
    title: '权限控制界面',
    summary: '提供默认权限预设以及当前会话的 /permission 选择界面。',
    category: '安全与权限',
    lockNote: '它会改变沙箱和审批策略，并依赖命令服务，属于安全关键界面。',
  },
  'ui-plan': {
    title: 'plan mode 界面',
    summary: 'plan mode 启用后，在输入区显示状态控件，并提供退出入口。',
    category: '模型与智能体',
    lockNote: '它对应会影响模型行为的 plan mode 策略，不作为普通视觉装饰开放关闭。',
  },
  'ui-user-questions': {
    title: '用户问答与审批',
    summary: '显示智能体发起的问题、选择题，以及计划审阅等等待用户决定的卡片。',
    category: '安全与权限',
    lockNote: '这是智能体等待用户回答或批准的重要交互通道。',
  },
  'ui-workspace': {
    title: '工作区与会话浏览',
    summary: '在侧边栏浏览和管理工作区、会话，并提供搜索、排序、重命名和归档等界面。',
    category: '界面功能',
    lockNote: '属于工作区和会话导航核心。',
  },
  'ui-tool': {
    title: '工具调用界面',
    summary: '负责聊天中工具调用的通用展示，并承载各种专用工具视图。',
    category: '系统基础',
    lockNote: '大量工具结果界面依赖这套渲染基础。',
  },
  'ui-cordis': {
    title: 'Cordis 工具视图',
    summary: '为 Cordis 相关工具调用提供专用的结果展示。',
    category: '界面功能',
    lockNote: '依赖工具调用基础界面，当前保持锁定。',
  },
  'ui-workflow-run': {
    title: '工作流运行视图',
    summary: '把持久工作流的运行过程显示为聊天中的独立节点。',
    category: '界面功能',
    lockNote: '与工作流生命周期和会话投影相连，当前未作为安全叶子开放。',
  },
  modules: {
    title: '客户端模块加载',
    summary: '扫描并向浏览器提供各个客户端插件，组成网页端启动模块表。',
    category: '系统基础',
    lockNote: '所有浏览器插件都依赖它加载。',
  },
  connection: {
    title: '浏览器连接',
    summary: '负责浏览器与 DSH 宿主之间的 API 和事件流连接。',
    category: '系统基础',
    lockNote: '关闭后网页端无法正常与宿主通信。',
  },
  'api-remotes': {
    title: '浏览器远程 API',
    summary: '把宿主提供的类型化远程接口交给浏览器插件使用。',
    category: '系统基础',
    lockNote: '大量界面与宿主的交互依赖它。',
  },
  'client-runtime': {
    title: '客户端运行时',
    summary: '维护浏览器中的会话、事件流和各类实时状态。',
    category: '系统基础',
    lockNote: '会话界面依赖的核心状态层。',
  },
  'cordis-client-runner': {
    title: 'Cordis 客户端运行器',
    summary: '在浏览器中承载 Cordis 客户端插件及其协作机制。',
    category: '系统基础',
    lockNote: '属于客户端插件系统基础。',
  },
  'client-hmr': {
    title: '客户端热更新',
    summary: '开发时监听客户端插件包重建并重新加载浏览器插件。',
    category: '系统基础',
    lockNote: '属于开发和运行基础，不作为用户功能开关。',
  },

  /* ── 5C. Web Host 与插件基础设施 ─────────────────────────────────── */
  'plugin-inventory': {
    title: '插件清单服务',
    summary: '宿主侧提供当前 Loader 条目和运行状态的只读快照。',
    category: '系统基础',
    lockNote: '官方插件列表和本插件的诊断都依赖这类清单能力。',
  },
  'directory-picker': {
    title: '目录选择',
    summary: '根据本机或远程部署环境选择合适的文件夹选择方式。',
    category: '界面功能',
    lockNote: '添加工作区等流程依赖它。',
  },
  webserver: {
    title: '网页端服务器',
    summary: '承载 DSH 网页端页面和 HTTP API。',
    category: '系统基础',
    lockNote: '关闭会直接失去网页端服务。',
  },
  'web-runtime': {
    title: '网页端运行层',
    summary: '连接前端静态页面、部署环境和网页端运行上下文。',
    category: '系统基础',
    lockNote: '属于整个网页端部署的核心。',
  },
  'web-startup': {
    title: '网页端启动参数',
    summary: '解析网页端启动时的地址、端口和 trusted-host 等参数。',
    category: '系统基础',
    lockNote: '网页端运行层依赖这些启动信息。',
  },
  'api-gateway': {
    title: 'API 网关',
    summary: '宿主侧统一分发浏览器发来的业务 API 调用。',
    category: '系统基础',
    lockNote: '客户端与宿主的业务通信依赖它。',
  },
  'cordis-host-runner': {
    title: 'Cordis 宿主运行器',
    summary: '承载宿主侧的 Cordis 插件运行能力。',
    category: '系统基础',
    lockNote: '属于宿主插件运行基础。',
  },
  'code-runtime': {
    title: '代码执行运行时',
    summary: '提供基于 worker thread 的代码运行环境，供程序化执行功能使用。',
    category: '工具与执行',
    lockNote: '属于执行基础设施，不是纯界面功能。',
  },
  storage: {
    title: '存储接口',
    summary: '为 DSH 各类状态提供统一的持久化存储接口。',
    category: '会话与数据',
    lockNote: '多个领域服务依赖这层存储抽象。',
  },
  'storage-json': {
    title: 'JSON 存储后端',
    summary: '把通用存储内容保存为 DSH_HOME 下的 JSON 数据。',
    category: '会话与数据',
    lockNote: '属于具体持久化后端。',
  },
  'storage-domain': {
    title: '领域存储绑定',
    summary: '把 DSH 的领域状态连接到当前存储后端。',
    category: '会话与数据',
    lockNote: '属于数据持久化基础。',
  },
  'message-feedback': {
    title: '消息反馈服务',
    summary: '宿主侧保存赞、踩和备注，并处理并发版本冲突。',
    category: '会话与数据',
    lockNote: '这是消息反馈界面背后的数据服务。',
  },
  'session-log-download': {
    title: '会话导出',
    summary: '提供 /export 和浏览器下载会话日志的能力。',
    category: '会话与数据',
    lockNote: '与会话日志和命令系统相连，当前未审计为纯界面叶子。',
  },
  workspace: {
    title: '工作区服务',
    summary: '宿主侧维护工作区、会话归属及相关操作。',
    category: '会话与数据',
    lockNote: '工作区界面的核心数据服务。',
  },
  'session-projection-cache': {
    title: '会话投影缓存',
    summary: '缓存由会话日志计算出的界面和功能状态，减少重复重放。',
    category: '会话与数据',
    lockNote: '属于会话数据基础设施。',
  },
  'session-stats': {
    title: '会话统计',
    summary: '计算整个会话的轮次、步骤等统计信息。',
    category: '会话与数据',
    lockNote: '属于会话投影服务，而不是单一界面。',
  },

  /* ── 5D. 会话、模型和 Agent 核心 ─────────────────────────────────── */
  llm: {
    title: 'LLM 路由',
    summary: '统一登记模型提供方和模型调用路由。',
    category: '模型与智能体',
    lockNote: '所有模型调用都依赖它。',
  },
  'llm-deepseek': {
    title: 'DeepSeek 模型适配器',
    summary: '连接 DeepSeek 模型接口；API Key 和端点从设置与凭据系统读取。',
    category: '模型与智能体',
    lockNote: '属于模型执行路径核心。',
  },
  'llm-pi-ai': {
    title: '多提供方模型适配器',
    summary: '按用户设置动态接入额外模型提供方；没有配置时可以保持空闲。',
    category: '模型与智能体',
    lockNote: '属于模型路由服务，不是界面叶子。',
  },
  'llm-retry': {
    title: '模型请求重试',
    summary: '为模型请求提供统一的失败重试策略。',
    category: '模型与智能体',
    lockNote: '直接影响模型调用可靠性。',
  },
  'token-meter': {
    title: '词元计量',
    summary: '记录模型上下文和词元使用，为压缩等策略提供依据。',
    category: '模型与智能体',
    lockNote: '多个智能体策略会依赖这些数据。',
  },
  session: {
    title: '会话核心',
    summary: '维护会话的事件记录、生命周期和核心状态。',
    category: '会话与数据',
    lockNote: '对话历史和智能体执行都依赖它。',
  },
  'session-title': {
    title: '会话标题',
    summary: '负责会话标题及标题生成失败时的回退规则。',
    category: '会话与数据',
    lockNote: '属于会话元数据服务。',
  },
  'session-title-llm': {
    title: '智能标题生成',
    summary: '根据会话开头内容调用模型生成简短标题。',
    category: '模型与智能体',
    lockNote: '属于标题生成链路。',
  },
  'session-persistence-jsonl': {
    title: '会话持久化',
    summary: '把会话事件以 JSONL 形式保存到 DSH_HOME/sessions。',
    category: '会话与数据',
    lockNote: '这是历史数据持久化核心。',
  },
  'attachment-local': {
    title: '附件存储',
    summary: '在本机保存会话图片和附件，并通过内容地址供消息引用。',
    category: '会话与数据',
    lockNote: '属于附件数据基础设施。',
  },
  'session-query-sqlite': {
    title: '会话查询索引',
    summary: '提供会话读取、标题和谱系查询；全文内容搜索默认不开启。',
    category: '会话与数据',
    lockNote: '导出和谱系等功能仍依赖它；不要把‘全文搜索未开启’理解为插件无用。',
  },
  'session-projection': {
    title: '会话投影',
    summary: '把追加式会话历史计算成界面和功能需要的当前状态。',
    category: '会话与数据',
    lockNote: '许多宿主和网页端功能都依赖这些派生状态。',
  },
  'session-telemetry-otel': {
    title: '会话遥测',
    summary: '按部署配置把会话遥测通过 OTLP 导出；官方默认模式为关闭。',
    category: '会话与数据',
    lockNote: '遥测启用属于部署和隐私策略，不由这个面板作为普通插件开关管理。',
  },
  'session-checkpoint-policy': {
    title: '会话检查点',
    summary: '在关键执行边界保存检查点，提高中断后的可恢复性。',
    category: '会话与数据',
    lockNote: '属于可靠性基础设施。',
  },
  agent: {
    title: '智能体核心',
    summary: '维护智能体实例、会话绑定和执行生命周期。',
    category: '模型与智能体',
    lockNote: '智能体运行核心。',
  },
  'agent-loop': {
    title: '智能体执行循环',
    summary: '负责模型调用、工具执行和下一步模型调用之间的主循环。',
    category: '模型与智能体',
    lockNote: '这是智能体执行核心。',
  },
  'agent-default-model': {
    title: '默认模型',
    summary: '定义新智能体或会话默认使用的模型提供方和模型。',
    category: '模型与智能体',
    lockNote: '属于会话创建路径。',
  },
  'system-prompt': {
    title: '系统提示词组装',
    summary: '组合 Harness 身份、部署角色设定和各功能加入的系统提示词。',
    category: '模型与智能体',
    lockNote: '会直接改变模型看到的上下文。',
  },
  settings: {
    title: '设置文件',
    summary: '读取和更新 DSH_HOME/settings.yaml，模型页等设置会写入这里。',
    category: '系统基础',
    lockNote: '用户配置体系依赖它。',
  },
  credentials: {
    title: '凭据管理',
    summary: '从受管凭据文件、环境变量和 .env 等来源解析 API Key 等机密信息。',
    category: '安全与权限',
    lockNote: '属于密钥和凭据基础设施。',
  },
  'user-questions': {
    title: '用户问答服务',
    summary: '宿主侧维护智能体向用户提问并等待回答的请求。',
    category: '安全与权限',
    lockNote: '用户问答界面和智能体提问能力依赖它。',
  },
  jobs: {
    title: '后台任务注册表',
    summary: '登记后台任务及其状态，并按智能体和会话提供查询。',
    category: '工具与执行',
    lockNote: '后台执行工具和后台任务界面都依赖它。',
  },
  subagent: {
    title: '子代理注册表',
    summary: '维护子代理的谱系、状态和继续交互能力。',
    category: '模型与智能体',
    lockNote: '宿主、网页端和子代理工具共同依赖它。',
  },
  'subagent-spawn-in-process': {
    title: '新建（Spawn）子代理后端',
    summary: '在当前 DSH 进程中创建新的子代理会话。',
    category: '模型与智能体',
    lockNote: '属于智能体委派执行后端。',
  },
  'subagent-fork-in-process': {
    title: '分叉（Fork）子代理后端',
    summary: '从父会话历史分叉一个一次性的子代理执行。',
    category: '模型与智能体',
    lockNote: '属于智能体委派执行后端。',
  },
  'agent-presets': {
    title: 'Agent 预设目录',
    summary: '扫描系统和用户预设，并决定新会话默认使用哪个 Agent 预设。',
    category: '模型与智能体',
    lockNote: 'Agent 预设决定每个会话拥有哪些模型能力和工具，不能当普通插件开关。',
  },
  commands: {
    title: '命令注册表',
    summary: '宿主侧登记并执行 /goal、/permission、/compact 等命令。',
    category: '系统基础',
    lockNote: '多个网页端和智能体功能依赖统一命令系统。',
  },
  'command-feedback': {
    title: '反馈命令',
    summary: '注册与反馈流程相关的宿主命令入口。',
    category: '会话与数据',
    lockNote: '属于宿主命令体系。',
  },
  goal: {
    title: '目标服务',
    summary: '持久保存并维护当前会话的目标状态。',
    category: '模型与智能体',
    lockNote: '目标命令、智能体和网页端目标栏共同依赖它。',
  },
  'goal-round-driver': {
    title: '目标轮次驱动',
    summary: '把持久目标接入同一会话后续的智能体执行过程。',
    category: '模型与智能体',
    lockNote: '属于目标执行语义，而不是界面装饰。',
  },
  'command-goal': {
    title: '目标命令',
    summary: '提供 /goal 命令，用来创建和管理会话目标。',
    category: '模型与智能体',
    lockNote: '目标工作流依赖这个宿主命令入口。',
  },

  /* ── 5E. 安全、沙箱与执行基础 ────────────────────────────────────── */
  approval: {
    title: '用户审批',
    summary: '决定工具操作何时需要用户确认，并承接审批流程。',
    category: '安全与权限',
    lockNote: '这是执行安全边界的一部分。',
  },
  permission: {
    title: '权限预设',
    summary: '定义只读、工作区可写和完全访问等沙箱与审批组合。',
    category: '安全与权限',
    lockNote: '直接决定工具能做什么，属于安全策略核心。',
  },
  sandbox: {
    title: '沙箱服务',
    summary: '为文件和进程操作提供统一的本机安全边界。',
    category: '安全与权限',
    lockNote: '执行安全依赖它。',
  },
  'sandbox-policy': {
    title: '沙箱策略',
    summary: '根据当前权限模式和工作区决定允许访问和写入的范围。',
    category: '安全与权限',
    lockNote: '属于执行权限核心。',
  },
  'bash-sandbox': {
    title: 'Bash 沙箱',
    summary: '在 macOS/Linux 等非 Windows 平台提供受限制的 Bash 执行环境。',
    category: '安全与权限',
    statusNote: '按操作系统自动选择；在 Windows 上显示停用是正常现象。',
    lockNote: '平台执行和沙箱安全依赖它。',
  },
  'pwsh-sandbox': {
    title: 'PowerShell 沙箱',
    summary: '在 Windows 上提供受限制的 PowerShell 执行环境。',
    category: '安全与权限',
    statusNote: '按操作系统自动选择；在非 Windows 平台显示停用是正常现象。',
    lockNote: '平台执行和沙箱安全依赖它。',
  },
  subprocess: {
    title: '子进程执行',
    summary: '宿主侧统一启动和管理本地子进程。',
    category: '工具与执行',
    lockNote: '多个执行类工具依赖它。',
  },
  'shell-env': {
    title: 'Shell 环境',
    summary: '向 Shell 工具提供 DSH 运行环境和必要的上下文变量。',
    category: '工具与执行',
    lockNote: '属于 Shell 执行基础。',
  },
  'fs-sandbox': {
    title: '沙箱文件系统',
    summary: '把文件系统操作限制在当前沙箱和工作区策略允许的范围内。',
    category: '安全与权限',
    lockNote: '文件操作安全依赖它。',
  },
  'fs-observation-policy': {
    title: '文件读取展示策略',
    summary: '控制文件读取和搜索结果如何稳定地交给智能体。',
    category: '工具与执行',
    lockNote: '属于文件工具执行链路。',
  },
  tools: {
    title: '工具注册表',
    summary: '登记当前智能体可以看到的工具，并控制工具的呈现方式。',
    category: '模型与智能体',
    lockNote: '模型工具目录的核心。',
  },
  'timeout-policy': {
    title: '工具超时策略',
    summary: '为不同工具调用提供统一的超时规则。',
    category: '工具与执行',
    lockNote: '执行可靠性依赖它。',
  },
  'spill-local': {
    title: '大结果落盘',
    summary: '把不适合直接内联的超大工具结果保存到本地。',
    category: '会话与数据',
    lockNote: '属于工具结果存储基础。',
  },
  'spill-policy': {
    title: '大结果策略',
    summary: '决定工具结果超过多大时改用本地 spill 引用。',
    category: '会话与数据',
    lockNote: '用于控制上下文大小和结果可靠性。',
  },
  'repeat-tool-reminder': {
    title: '重复调用提醒',
    summary: '当智能体连续重复相似工具调用时加入提醒，减少无效循环。',
    category: '模型与智能体',
    lockNote: '会直接影响智能体的后续行为。',
  },

  /* ── 5F. Web 搜索与 Host 能力 ────────────────────────────────────── */
  web: {
    title: '网页端能力',
    summary: '登记网页搜索能力和当前使用的搜索提供方。',
    category: '工具与执行',
    lockNote: '属于智能体网页端工具的宿主服务。',
  },
  'web-search-deepseek': {
    title: 'DeepSeek 网页搜索',
    summary: '使用 DeepSeek 的搜索接口作为默认网页搜索后端。',
    category: '工具与执行',
    lockNote: '属于搜索服务后端。',
  },

  /* ── 5G. Typed RPC / 内部通信 ────────────────────────────────────── */
  typert: {
    title: 'Typed RPC 注册表',
    summary: '登记 DSH 内部宿主与客户端之间的类型化远程接口。',
    category: '系统基础',
    lockNote: '属于内部通信基础。',
  },
  'typert-loader': {
    title: 'RPC 协议加载',
    summary: '加载并连接 DSH 的类型化远程接口定义。',
    category: '系统基础',
    lockNote: '属于内部通信基础。',
  },
  'typert-gateway': {
    title: 'Typed API 网关',
    summary: '负责在传输层分发类型化 RPC 调用。',
    category: '系统基础',
    lockNote: '属于内部通信核心。',
  },
  timer: {
    title: '定时器服务',
    summary: '提供 Cordis 插件使用的定时和周期任务基础能力。',
    category: '系统基础',
    lockNote: '属于基础运行服务。',
  },
  hmr: {
    title: '配置热重载',
    summary: '用于 Cordis 配置的热重载。',
    category: '系统基础',
    statusNote: '官方网页端当前明确关闭这项能力；显示停用是正常状态。',
    lockNote: '不要通过本面板强行开启。',
  },

  /* ── 5H. 由 Agent Preset 管理的能力（presetManaged）──────────────── */
  'tool-bash': presetManaged(
    'Bash 工具',
    '让智能体在 macOS/Linux 等环境执行 Bash 命令。',
    '工具与执行',
  ),
  'tool-pwsh': presetManaged(
    'PowerShell 工具',
    '让智能体在 Windows 环境执行 PowerShell 命令。',
    '工具与执行',
  ),
  'tool-jobs': presetManaged(
    '后台任务工具',
    '让智能体查询和管理后台任务。',
    '工具与执行',
  ),
  'tool-fs': presetManaged(
    '文件系统工具',
    '让智能体读取、写入和管理文件。',
    '工具与执行',
  ),
  'tool-fs-search': presetManaged(
    '文件搜索工具',
    '让智能体搜索文件、目录和内容。',
    '工具与执行',
  ),
  'tool-str-replace-editor': presetManaged(
    '文本编辑工具',
    '提供结构化的文件查看、替换和插入编辑。',
    '工具与执行',
  ),
  'skill-filesystem': presetManaged(
    '本地 skill 发现',
    '从文件系统发现并注册当前智能体可用的 skill。',
    '模型与智能体',
  ),
  'tool-skill': presetManaged(
    'skill 工具',
    '让智能体查看和加载 skill，并处理用户显式调用的 skill。',
    '模型与智能体',
  ),
  'tool-goal': presetManaged(
    '目标工具',
    '让智能体读取和更新持久化的会话目标。',
    '模型与智能体',
  ),
  'plan-mode': presetManaged(
    'plan mode',
    '为智能体提供 plan mode、退出工具和对应的规划规则。',
    '模型与智能体',
  ),
  'compaction-basic': presetManaged(
    '上下文压缩',
    '上下文过长时生成压缩摘要，为后续模型请求腾出空间。',
    '模型与智能体',
  ),
  'command-compact': presetManaged(
    '手动压缩命令',
    '提供 /compact，让用户主动触发一次上下文压缩。',
    '模型与智能体',
  ),
  'tool-result-pruner': presetManaged(
    '工具结果裁剪',
    '在整体压缩之前先缩减过大的工具结果，同时保留头尾关键信息。',
    '模型与智能体',
  ),
  'tool-subagent-control': presetManaged(
    '子代理控制',
    '为可继续子代理提供继续交互和控制通道。',
    '模型与智能体',
  ),
  'tool-subagent-list-agents': presetManaged(
    '子代理列表工具',
    '让智能体查看可用和已创建的子代理。',
    '模型与智能体',
  ),
  'tool-subagent': presetManaged(
    '创建子代理',
    '让智能体创建一个可继续交互的 Spawn 子代理。',
    '模型与智能体',
  ),
  'tool-subagent-fork': presetManaged(
    '分叉（Fork）子代理',
    '让智能体从当前历史分叉一个一次性子代理。',
    '模型与智能体',
  ),
  'workflow-worker-thread': presetManaged(
    '工作流执行后端',
    '在线程工作器中执行持久工作流。',
    '工具与执行',
  ),
  'tool-workflow': presetManaged(
    '工作流工具',
    '让智能体启动和管理工作流。',
    '工具与执行',
  ),
  'tool-ralph': presetManaged(
    'Ralph 迭代工具',
    '按固定流程反复启动新的智能体轮次，用于多轮迭代执行。',
    '工具与执行',
  ),
  'agent-instructions': presetManaged(
    '工作区指令',
    '为智能体自动加载 AGENTS.md、CLAUDE.md 等工作区指令。',
    '模型与智能体',
  ),
  'tool-todo': presetManaged(
    '任务清单工具',
    '让智能体维护任务清单和执行状态。',
    '模型与智能体',
  ),
  'tool-web': presetManaged(
    '网页搜索工具',
    '让智能体使用 web_search；官方默认组合只开放搜索，不开放任意 URL fetch。',
    '工具与执行',
  ),

  /* ── 5I. Host 层的 Skill / Subagent 辅助服务 ─────────────────────── */
  skill: {
    title: 'skill 注册表',
    summary: '维护可用 skill 目录，并把系统、用户和预设提供的 skill 合并给当前智能体。',
    category: '模型与智能体',
    lockNote: '属于 skill 基础服务。',
  },
  'skill-badge': {
    title: 'skill 标记',
    summary: '提供 skill 相关的辅助标记能力。',
    category: '模型与智能体',
    statusNote: '官方 base 当前默认停用。',
    lockNote: '保持官方默认状态。',
  },
  'tool-subagent-report': {
    title: '子代理回报通道',
    summary: '为可继续子代理提供向父智能体回报结果的通道。',
    category: '模型与智能体',
    lockNote: '它需要保持宿主层单例，不能按普通插件随意开关。',
  },

  /* ── 6. Loader 内部节点（出现时使用；未出现则无害）────────────────── */
  loader: {
    title: 'Loader',
    summary: '负责加载和管理整个 Cordis/DSH 插件树。',
    category: '系统基础',
    lockNote: '属于系统基础，保持锁定。',
  },
  include: {
    title: '配置包含',
    summary: '配置树内部用于组合其他配置的节点。',
    category: '系统基础',
    lockNote: '属于系统基础，保持锁定。',
  },
  group: {
    title: '配置分组',
    summary: '配置树内部用于组织插件条目的分组节点。',
    category: '系统基础',
    lockNote: '属于系统基础，保持锁定。',
  },
}

/** 按 Loader id 查询中文条目；未知官方 id 返回通用 fallback（不 crash）。 */
export function getBuiltinCatalogEntry(id: string, moduleName: string): BuiltinCatalogEntry {
  return resolveCatalogEntry(zhCatalog, id, moduleName)
}
