import type { CSSProperties, JSX } from 'react'
import type { BuiltinTogglesTabProps } from './BuiltinTogglesTab.tsx'
import type { InspectionSnapshot } from './inspector-model.ts'

const box: CSSProperties = { border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 10, padding: '12px 14px', background: 'var(--dsw-alias-bg-layer-3)', display: 'flex', flexDirection: 'column', gap: 6 }
const row: CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }
const muted: CSSProperties = { margin: 0, fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-secondary)', overflowWrap: 'anywhere' }
const label: CSSProperties = { margin: 0, fontSize: 14, lineHeight: '20px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' }
const tag: CSSProperties = { borderRadius: 5, padding: '1px 6px', fontSize: 11, lineHeight: '16px', background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-secondary)' }

export function CompatibilitySummary({ snapshot, t }: { snapshot: InspectionSnapshot; t: BuiltinTogglesTabProps['t'] }): JSX.Element {
  const findings = snapshot.compatibility.findings
  return <section style={box} aria-label={t('compatibilityHeading')}>
    <div style={row}><h2 style={label}>{t('compatibilityHeading')}</h2><span style={tag}>{t(`verification${capitalize(snapshot.compatibility.status)}` as never)}</span></div>
    <p style={muted}>{compatibilityExplanation(snapshot, t)}</p>
    <p style={muted}>{t('runtimeIdentityLabel')}: {t(`runtimeIdentity${capitalize(snapshot.compatibility.runtimeIdentity.status)}` as never)}</p>
    {findings.length > 0 ? <div style={row}>{findings.map((finding, index) => <span key={`${finding.code}-${finding.id ?? index}`} style={tag}>{t(`finding${capitalize(finding.code)}` as never)}{finding.id === undefined ? '' : ` · ${finding.id}`}</span>)}</div> : <p style={muted}>{t('noFindings')}</p>}
  </section>
}

function capitalize(value: string): string { return value.replace(/(^|_)([a-z])/g, (_all, _prefix, char: string) => char.toUpperCase()) }

function compatibilityExplanation(snapshot: InspectionSnapshot, t: BuiltinTogglesTabProps['t']): string {
  if (snapshot.compatibility.status === 'drifted') return t('compatibilityExplainDrifted')
  if (snapshot.compatibility.runtimeIdentity.status === 'mismatched') return t('compatibilityExplainIdentityMismatch')
  if (snapshot.compatibility.findings.some((finding) => finding.code === 'baseline_package_unknown')) return t('compatibilityExplainEvidenceIncomplete')
  if (snapshot.compatibility.findings.some((finding) => finding.code !== 'runtime_release_identity_unavailable')) return t('compatibilityExplainUnverified')
  if (snapshot.compatibility.runtimeIdentity.status === 'unavailable') return t('compatibilityExplainIdentityUnavailable')
  return t('compatibilityExplainUnverified')
}
