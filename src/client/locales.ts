/**
 * Locale dictionaries for the Built-ins tab, following the official
 * ui-settings-plugin-inventory pattern: a key union, a zh dictionary, an en
 * dictionary, and a `LocaleNamespaceMap` augmentation declared by the client
 * entry (client/index.ts).
 *
 * v0.2.0: the tab is now a Chinese-first "内置插件" catalog. The catalog
 * CONTENT (titles / summaries / notes) lives in catalog.zh.ts — it is not
 * duplicated here. These keys cover the tab chrome (labels, statuses, search).
 * An English catalog (catalog.en.ts) is a later-round addition.
 */

export type BuiltinTogglesLocaleKey =
  | 'tab'
  | 'loading'
  | 'error'
  | 'retry'
  | 'intro'
  | 'searchPlaceholder'
  | 'searchEmpty'
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
  | 'detailsShow'
  | 'detailsHide'
  | 'impactLabel'
  | 'recommendationLabel'
  | 'lockNoteLabel'
  | 'statusNoteLabel'
  | 'presetManaged'
  | 'unknownNote'

/** 中文词典。 */
export const zh: Record<BuiltinTogglesLocaleKey, string> = {
  tab: '内置插件',
  loading: '正在读取内置插件…',
  error: '内置插件暂时不可用。',
  retry: '重试',
  intro: '查看 DSH Web 的官方内置插件及其作用。可管理开关作用于当前 Web Profile，会影响该 Profile 下的所有会话，不会修改 Agent Preset；核心服务和 Agent 能力保持锁定。',
  searchPlaceholder: '搜索名称、功能、ID 或包名',
  searchEmpty: '没有匹配的内置插件。',
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
  detailsShow: '查看详情',
  detailsHide: '收起详情',
  impactLabel: '关闭后',
  recommendationLabel: '建议',
  lockNoteLabel: '为什么锁定',
  statusNoteLabel: '状态说明',
  presetManaged: '由 Agent 预设管理',
  unknownNote: '未收录说明',
}

/** English dictionary checked against the Chinese key set. */
export const en: Record<BuiltinTogglesLocaleKey, string> = {
  tab: 'Built-ins',
  loading: 'Reading built-in plugins…',
  error: 'Built-in plugins are temporarily unavailable.',
  retry: 'Retry',
  intro: 'View DSH Web’s official built-in plugins and what they do. The manageable toggles apply to the current Web Profile and affect all its sessions; they do not modify Agent Presets. Core services and Agent capabilities stay locked.',
  searchPlaceholder: 'Search name, function, ID, or package',
  searchEmpty: 'No matching built-ins.',
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
  detailsShow: 'Show details',
  detailsHide: 'Hide details',
  impactLabel: 'After disabling',
  recommendationLabel: 'Recommendation',
  lockNoteLabel: 'Why locked',
  statusNoteLabel: 'Status note',
  presetManaged: 'Managed by Agent Preset',
  unknownNote: 'No description yet',
}
