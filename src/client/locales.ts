/** Locale chrome for the Capability Inspector. Server DTOs stay text-free. */
export type BuiltinTogglesLocaleKey =
  | 'tab' | 'loading' | 'error' | 'retry' | 'inspectorIntro' | 'searchPlaceholder' | 'searchEmpty' | 'resultCount'
  | 'compatibilityHeading' | 'compatibilityExplain' | 'runtimeIdentityLabel' | 'noFindings' | 'copyDiagnostics' | 'diagnosticsCopied' | 'diagnosticsCopyFailed'
  | 'filterAll' | 'filterCategory' | 'filterManagementPlane' | 'filterPolicy' | 'filterVerification' | 'filterRuntime' | 'filterAnomalies'
  | 'capabilityName' | 'presetManaged' | 'effectiveDisabled' | 'effectiveEnabled' | 'detailsShow' | 'detailsHide' | 'lockReason'
  | 'mutationControls' | 'forceEnable' | 'forceDisable' | 'restoreInheritance' | 'controlsUnavailable' | 'mutationFailed' | 'mutationSubmitted' | 'restoreSubmitted'
  | 'expectedPackage' | 'reviewed' | 'reviewedReference' | 'declaredInject' | 'dependencyEvidence' | 'leafReview' | 'compatibilityFindings' | 'eligibilityReasons' | 'limitations' | 'provides' | 'consumers'
  | 'profilePersistence'
  | 'yes' | 'no' | 'none' | 'unknown' | 'noEvidence'
  | 'verificationVerified' | 'verificationDrifted' | 'verificationUnverified'
  | 'runtimeIdentityMatched' | 'runtimeIdentityMismatched' | 'runtimeIdentityUnavailable'
  | 'profileInherited' | 'profileExplicitlyEnabled' | 'profileExplicitlyDisabled' | 'profileUnavailable'
  | 'lifecycleInactive' | 'lifecyclePending' | 'lifecycleLoading' | 'lifecycleActive' | 'lifecycleFailed' | 'lifecycleUnloading' | 'lifecycleUnknown'
  | 'findingMissingExpectedEntry' | 'findingNewOfficialEntry' | 'findingPackageIdentityChanged' | 'findingDeclaredInjectChanged' | 'findingBaselinePackageUnknown' | 'findingDuplicateRuntimeId' | 'findingRuntimeReleaseIdentityUnavailable' | 'findingRuntimeReleaseIdentityMismatch'
  | 'eligibilityNotManageable' | 'eligibilityMissingRuntimeEntry' | 'eligibilityReviewedBaselineMissing' | 'eligibilityReviewedSafeLeafEvidenceMissing' | 'eligibilityTargetStructuralDrift' | 'eligibilityGlobalStructuralDrift' | 'eligibilityRuntimeIdentityMismatch' | 'eligibilityProfileNotPersistable'
  | 'categoryPresentation' | 'categoryAgent' | 'categoryTransport' | 'categoryInfrastructure' | 'categoryUnknown'
  | 'planeBrowser' | 'planeHost' | 'planeAgentPreset' | 'planeUnknown' | 'policyManageable' | 'policyLocked' | 'lockSelf' | 'lockCore' | 'lockUnlisted' | 'lockExternal'

export const zh: Record<BuiltinTogglesLocaleKey, string> = {
  tab: '内置插件', loading: '正在读取能力检查结果…', error: '能力检查暂时不可用。', retry: '重试',
  inspectorIntro: '检查当前 Host 中的所有 Loader capability。兼容性是检查结论，mutation eligibility 是服务端对单项写入的独立授权；不可操作的条目仍保留在此处供检查。',
  searchPlaceholder: '搜索 ID、包名、类别或管理平面', searchEmpty: '没有匹配的 capability。', resultCount: '显示 {count} / {total} 个 capability',
  compatibilityHeading: 'Compatibility / Doctor', compatibilityExplain: '未验证仅表示 Host 没有公开可绑定的运行时发布身份，并不表示系统损坏或 capability 不可用。', runtimeIdentityLabel: '运行时身份', noFindings: '没有可报告的发现。', copyDiagnostics: '复制诊断信息', diagnosticsCopied: '已复制脱敏诊断信息。', diagnosticsCopyFailed: '无法复制诊断信息。',
  filterAll: '全部', filterCategory: '类别', filterManagementPlane: '管理平面', filterPolicy: '策略', filterVerification: '验证', filterRuntime: '运行状态', filterAnomalies: '仅异常项',
  capabilityName: '名称：{name}', presetManaged: '由 Agent Preset 管理', effectiveDisabled: '当前有效：停用', effectiveEnabled: '当前有效：启用', detailsShow: '查看机器证据', detailsHide: '收起机器证据', lockReason: '锁定原因',
  mutationControls: '写入控制', forceEnable: '强制启用', forceDisable: '强制禁用', restoreInheritance: '恢复继承', controlsUnavailable: '此条目没有可执行控制', mutationFailed: '操作失败：{message}', mutationSubmitted: '已提交。已重新读取服务端状态；刷新页面后客户端效果才会更新。', restoreSubmitted: '已恢复 profile 继承。已重新读取服务端状态；DSH profile/HMR 重组期间有效状态可能暂时不同。',
  expectedPackage: '预期包', reviewed: '是否已审阅', reviewedReference: '审阅引用 / 溯源', declaredInject: '已声明 inject 证据', dependencyEvidence: '依赖证据', leafReview: '叶子审阅结论', compatibilityFindings: '兼容性发现', eligibilityReasons: 'eligibility 原因', limitations: '限制', provides: '提供', consumers: '消费者', profilePersistence: 'Profile 持久化预检',
  yes: '是', no: '否', none: '无', unknown: '未确认', noEvidence: '无可用证据',
  verificationVerified: '已验证', verificationDrifted: '已漂移', verificationUnverified: '未验证', runtimeIdentityMatched: '匹配', runtimeIdentityMismatched: '不匹配', runtimeIdentityUnavailable: '不可用',
  profileInherited: '继承默认值', profileExplicitlyEnabled: '已强制启用', profileExplicitlyDisabled: '已强制禁用', profileUnavailable: '不可用',
  lifecycleInactive: '未挂载', lifecyclePending: '等待依赖', lifecycleLoading: '加载中', lifecycleActive: '运行中', lifecycleFailed: '挂载失败', lifecycleUnloading: '卸载中', lifecycleUnknown: '未确认',
  findingMissingExpectedEntry: '缺少预期条目', findingNewOfficialEntry: '新增官方条目', findingPackageIdentityChanged: '包身份漂移', findingDeclaredInjectChanged: 'inject 漂移', findingBaselinePackageUnknown: '基线包身份未确认', findingDuplicateRuntimeId: '重复 Loader id', findingRuntimeReleaseIdentityUnavailable: '运行时身份不可用', findingRuntimeReleaseIdentityMismatch: '运行时身份不匹配',
  eligibilityNotManageable: '不在可管理 allowlist', eligibilityMissingRuntimeEntry: '缺少运行时条目', eligibilityReviewedBaselineMissing: '缺少审阅基线', eligibilityReviewedSafeLeafEvidenceMissing: '缺少安全叶子证据', eligibilityTargetStructuralDrift: '目标结构漂移', eligibilityGlobalStructuralDrift: '全局结构漂移', eligibilityRuntimeIdentityMismatch: '运行时身份不匹配', eligibilityProfileNotPersistable: 'profile 无法安全写入',
  categoryPresentation: '界面功能', categoryAgent: '模型与 Agent', categoryTransport: '传输', categoryInfrastructure: '系统基础', categoryUnknown: '未确认类别', planeBrowser: '浏览器', planeHost: 'Host', planeAgentPreset: 'Agent Preset', planeUnknown: '未确认平面', policyManageable: '可管理', policyLocked: '已锁定', lockSelf: '插件自身', lockCore: '核心基础设施', lockUnlisted: '未在 allowlist 中', lockExternal: '外部插件',
}

export const en: Record<BuiltinTogglesLocaleKey, string> = {
  tab: 'Built-ins', loading: 'Reading capability inspection…', error: 'Capability inspection is temporarily unavailable.', retry: 'Retry',
  inspectorIntro: 'Inspect every Loader capability in the current Host. Compatibility is an inspection conclusion; mutation eligibility is the server’s separate authorization for one write. Ineligible entries remain visible for inspection.',
  searchPlaceholder: 'Search ID, package, category, or management plane', searchEmpty: 'No matching capabilities.', resultCount: 'Showing {count} / {total} capabilities',
  compatibilityHeading: 'Compatibility / Doctor', compatibilityExplain: 'Unverified only means the Host has not exposed a bindable runtime release identity. It does not mean the system is broken or a capability is unavailable.', runtimeIdentityLabel: 'Runtime identity', noFindings: 'No reportable findings.', copyDiagnostics: 'Copy diagnostics', diagnosticsCopied: 'Redacted diagnostics copied.', diagnosticsCopyFailed: 'Could not copy diagnostics.',
  filterAll: 'All', filterCategory: 'Category', filterManagementPlane: 'Management plane', filterPolicy: 'Policy', filterVerification: 'Verification', filterRuntime: 'Runtime state', filterAnomalies: 'Anomalies only',
  capabilityName: 'Name: {name}', presetManaged: 'Managed by Agent Preset', effectiveDisabled: 'Effective: disabled', effectiveEnabled: 'Effective: enabled', detailsShow: 'Show machine evidence', detailsHide: 'Hide machine evidence', lockReason: 'Lock reason',
  mutationControls: 'Mutation controls', forceEnable: 'Force enable', forceDisable: 'Force disable', restoreInheritance: 'Restore inheritance', controlsUnavailable: 'No executable controls for this entry', mutationFailed: 'Mutation failed: {message}', mutationSubmitted: 'Submitted. The authoritative server state was re-read; refresh to update the loaded client.', restoreSubmitted: 'Profile inheritance restored. The authoritative server state was re-read; effective state may differ temporarily while DSH profile/HMR recomposes.',
  expectedPackage: 'Expected package', reviewed: 'Reviewed', reviewedReference: 'Reviewed reference / provenance', declaredInject: 'Declared inject evidence', dependencyEvidence: 'Dependency evidence', leafReview: 'Leaf review conclusion', compatibilityFindings: 'Compatibility findings', eligibilityReasons: 'Eligibility reasons', limitations: 'Limitations', provides: 'Provides', consumers: 'Consumers', profilePersistence: 'Profile persistence preflight',
  yes: 'Yes', no: 'No', none: 'None', unknown: 'Unknown', noEvidence: 'No available evidence',
  verificationVerified: 'Verified', verificationDrifted: 'Drifted', verificationUnverified: 'Unverified', runtimeIdentityMatched: 'Matched', runtimeIdentityMismatched: 'Mismatched', runtimeIdentityUnavailable: 'Unavailable',
  profileInherited: 'Inherited', profileExplicitlyEnabled: 'Explicitly enabled', profileExplicitlyDisabled: 'Explicitly disabled', profileUnavailable: 'Unavailable',
  lifecycleInactive: 'Inactive', lifecyclePending: 'Pending', lifecycleLoading: 'Loading', lifecycleActive: 'Active', lifecycleFailed: 'Failed', lifecycleUnloading: 'Unloading', lifecycleUnknown: 'Unknown',
  findingMissingExpectedEntry: 'Missing expected entry', findingNewOfficialEntry: 'New official entry', findingPackageIdentityChanged: 'Package identity drift', findingDeclaredInjectChanged: 'Inject drift', findingBaselinePackageUnknown: 'Baseline package identity unknown', findingDuplicateRuntimeId: 'Duplicate Loader ID', findingRuntimeReleaseIdentityUnavailable: 'Runtime identity unavailable', findingRuntimeReleaseIdentityMismatch: 'Runtime identity mismatch',
  eligibilityNotManageable: 'Not in manageable allowlist', eligibilityMissingRuntimeEntry: 'Missing runtime entry', eligibilityReviewedBaselineMissing: 'Missing reviewed baseline', eligibilityReviewedSafeLeafEvidenceMissing: 'Missing safe-leaf evidence', eligibilityTargetStructuralDrift: 'Target structural drift', eligibilityGlobalStructuralDrift: 'Global structural drift', eligibilityRuntimeIdentityMismatch: 'Runtime identity mismatch', eligibilityProfileNotPersistable: 'Profile cannot be safely written',
  categoryPresentation: 'Presentation', categoryAgent: 'Agent', categoryTransport: 'Transport', categoryInfrastructure: 'Infrastructure', categoryUnknown: 'Unknown category', planeBrowser: 'Browser', planeHost: 'Host', planeAgentPreset: 'Agent Preset', planeUnknown: 'Unknown plane', policyManageable: 'Manageable', policyLocked: 'Locked', lockSelf: 'Plugin itself', lockCore: 'Core infrastructure', lockUnlisted: 'Not on allowlist', lockExternal: 'External plugin',
}
