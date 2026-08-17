import type { CSSProperties, JSX } from 'react'
import type { BuiltinTogglesTabProps } from './BuiltinTogglesTab.tsx'
import type { Capability, InspectionSnapshot } from './inspector-model.ts'

const grid: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(150px, 1fr) minmax(220px, 2fr)', gap: '4px 12px', borderTop: '1px solid var(--dsw-alias-border-l2)', marginTop: 8, paddingTop: 8 }
const key: CSSProperties = { margin: 0, fontSize: 11, lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary)', fontWeight: 600 }
const value: CSSProperties = { margin: 0, fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-secondary)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }

export function EvidenceDetails({ capability, snapshot, t }: { capability: Capability; snapshot: InspectionSnapshot; t: BuiltinTogglesTabProps['t'] }): JSX.Element {
  const findings = snapshot.compatibility.findings.filter((finding) => finding.id === capability.id)
  const dependency = capability.baseline.dependencyEvidence
  const reference = capability.baseline.reviewedReference
  const fields: readonly [string, string][] = [
    [t('compositionScope'), `${capability.compositionScope} · ${capability.scopeId}`],
    [t('expectedPackage'), capability.baseline.expectedPackageName ?? t('noEvidence')],
    [t('reviewed'), capability.baseline.reviewed ? t('yes') : t('no')],
    [t('reviewedReference'), reference === null ? t('noEvidence') : `${reference.source} · ${reference.packageName}@${reference.version} · ${reference.artifact}`],
    [t('declaredInject'), capability.baseline.serviceEvidence.length === 0 ? t('noEvidence') : capability.baseline.serviceEvidence.map((item) => item.expectedServices === null ? t('injectNotDeclared') : item.expectedServices.length === 0 ? t('injectDeclaredEmpty') : item.expectedServices.join(', ')).join('; ')],
    [t('dependencyEvidence'), dependency === null ? t('noEvidence') : `${t('provides')}: ${dependencyStatusLabel(t, dependency.provides.status)}${dependency.provides.services === undefined ? '' : ` (${dependency.provides.services.join(', ')})`} · ${t('consumers')}: ${dependencyStatusLabel(t, dependency.consumers.status)}${dependency.consumers.ids === undefined ? '' : ` (${dependency.consumers.ids.join(', ')})`}`],
    [t('leafReview'), leafReviewLabel(t, capability.baseline.leafReview)],
    [t('compatibilityFindings'), findings.map((finding) => `${findingLabel(t, finding.code)} (${finding.code})`).join('; ') || t('noFindings')],
    [t('profilePersistence'), profilePersistenceLabel(capability, t)],
    [t('eligibilityReasons'), capability.mutationEligibility.reasons.map((reason) => `${eligibilityReasonLabel(t, reason)} (${reason})`).join(', ') || t('none')],
    [t('limitations'), capability.mutationEligibility.limitations.map((limitation) => `${limitationLabel(t, limitation)} (${limitation})`).join(', ') || t('none')],
  ]
  return <dl style={grid}>{fields.map(([field, content]) => <div key={field} style={{ display: 'contents' }}><dt style={key}>{field}</dt><dd style={value}>{content}</dd></div>)}</dl>
}

function capitalize(value: string): string { return value.replace(/(^|_)([a-z])/g, (_all, _prefix, char: string) => char.toUpperCase()) }

function findingLabel(t: BuiltinTogglesTabProps['t'], code: string): string {
  return t(`finding${capitalize(code)}` as never)
}

function eligibilityReasonLabel(t: BuiltinTogglesTabProps['t'], reason: string): string {
  return t(`eligibility${capitalize(reason)}` as never)
}

function limitationLabel(t: BuiltinTogglesTabProps['t'], limitation: string): string {
  return t(`limitation${capitalize(limitation)}` as never)
}

function dependencyStatusLabel(t: BuiltinTogglesTabProps['t'], status: string): string {
  return status === 'observed' ? t('dependencyObserved') : t('unknown')
}

function leafReviewLabel(t: BuiltinTogglesTabProps['t'], leafReview: Capability['baseline']['leafReview']): string {
  if (leafReview === null) return t('noEvidence')
  switch (leafReview) {
    case 'reviewed-safe-ui-leaf': return `${t('leafReviewReviewedSafeUiLeaf')} (${leafReview})`
    case 'locked-dependency': return `${t('leafReviewLockedDependency')} (${leafReview})`
    default: return `${t('leafReviewNotReviewed')} (${leafReview})`
  }
}

function profilePersistenceLabel(capability: Capability, t: BuiltinTogglesTabProps['t']): string {
  if (capability.configuration.profileApplicability === 'not-applicable') return t('profileNotApplicable')
  const status = capability.configuration.profilePersistence.status === 'writable' ? t('profileWritable') : t('profileUnwritable')
  const reason = 'reason' in capability.configuration.profilePersistence && capability.configuration.profilePersistence.reason !== undefined
    ? ` (${capability.configuration.profilePersistence.reason})`
    : ''
  return `${status}${reason}`
}
