import { useState, type CSSProperties, type JSX } from 'react'
import type { BuiltinTogglesTabProps } from './BuiltinTogglesTab.tsx'
import { EvidenceDetails } from './EvidenceDetails.tsx'
import { categoryLabel, lifecycleLabel, lockLabel, planeLabel, policyLabel } from './labels.ts'
import { MutationControls } from './MutationControls.tsx'
import type { Capability, CapabilityPresentation, InspectionSnapshot, MutationAction } from './inspector-model.ts'

const card: CSSProperties = { border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 10, padding: '12px 14px', background: 'var(--dsw-alias-bg-layer-3)' }
const title: CSSProperties = { margin: 0, fontSize: 14, lineHeight: '20px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' }
const text: CSSProperties = { margin: '3px 0 0', fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-secondary)', overflowWrap: 'anywhere' }
const tags: CSSProperties = { display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 7 }
const tag: CSSProperties = { borderRadius: 5, padding: '1px 6px', fontSize: 11, lineHeight: '16px', background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-secondary)' }
const detail: CSSProperties = { border: 'none', background: 'transparent', color: 'var(--dsw-alias-label-secondary)', padding: 0, marginTop: 8, font: 'inherit', fontSize: 12, cursor: 'pointer' }

export function CapabilityCard({ capability, presentation, snapshot, busy, initiallyExpanded, domId, onMutate, t }: { capability: Capability; presentation: CapabilityPresentation; snapshot: InspectionSnapshot; busy: boolean; initiallyExpanded: boolean; domId: string; onMutate: (id: string, action: MutationAction) => void; t: BuiltinTogglesTabProps['t'] }): JSX.Element {
  const [expanded, setExpanded] = useState(initiallyExpanded)
  const override = capability.configuration.profileOverride.state
  return <li id={domId} data-capability-id={capability.id} tabIndex={-1} style={card} aria-busy={busy || undefined}>
    <h3 style={title}>{presentation.title}</h3>
    <p style={text}>{capability.id} · {capability.packageName}</p>
    <p style={text}>{presentation.summary}</p>
    <div style={tags}>
      <span style={tag}>{categoryLabel(t, capability.category)}</span><span style={tag}>{planeLabel(t, capability.managementPlane)}</span><span style={tag}>{t('compositionScope')}: {planeLabel(t, capability.compositionScope)}</span><span style={tag}>{policyLabel(t, capability.policy.status)}</span><span style={tag}>{t(`verification${capitalize(capability.verification)}` as never)}</span><span style={tag}>{t(`profile${capitalize(override)}` as never)}</span><span style={tag}>{lifecycleLabel(t, capability.runtimeState.lifecycle)}</span>
      {capability.configuration.agentPresetManaged ? <span style={tag}>{t('presetManaged')}</span> : null}
      <span style={tag}>{capability.configuration.effectiveDisabled ? t('effectiveDisabled') : t('effectiveEnabled')}</span>{capability.policy.reason === undefined ? null : <span style={tag}>{t('lockReason')}: {lockLabel(t, capability.policy.reason)}</span>}
    </div>
    <div style={{ marginTop: 9 }}><MutationControls capability={capability} snapshot={snapshot} busy={busy} onMutate={onMutate} t={t} /></div>
    <button type="button" style={detail} aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>{expanded ? t('detailsHide') : t('detailsShow')}</button>
    {expanded ? <EvidenceDetails capability={capability} snapshot={snapshot} t={t} /> : null}
  </li>
}

function capitalize(value: string): string { return value.replace(/(^|[-_])([a-z])/g, (_all, _prefix, char: string) => char.toUpperCase()) }
