/**
 * Locale dictionaries for the Built-ins tab, following the official
 * ui-settings-plugin-inventory pattern: a key union, a zh dictionary, an en
 * dictionary, and a `LocaleNamespaceMap` augmentation declared by the client
 * entry (client/index.ts).
 */

export type BuiltinTogglesLocaleKey =
  | 'tab'
  | 'loading'
  | 'error'
  | 'retry'
  | 'intro'
  | 'manageableHeading'
  | 'lockedHeading'
  | 'lockedHint'
  | 'showLocked'
  | 'hideLocked'
  | 'enabled'
  | 'disabled'
  | 'phasePending'
  | 'phaseLoading'
  | 'phaseActive'
  | 'phaseFailed'
  | 'phaseUnloading'
  | 'phaseUnobserved'
  | 'toggleEnable'
  | 'toggleDisable'
  | 'busy'
  | 'toggleFailed'
  | 'refreshHint'
  | 'reasonSelf'
  | 'reasonCore'
  | 'reasonUnlisted'
  | 'reasonExternal'
  | 'reasonLabel'
  | 'descUiDeliverables'
  | 'descUiJobs'
  | 'descUiGoal'
  | 'descUiMessageFeedback'
  | 'descUiModelSelection'
  | 'descUiAgentPreset'
  | 'descUiSkill'
  | 'descUiSubagent'
  | 'descUiTrajectory'

/** 中文词典。 */
export const zh: Record<BuiltinTogglesLocaleKey, string> = {
  tab: '内置开关',
  loading: '正在读取内置插件…',
  error: '内置插件暂时不可用。',
  retry: '重试',
  intro: '这里只允许开关一小撮经过安全审核的官方 Web UI 插件；其他内置插件默认锁定。',
  manageableHeading: '可管理',
  lockedHeading: '其他内置插件',
  lockedHint: '以下官方内置插件已锁定，不能通过本面板操作。',
  showLocked: '查看其他内置插件',
  hideLocked: '收起',
  enabled: '已启用',
  disabled: '已停用',
  phasePending: '等待依赖',
  phaseLoading: '加载中',
  phaseActive: '运行中',
  phaseFailed: '挂载失败',
  phaseUnloading: '卸载中',
  phaseUnobserved: '未挂载',
  toggleEnable: '启用 {name}',
  toggleDisable: '停用 {name}',
  busy: '正在应用…',
  toggleFailed: '操作失败：{message}',
  refreshHint: '已保存。刷新页面后生效。',
  reasonSelf: '自身',
  reasonCore: '核心',
  reasonUnlisted: '未收录',
  reasonExternal: '外部',
  reasonLabel: '锁定原因',
  descUiDeliverables: '在每条助手消息下方展示产物文件。',
  descUiJobs: '在会话头部展示后台任务列表。',
  descUiGoal: '在输入坞展示目标进度条。',
  descUiMessageFeedback: '在消息操作区展示赞 / 踩反馈。',
  descUiModelSelection: '模型选择器（/model）。',
  descUiAgentPreset: '默认 Agent 预设选择器。',
  descUiSkill: '技能选择器（@ 引用源）。',
  descUiSubagent: '子代理选择器（@ 引用源）。',
  descUiTrajectory: '轨迹面板。',
}

/** English dictionary checked against the Chinese key set. */
export const en: Record<BuiltinTogglesLocaleKey, string> = {
  tab: 'Built-ins',
  loading: 'Reading built-in plugins…',
  error: 'Built-in plugins are temporarily unavailable.',
  retry: 'Retry',
  intro: 'Only a small, security-reviewed set of official Web UI plugins can be toggled here; every other built-in stays locked.',
  manageableHeading: 'Manageable',
  lockedHeading: 'Other built-ins',
  lockedHint: 'The following official built-ins are locked and cannot be operated from this panel.',
  showLocked: 'Show other built-ins',
  hideLocked: 'Collapse',
  enabled: 'Enabled',
  disabled: 'Disabled',
  phasePending: 'Waiting for dependencies',
  phaseLoading: 'Loading',
  phaseActive: 'Active',
  phaseFailed: 'Mount failed',
  phaseUnloading: 'Unloading',
  phaseUnobserved: 'Not mounted',
  toggleEnable: 'Enable {name}',
  toggleDisable: 'Disable {name}',
  busy: 'Applying…',
  toggleFailed: 'Toggle failed: {message}',
  refreshHint: 'Saved. Refresh the page to apply.',
  reasonSelf: 'Self',
  reasonCore: 'Core',
  reasonUnlisted: 'Unlisted',
  reasonExternal: 'External',
  reasonLabel: 'Lock reason',
  descUiDeliverables: 'Produced files under each assistant message.',
  descUiJobs: 'Background jobs list in the session header.',
  descUiGoal: 'Goal progress bar in the input dock.',
  descUiMessageFeedback: 'Like / dislike feedback in the message action strip.',
  descUiModelSelection: 'Model selector (/model).',
  descUiAgentPreset: 'Default agent preset picker.',
  descUiSkill: 'Skill picker (@ reference source).',
  descUiSubagent: 'Subagent picker (@ reference source).',
  descUiTrajectory: 'Trajectory panel.',
}
