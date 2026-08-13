/**
 * Built-ins tab: Settings → Plugins → Built-ins.
 *
 * Section A lists the manageable allowlisted entries with a real switch.
 * Section B lists every other official built-in as locked rows (collapsed by
 * default), so users can see why most built-ins cannot be turned off.
 *
 * The server is the authority: after every toggle the snapshot is re-read,
 * and failures re-read it too instead of trusting optimistic local state.
 * Mutations are serialized — only one toggle request runs at a time.
 */

import { useCallback, useEffect, useRef, useState, type CSSProperties, type JSX } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { BuiltinTogglesLocaleKey } from './locales.ts'

/** One row of GET /api/builtin-toggles (structurally mirrors the server DTO). */
export interface SnapshotPlugin {
  id: string
  name: string
  disabled: boolean
  phase: string | null
  manageable: boolean
  reason?: 'self' | 'core' | 'unlisted' | 'external'
}

/** Full component props assembled by the Settings slot renderer. */
export type BuiltinTogglesTabProps =
  PropsRuntime<'settings.plugins.tab'>
  & PropsLocale<'settings.builtins'>

type ViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly plugins: SnapshotPlugin[] }

const API = '/api/builtin-toggles'

/* ── tokens (official design language: CSS variables, never hard-coded light) ── */

const sectionStyle: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 14, width: '100%', maxWidth: 760,
  color: 'var(--dsw-alias-label-primary)',
}
const headingStyle: CSSProperties = {
  margin: 0, fontSize: 15, lineHeight: '22px', fontWeight: 600,
  color: 'var(--dsw-alias-label-primary)',
}
const introStyle: CSSProperties = {
  margin: 0, fontSize: 13, lineHeight: '20px', color: 'var(--dsw-alias-label-tertiary)',
}
const statusLineStyle: CSSProperties = {
  margin: 0, fontSize: 13, lineHeight: '20px', color: 'var(--dsw-alias-label-tertiary)',
}
const errorStyle: CSSProperties = {
  margin: 0, fontSize: 13, lineHeight: '20px', color: 'var(--dsw-alias-state-error-primary)',
}
const retryButtonStyle: CSSProperties = {
  border: '1px solid var(--dsw-alias-border-l2)', color: 'var(--dsw-alias-label-primary)',
  font: 'inherit', cursor: 'pointer', background: 'transparent', borderRadius: 6,
  padding: '4px 10px', fontSize: 13,
}
const blockStyle: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 10, margin: 0, padding: 0, listStyle: 'none',
}
const cardStyle: CSSProperties = {
  border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-layer-3)',
  borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12,
}
const cardMainStyle: CSSProperties = { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }
const nameStyle: CSSProperties = {
  margin: 0, fontSize: 14, lineHeight: '20px', fontWeight: 600,
  color: 'var(--dsw-alias-label-primary)', overflowWrap: 'anywhere',
}
const idStyle: CSSProperties = {
  margin: 0, fontSize: 11, lineHeight: '16px', color: 'var(--dsw-alias-label-tertiary)',
  fontFamily: 'var(--ds-font-family-code)', overflowWrap: 'anywhere',
}
const descStyle: CSSProperties = {
  margin: 0, fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-secondary)',
}
const statusTagStyle: CSSProperties = {
  background: 'var(--dsw-alias-bg-layer-1)', borderRadius: 5, padding: '1px 6px',
  fontSize: 11, lineHeight: '16px', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
}
const enabledTagStyle: CSSProperties = {
  ...statusTagStyle, color: 'var(--dsw-alias-state-success-primary)',
  background: 'color-mix(in srgb, var(--dsw-alias-state-success-primary) 10%, transparent)',
}
const disabledTagStyle: CSSProperties = { ...statusTagStyle, color: 'var(--dsw-alias-label-tertiary)' }
const lockedTagStyle: CSSProperties = {
  ...statusTagStyle, color: 'var(--dsw-alias-label-tertiary)',
  background: 'color-mix(in srgb, var(--dsw-alias-state-error-primary) 8%, transparent)',
}
const toggleButtonStyle: CSSProperties = {
  border: '1px solid var(--dsw-alias-border-l2)', color: 'var(--dsw-alias-label-secondary)',
  font: 'inherit', fontSize: 12, cursor: 'pointer', background: 'transparent', borderRadius: 6, padding: '3px 8px',
}

/* ── a11y switch ──────────────────────────────────────────────────────────── */

const switchStyle: CSSProperties = {
  position: 'relative', flex: 'none', width: 36, height: 20, borderRadius: 999,
  border: 'none', padding: 0, cursor: 'pointer',
  background: 'var(--dsw-alias-bg-layer-1)',
  boxShadow: 'inset 0 0 0 1px var(--dsw-alias-border-l2)',
  transition: 'background .14s var(--ds-ease-in-out)',
}
const switchOnStyle: CSSProperties = {
  ...switchStyle, background: 'var(--dsw-alias-state-business-primary)',
  boxShadow: 'none',
}
const switchDisabledStyle: CSSProperties = { ...switchStyle, cursor: 'default', opacity: 0.55 }
const knobStyle: CSSProperties = {
  position: 'absolute', top: 2, left: 2, width: 16, height: 16, borderRadius: 999,
  background: 'var(--dsw-alias-bg-base)',
  transition: 'transform .14s var(--ds-ease-in-out)',
}
const knobOnStyle: CSSProperties = { ...knobStyle, transform: 'translateX(16px)' }

function Switch(props: {
  on: boolean
  disabled: boolean
  label: string
  onToggle: () => void
}): JSX.Element {
  const { on, disabled, label, onToggle } = props
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={onToggle}
      style={disabled ? switchDisabledStyle : on ? switchOnStyle : switchStyle}
    >
      <span style={on ? knobOnStyle : knobStyle} aria-hidden="true" />
    </button>
  )
}

/* ── the tab ──────────────────────────────────────────────────────────────── */

function phaseKey(phase: string | null): BuiltinTogglesLocaleKey | null {
  if (phase === null) return 'phaseUnobserved'
  switch (phase) {
    case 'pending': return 'phasePending'
    case 'loading': return 'phaseLoading'
    case 'active': return 'phaseActive'
    case 'failed': return 'phaseFailed'
    case 'unloading': return 'phaseUnloading'
    default: return null
  }
}

const DESCRIPTION: Record<string, BuiltinTogglesLocaleKey> = {
  'ui-deliverables': 'descUiDeliverables',
  'ui-jobs': 'descUiJobs',
  'ui-goal': 'descUiGoal',
  'ui-message-feedback': 'descUiMessageFeedback',
  'ui-model-selection': 'descUiModelSelection',
  'ui-agent-preset': 'descUiAgentPreset',
  'ui-commands': 'descUiCommands',
  'ui-skill': 'descUiSkill',
  'ui-subagent': 'descUiSubagent',
  'ui-trajectory': 'descUiTrajectory',
}

const REASON_KEY: Record<string, BuiltinTogglesLocaleKey> = {
  self: 'reasonSelf',
  core: 'reasonCore',
  unlisted: 'reasonUnlisted',
  external: 'reasonExternal',
}

export function BuiltinTogglesTab({ t }: BuiltinTogglesTabProps): JSX.Element {
  const [view, setView] = useState<ViewState>({ status: 'loading' })
  const [busyId, setBusyId] = useState<string | null>(null)
  const [toggleError, setToggleError] = useState<string | null>(null)
  const [showLocked, setShowLocked] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const queue = useRef<Promise<void>>(Promise.resolve())

  const load = useCallback(async (silent = false) => {
    if (!silent) setView({ status: 'loading' })
    try {
      const res = await fetch(API)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { plugins: SnapshotPlugin[] }
      setView({ status: 'ready', plugins: data.plugins })
    } catch {
      // A silent refresh failure keeps the last good snapshot; only the
      // initial load (or an explicit retry) surfaces the error state.
      setView((previous) => (silent && previous.status === 'ready' ? previous : { status: 'error' }))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, attempt])

  const toggle = useCallback((id: string, disabled: boolean): void => {
    const run = async (): Promise<void> => {
      setBusyId(id)
      setToggleError(null)
      try {
        const res = await fetch(`${API}/${encodeURIComponent(id)}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ disabled }),
        })
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { message?: string } | null
          throw new Error(data?.message ?? `HTTP ${res.status}`)
        }
      } catch (error) {
        setToggleError(error instanceof Error ? error.message : String(error))
      } finally {
        setBusyId(null)
        // The server is the authority: re-read the snapshot on success AND on
        // failure so the UI never shows optimistic state that did not stick.
        await load(true)
      }
    }
    queue.current = queue.current.then(run, run)
  }, [load])

  if (view.status === 'loading') {
    return (
      <div style={sectionStyle} aria-busy="true">
        <p style={statusLineStyle}>{t('loading')}</p>
      </div>
    )
  }
  if (view.status === 'error') {
    return (
      <div style={sectionStyle} role="alert">
        <p style={errorStyle}>{t('error')}</p>
        <div>
          <button type="button" style={retryButtonStyle} onClick={() => setAttempt((n) => n + 1)}>
            {t('retry')}
          </button>
        </div>
      </div>
    )
  }

  const manageable = view.plugins.filter((plugin) => plugin.manageable)
  const locked = view.plugins.filter((plugin) => !plugin.manageable)

  return (
    <div style={sectionStyle}>
      <p style={introStyle}>{t('intro')}</p>
      {toggleError !== null ? (
        <p style={errorStyle} role="alert">{t('toggleFailed', { message: toggleError })}</p>
      ) : null}

      <h2 style={headingStyle}>{t('manageableHeading')}</h2>
      <ul style={blockStyle}>
        {manageable.map((plugin) => {
          const busy = busyId === plugin.id
          const on = !plugin.disabled
          const phase = phaseKey(plugin.phase)
          return (
            <li key={plugin.id} style={cardStyle} aria-busy={busy || undefined}>
              <div style={cardMainStyle}>
                <p style={nameStyle}>{plugin.name.split('/').pop()}</p>
                <p style={idStyle}>{plugin.id}</p>
                {DESCRIPTION[plugin.id] !== undefined ? (
                  <p style={descStyle}>{t(DESCRIPTION[plugin.id]!)}</p>
                ) : null}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                  <span style={on ? enabledTagStyle : disabledTagStyle}>
                    {on ? t('enabled') : t('disabled')}
                  </span>
                  {phase !== null ? <span style={statusTagStyle}>{t(phase)}</span> : null}
                  {busy ? <span style={statusTagStyle}>{t('busy')}</span> : null}
                </div>
              </div>
              <Switch
                on={on}
                disabled={busy || busyId !== null}
                label={t(on ? 'toggleDisable' : 'toggleEnable', { name: plugin.id })}
                onToggle={() => { void toggle(plugin.id, on) }}
              />
            </li>
          )
        })}
      </ul>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
        <h2 style={{ ...headingStyle, margin: 0 }}>{t('lockedHeading')}</h2>
        <button
          type="button"
          style={toggleButtonStyle}
          aria-expanded={showLocked}
          onClick={() => setShowLocked((v) => !v)}
        >
          {showLocked ? t('hideLocked') : t('lockedHint') + ' · ' + String(locked.length)}
        </button>
      </div>
      {showLocked ? (
        <ul style={blockStyle}>
          {locked.map((plugin) => {
            const phase = phaseKey(plugin.phase)
            return (
              <li key={plugin.id} style={cardStyle}>
                <div style={cardMainStyle}>
                  <p style={nameStyle}>{plugin.name.split('/').pop()}</p>
                  <p style={idStyle}>{plugin.id}</p>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                    <span style={lockedTagStyle} title={t('reasonLabel')}>
                      {plugin.reason !== undefined ? t(REASON_KEY[plugin.reason] ?? 'reasonUnlisted') : t('reasonUnlisted')}
                    </span>
                    {phase !== null ? <span style={statusTagStyle}>{t(phase)}</span> : null}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
