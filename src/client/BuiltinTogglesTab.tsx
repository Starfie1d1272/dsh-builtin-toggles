/** Capability Inspector UI. Server inspection data is the sole authority. */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type JSX } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { CapabilityCard } from './CapabilityCard.tsx'
import { CompatibilitySummary } from './CompatibilitySummary.tsx'
import { InspectorFilters } from './InspectorFilters.tsx'
import { EMPTY_FILTERS, buildDiagnostics, capabilityFromHash, filterCapabilities, type InspectionSnapshot, type MutationAction } from './inspector-model.ts'
import { fetchInspection, mutateAndRefresh } from './inspector-requests.ts'
import { getCapabilityPresentation, type PresentationLocale } from './presentation.ts'

export type BuiltinTogglesTabProps = PropsRuntime<'settings.plugins.tab'> & PropsLocale<'settings.builtins'>
type View = { status: 'loading' } | { status: 'error' } | { status: 'ready'; snapshot: InspectionSnapshot }
const page: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 14, width: '100%', maxWidth: 900, color: 'var(--dsw-alias-label-primary)' }
const text: CSSProperties = { margin: 0, fontSize: 13, lineHeight: '20px', color: 'var(--dsw-alias-label-secondary)' }
const button: CSSProperties = { border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 6, padding: '5px 9px', background: 'transparent', color: 'var(--dsw-alias-label-primary)', font: 'inherit', fontSize: 12, cursor: 'pointer' }
const error: CSSProperties = { ...text, color: 'var(--dsw-alias-state-error-primary)' }
const list: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10, padding: 0, margin: 0, listStyle: 'none' }

export function BuiltinTogglesTab({ t }: BuiltinTogglesTabProps): JSX.Element {
  const [view, setView] = useState<View>({ status: 'loading' })
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const queue = useRef<Promise<void>>(Promise.resolve())
  const copyTimer = useRef<number | undefined>(undefined)
  const deepLinkId = typeof window === 'undefined' ? null : capabilityFromHash(window.location.hash)
  const presentationLocale = t('presentationLocale') as PresentationLocale

  useEffect(() => () => { if (copyTimer.current !== undefined) window.clearTimeout(copyTimer.current) }, [])

  const load = useCallback(async (silent = false): Promise<void> => {
    if (!silent) setView({ status: 'loading' })
    try {
      setView({ status: 'ready', snapshot: await fetchInspection(fetch) })
    } catch {
      setView((previous) => silent && previous.status === 'ready' ? previous : { status: 'error' })
    }
  }, [])
  useEffect(() => { void load() }, [attempt, load])
  useEffect(() => {
    if (view.status !== 'ready' || deepLinkId === null || typeof document === 'undefined') return
    const target = [...document.querySelectorAll<HTMLElement>('[data-capability-id]')]
      .find((element) => element.dataset.capabilityId === deepLinkId)
    target?.scrollIntoView({ block: 'center' })
    target?.focus({ preventScroll: true })
  }, [deepLinkId, view])

  const mutate = useCallback((id: string, action: MutationAction): void => {
    const run = async (): Promise<void> => {
      setBusyId(id); setMessage(null)
      let succeeded = false
      try {
        const snapshot = await mutateAndRefresh(fetch, id, action)
        setView({ status: 'ready', snapshot })
        succeeded = true
      } catch (cause) { setMessage(t('mutationFailed', { message: cause instanceof Error ? cause.message : String(cause) })) }
      finally {
        setBusyId(null)
        // POST success is not an effective-state prediction: especially restore
        // waits for the profile/HMR recomposition and displays the next server read.
        if (!succeeded) await load(true)
        if (succeeded) setMessage(t(action === 'restore-inheritance' ? 'restoreSubmitted' : 'mutationSubmitted'))
      }
    }
    queue.current = queue.current.then(run, run)
  }, [load, t])

  const copyDiagnostics = useCallback(async (snapshot: InspectionSnapshot): Promise<void> => {
    try { await navigator.clipboard.writeText(buildDiagnostics(snapshot)); setCopyStatus('copied') }
    catch { setCopyStatus('failed') }
    if (copyTimer.current !== undefined) window.clearTimeout(copyTimer.current)
    copyTimer.current = window.setTimeout(() => setCopyStatus('idle'), 3000)
  }, [])
  const presentation = useCallback((capability: import('./inspector-model.ts').Capability) => getCapabilityPresentation(presentationLocale, capability), [presentationLocale])
  const visible = useMemo(() => view.status === 'ready' ? filterCapabilities(view.snapshot, filters, presentation) : [], [view, filters, presentation])

  if (view.status === 'loading') return <div style={page} aria-busy="true"><p style={text}>{t('loading')}</p></div>
  if (view.status === 'error') return <div style={page} role="alert"><p style={error}>{t('error')}</p><button type="button" style={button} onClick={() => setAttempt((value) => value + 1)}>{t('retry')}</button></div>
  const { snapshot } = view
  return <div style={page}>
    <p style={text}>{t('inspectorIntro')}</p>
    <CompatibilitySummary snapshot={snapshot} t={t} />
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <p style={text}>{t('resultCount', { count: String(visible.length), total: String(snapshot.inventory.totalEntries) })}</p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button type="button" style={button} onClick={() => void copyDiagnostics(snapshot)}>{copyStatus === 'copied' ? t('copyCopied') : t('copyDiagnostics')}</button>
        {/* Copy feedback lives next to the button it came from; role=status keeps it announced. */}
        {copyStatus === 'idle' ? null : <span role="status" style={copyStatus === 'failed' ? error : text}>{copyStatus === 'copied' ? t('copyCopied') : t('copyFailed')}</span>}
      </div>
    </div>
    <InspectorFilters snapshot={snapshot} filters={filters} onChange={setFilters} t={t} />
    {message === null ? null : <p style={text} role="status">{message}</p>}
    {visible.length === 0 ? <p style={text}>{t('searchEmpty')}</p> : <ul style={list}>{visible.map((capability, index) => <CapabilityCard key={`${capability.id}-${index}`} domId={`capability-${index}`} capability={capability} presentation={presentation(capability)} snapshot={snapshot} busy={busyId === capability.id} initiallyExpanded={deepLinkId === capability.id} onMutate={mutate} t={t} />)}</ul>}
  </div>
}
