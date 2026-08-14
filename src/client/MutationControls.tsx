import type { CSSProperties, JSX } from 'react'
import type { BuiltinTogglesTabProps } from './BuiltinTogglesTab.tsx'
import { availableActions, type Capability, type MutationAction } from './inspector-model.ts'

const row: CSSProperties = { display: 'flex', gap: 6, flexWrap: 'wrap' }
const button: CSSProperties = { border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 6, padding: '4px 8px', background: 'transparent', color: 'var(--dsw-alias-label-primary)', font: 'inherit', fontSize: 12, cursor: 'pointer' }
const muted: CSSProperties = { margin: 0, fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-secondary)' }

export function MutationControls({ capability, busy, onMutate, t }: { capability: Capability; busy: boolean; onMutate: (id: string, action: MutationAction) => void; t: BuiltinTogglesTabProps['t'] }): JSX.Element {
  const actions = availableActions(capability)
  if (actions.length === 0) return <p style={muted}>{t('controlsUnavailable')}: {capability.mutationEligibility.reasons.map((reason) => t(`eligibility${capitalize(reason)}` as never)).join(', ') || t('unknown')}</p>
  return <div style={row} aria-label={t('mutationControls')}>
    {actions.includes('force-enable') ? <button type="button" style={button} disabled={busy} onClick={() => onMutate(capability.id, 'force-enable')}>{t('forceEnable')}</button> : null}
    {actions.includes('force-disable') ? <button type="button" style={button} disabled={busy} onClick={() => onMutate(capability.id, 'force-disable')}>{t('forceDisable')}</button> : null}
    {actions.includes('restore-inheritance') ? <button type="button" style={button} disabled={busy} onClick={() => onMutate(capability.id, 'restore-inheritance')}>{t('restoreInheritance')}</button> : null}
  </div>
}

function capitalize(value: string): string { return value.replace(/(^|_)([a-z])/g, (_all, _prefix, char: string) => char.toUpperCase()) }
