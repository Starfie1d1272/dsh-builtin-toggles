/**
 * Built-ins tab: Settings → Plugins → Built-ins (内置插件).
 *
 * v0.2.0 — an official built-in plugin CATALOG plus the small allowlisted
 * toggle set:
 *
 * - Section A (可管理) lists the manageable allowlisted entries with a real
 *   switch. Section B (其他内置插件) lists every other official built-in as
 *   locked rows (collapsed by default) so users can see why most built-ins
 *   cannot be turned off.
 * - Every row is annotated from the display-only catalog (catalog.zh.ts):
 *   Chinese title, one-sentence summary, category tag, and — on request —
 *   the impact/recommendation for manageable rows or the lock/status note
 *   for locked rows. Preset-managed rows (tool-*, plan-mode, …) show the
 *   "由 Agent 预设管理" tag and a status note instead of a misleading
 *   "已停用" label.
 * - A local search box filters title / summary / loader id / package name;
 *   it never hits the network.
 *
 * SECURITY: manageability comes ONLY from the server snapshot
 * (the `manageable` field, from policy.ts). The catalog never carries
 * an authorization field, and a locked row never renders a switch. The server
 * re-checks every rule on every POST; hiding a button is never a security
 * boundary.
 *
 * The server is the authority: after every toggle the snapshot is re-read,
 * and failures re-read it too instead of trusting optimistic local state.
 * Mutations are serialized — only one toggle request runs at a time.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type JSX } from "react"
import type { PropsLocale, PropsRuntime } from "@deepseek-ai/dsh-client-ui-slots"
import type { BuiltinTogglesLocaleKey } from "./locales.ts"
import {
  matchesSearch,
  PRESET_MANAGED,
  type BuiltinCatalogEntry,
} from "./catalog.ts"
import { getBuiltinCatalogEntry } from "./catalog.zh.ts"

/** One row of GET /api/builtin-toggles (structurally mirrors the server DTO). */
export interface SnapshotPlugin {
  id: string
  name: string
  disabled: boolean
  phase: string | null
  manageable: boolean
  reason?: "self" | "core" | "unlisted" | "external"
}

/** Full component props assembled by the Settings slot renderer. */
export type BuiltinTogglesTabProps =
  PropsRuntime<"settings.plugins.tab">
  & PropsLocale<"settings.builtins">

type ViewState =
  | { readonly status: "loading" }
  | { readonly status: "error" }
  | { readonly status: "ready"; readonly plugins: SnapshotPlugin[] }

const API = "/api/builtin-toggles"

/* ── tokens (official design language: CSS variables, never hard-coded light) ── */

const sectionStyle: CSSProperties = {
  display: "flex", flexDirection: "column", gap: 14, width: "100%", maxWidth: 760,
  color: "var(--dsw-alias-label-primary)",
}
const headingStyle: CSSProperties = {
  margin: 0, fontSize: 15, lineHeight: "22px", fontWeight: 600,
  color: "var(--dsw-alias-label-primary)",
}
const introStyle: CSSProperties = {
  margin: 0, fontSize: 13, lineHeight: "20px", color: "var(--dsw-alias-label-tertiary)",
}
const statusLineStyle: CSSProperties = {
  margin: 0, fontSize: 13, lineHeight: "20px", color: "var(--dsw-alias-label-tertiary)",
}
const errorStyle: CSSProperties = {
  margin: 0, fontSize: 13, lineHeight: "20px", color: "var(--dsw-alias-state-error-primary)",
}
const retryButtonStyle: CSSProperties = {
  border: "1px solid var(--dsw-alias-border-l2)", color: "var(--dsw-alias-label-primary)",
  font: "inherit", cursor: "pointer", background: "transparent", borderRadius: 6,
  padding: "4px 10px", fontSize: 13,
}
const searchInputStyle: CSSProperties = {
  width: "100%", boxSizing: "border-box",
  border: "1px solid var(--dsw-alias-border-l2)", borderRadius: 8,
  background: "var(--dsw-alias-bg-layer-1)", color: "var(--dsw-alias-label-primary)",
  font: "inherit", fontSize: 13, lineHeight: "20px", padding: "7px 10px",
  outline: "none",
}
const blockStyle: CSSProperties = {
  display: "flex", flexDirection: "column", gap: 10, margin: 0, padding: 0, listStyle: "none",
}
const cardStyle: CSSProperties = {
  border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-3)",
  borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 0,
}
const cardRowStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 12,
}
const cardMainStyle: CSSProperties = { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }
const titleLineStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, minWidth: 0,
}
const titleStyle: CSSProperties = {
  margin: 0, fontSize: 14, lineHeight: "20px", fontWeight: 600,
  color: "var(--dsw-alias-label-primary)", overflowWrap: "anywhere",
}
const idStyle: CSSProperties = {
  margin: 0, fontSize: 11, lineHeight: "16px", color: "var(--dsw-alias-label-tertiary)",
  fontFamily: "var(--ds-font-family-code)", overflowWrap: "anywhere",
}
const descStyle: CSSProperties = {
  margin: 0, fontSize: 12, lineHeight: "18px", color: "var(--dsw-alias-label-secondary)",
}
const tagBaseStyle: CSSProperties = {
  borderRadius: 5, padding: "1px 6px", fontSize: 11, lineHeight: "16px",
  whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums",
}
const categoryTagStyle: CSSProperties = {
  ...tagBaseStyle, color: "var(--dsw-alias-label-secondary)",
  background: "var(--dsw-alias-bg-layer-1)",
}
const enabledTagStyle: CSSProperties = {
  ...tagBaseStyle, color: "var(--dsw-alias-state-success-primary)",
  background: "color-mix(in srgb, var(--dsw-alias-state-success-primary) 10%, transparent)",
}
const disabledTagStyle: CSSProperties = { ...tagBaseStyle, color: "var(--dsw-alias-label-tertiary)" }
const lockedTagStyle: CSSProperties = {
  ...tagBaseStyle, color: "var(--dsw-alias-label-tertiary)",
  background: "color-mix(in srgb, var(--dsw-alias-state-error-primary) 8%, transparent)",
}
const presetTagStyle: CSSProperties = {
  ...tagBaseStyle, color: "var(--dsw-alias-state-business-primary)",
  background: "color-mix(in srgb, var(--dsw-alias-state-business-primary) 10%, transparent)",
}
const unknownTagStyle: CSSProperties = {
  ...tagBaseStyle, color: "var(--dsw-alias-label-tertiary)",
  background: "var(--dsw-alias-bg-layer-1)", borderStyle: "dashed", borderWidth: 1,
  borderColor: "var(--dsw-alias-border-l2)",
}
const detailsButtonStyle: CSSProperties = {
  border: "none", background: "transparent", padding: 0, cursor: "pointer",
  font: "inherit", fontSize: 12, lineHeight: "18px", color: "var(--dsw-alias-label-secondary)",
  alignSelf: "flex-start", marginTop: 4,
}
const detailStyle: CSSProperties = {
  marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--dsw-alias-border-l2)",
  display: "flex", flexDirection: "column", gap: 6,
}
const detailBlockStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 1 }
const detailLabelStyle: CSSProperties = {
  margin: 0, fontSize: 11, lineHeight: "16px", fontWeight: 600,
  color: "var(--dsw-alias-label-tertiary)",
}
const detailTextStyle: CSSProperties = {
  margin: 0, fontSize: 12, lineHeight: "18px", color: "var(--dsw-alias-label-secondary)",
  whiteSpace: "pre-wrap", overflowWrap: "anywhere",
}
const toggleButtonStyle: CSSProperties = {
  border: "1px solid var(--dsw-alias-border-l2)", color: "var(--dsw-alias-label-secondary)",
  font: "inherit", fontSize: 12, cursor: "pointer", background: "transparent", borderRadius: 6, padding: "3px 8px",
}

/* ── a11y switch ──────────────────────────────────────────────────────────── */

const switchStyle: CSSProperties = {
  position: "relative", flex: "none", width: 36, height: 20, borderRadius: 999,
  border: "none", padding: 0, cursor: "pointer",
  background: "var(--dsw-alias-bg-layer-1)",
  boxShadow: "inset 0 0 0 1px var(--dsw-alias-border-l2)",
  transition: "background .14s var(--ds-ease-in-out)",
}
const switchOnStyle: CSSProperties = {
  ...switchStyle, background: "var(--dsw-alias-state-business-primary)",
  boxShadow: "none",
}
const switchDisabledStyle: CSSProperties = { ...switchStyle, cursor: "default", opacity: 0.55 }
const knobStyle: CSSProperties = {
  position: "absolute", top: 2, left: 2, width: 16, height: 16, borderRadius: 999,
  background: "var(--dsw-alias-bg-base)",
  transition: "transform .14s var(--ds-ease-in-out)",
}
const knobOnStyle: CSSProperties = { ...knobStyle, transform: "translateX(16px)" }

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

/* ── helpers ──────────────────────────────────────────────────────────────── */

function phaseKey(phase: string | null): BuiltinTogglesLocaleKey | null {
  if (phase === null) return "phaseUnobserved"
  switch (phase) {
    case "pending": return "phasePending"
    case "loading": return "phaseLoading"
    case "active": return "phaseActive"
    case "failed": return "phaseFailed"
    case "unloading": return "phaseUnloading"
    default: return null
  }
}

const REASON_KEY: Record<string, BuiltinTogglesLocaleKey> = {
  self: "reasonSelf",
  core: "reasonCore",
  unlisted: "reasonUnlisted",
  external: "reasonExternal",
}

/** One rendered card. Manageability comes from the snapshot, never the catalog. */
function PluginCard(props: {
  plugin: SnapshotPlugin
  entry: BuiltinCatalogEntry
  t: BuiltinTogglesTabProps["t"]
  busy: boolean
  expanded: boolean
  onToggleExpanded: () => void
  onToggle: (id: string, disabled: boolean) => void
}): JSX.Element {
  const { plugin, entry, t, busy, expanded, onToggleExpanded, onToggle } = props
  const presetManaged = PRESET_MANAGED.has(plugin.id)
  const on = !plugin.disabled
  const phase = phaseKey(plugin.phase)
  const manageable = plugin.manageable === true

  // Progressive disclosure content.
  const hasManageableDetails = manageable && (entry.impact !== undefined || entry.recommendation !== undefined)
  const hasLockedDetails = !manageable && (entry.lockNote !== undefined || entry.statusNote !== undefined)
  const hasDetails = hasManageableDetails || hasLockedDetails

  return (
    <li style={cardStyle} aria-busy={busy || undefined}>
      <div style={cardRowStyle}>
        <div style={cardMainStyle}>
          <div style={titleLineStyle}>
            <h3 style={titleStyle}>{entry.title}</h3>
            <span style={categoryTagStyle}>{entry.category}</span>
          </div>
          <p style={idStyle}>
            {plugin.id}
            {plugin.name !== "" ? " · " + plugin.name : ""}
          </p>
          <p style={descStyle}>{entry.summary}</p>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2, flexWrap: "wrap" }}>
            {manageable ? (
              <span style={on ? enabledTagStyle : disabledTagStyle}>
                {on ? t("enabled") : t("disabled")}
              </span>
            ) : presetManaged ? (
              // Root-level disabled is NORMAL for preset-assembled capabilities:
              // never present it as "feature is off".
              <span style={presetTagStyle}>{t("presetManaged")}</span>
            ) : (
              <span style={lockedTagStyle} title={t("reasonLabel")}>
                {plugin.reason !== undefined ? t(REASON_KEY[plugin.reason] ?? "reasonUnlisted") : t("reasonUnlisted")}
              </span>
            )}
            {entry.unknown === true ? <span style={unknownTagStyle}>{t("unknownNote")}</span> : null}
            {manageable && phase !== null ? <span style={tagBaseStyle}>{t(phase)}</span> : null}
            {busy ? <span style={tagBaseStyle}>{t("busy")}</span> : null}
          </div>
        </div>
        {manageable ? (
          <Switch
            on={on}
            disabled={busy}
            label={t(on ? "toggleDisable" : "toggleEnable", { name: plugin.id })}
            onToggle={() => { onToggle(plugin.id, on) }}
          />
        ) : null}
      </div>
      {hasDetails ? (
        <button type="button" style={detailsButtonStyle} aria-expanded={expanded} onClick={onToggleExpanded}>
          {expanded ? t("detailsHide") : t("detailsShow")}
        </button>
      ) : null}
      {expanded && hasDetails ? (
        <div style={detailStyle}>
          {manageable ? (
            <>
              {entry.impact !== undefined ? (
                <div style={detailBlockStyle}>
                  <p style={detailLabelStyle}>{t("impactLabel")}</p>
                  <p style={detailTextStyle}>{entry.impact}</p>
                </div>
              ) : null}
              {entry.recommendation !== undefined ? (
                <div style={detailBlockStyle}>
                  <p style={detailLabelStyle}>{t("recommendationLabel")}</p>
                  <p style={detailTextStyle}>{entry.recommendation}</p>
                </div>
              ) : null}
            </>
          ) : (
            <>
              {entry.lockNote !== undefined ? (
                <div style={detailBlockStyle}>
                  <p style={detailLabelStyle}>{t("lockNoteLabel")}</p>
                  <p style={detailTextStyle}>{entry.lockNote}</p>
                </div>
              ) : null}
              {entry.statusNote !== undefined ? (
                <div style={detailBlockStyle}>
                  <p style={detailLabelStyle}>{t("statusNoteLabel")}</p>
                  <p style={detailTextStyle}>{entry.statusNote}</p>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </li>
  )
}

/* ── the tab ──────────────────────────────────────────────────────────────── */

export function BuiltinTogglesTab({ t }: BuiltinTogglesTabProps): JSX.Element {
  const [view, setView] = useState<ViewState>({ status: "loading" })
  const [busyId, setBusyId] = useState<string | null>(null)
  const [toggleError, setToggleError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [showLocked, setShowLocked] = useState(false)
  const [query, setQuery] = useState("")
  const [expanded, setExpanded] = useState<Readonly<Record<string, boolean>>>({})
  const [attempt, setAttempt] = useState(0)
  const queue = useRef<Promise<void>>(Promise.resolve())

  const load = useCallback(async (silent = false) => {
    if (!silent) setView({ status: "loading" })
    try {
      const res = await fetch(API)
      if (!res.ok) throw new Error("HTTP " + res.status)
      const data = (await res.json()) as { plugins: SnapshotPlugin[] }
      setView({ status: "ready", plugins: data.plugins })
    } catch {
      // A silent refresh failure keeps the last good snapshot; only the
      // initial load (or an explicit retry) surfaces the error state.
      setView((previous) => (silent && previous.status === "ready" ? previous : { status: "error" }))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, attempt])

  const toggle = useCallback((id: string, disabled: boolean): void => {
    const run = async (): Promise<void> => {
      setBusyId(id)
      setToggleError(null)
      setNotice(null)
      let succeeded = false
      try {
        const res = await fetch(API + "/" + encodeURIComponent(id), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ disabled }),
        })
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { message?: string } | null
          throw new Error(data?.message ?? "HTTP " + res.status)
        }
        succeeded = true
      } catch (error) {
        setToggleError(error instanceof Error ? error.message : String(error))
      } finally {
        setBusyId(null)
        // The server is the authority: re-read the snapshot on success AND on
        // failure so the UI never shows optimistic state that did not stick.
        await load(true)
        // rc.6 behavior (verified in real-browser E2E): the Host state
        // changes immediately, but an already-open page keeps its loaded
        // client bundle — the effect lands on the next page load.
        if (succeeded) setNotice(t("refreshHint"))
      }
    }
    queue.current = queue.current.then(run, run)
  }, [load, t])

  const toggleExpanded = useCallback((id: string): void => {
    setExpanded((previous) => ({ ...previous, [id]: !(previous[id] ?? false) }))
  }, [])

  // Display-only annotation; manageability always comes from the snapshot.
  const annotate = (plugin: SnapshotPlugin): { plugin: SnapshotPlugin; entry: BuiltinCatalogEntry } => ({
    plugin,
    entry: getBuiltinCatalogEntry(plugin.id, plugin.name),
  })

  const searchMatch = (row: { plugin: SnapshotPlugin; entry: BuiltinCatalogEntry }): boolean =>
    matchesSearch(query, {
      title: row.entry.title,
      summary: row.entry.summary,
      id: row.plugin.id,
      moduleName: row.plugin.name,
    })

  // NOTE: every hook must run on EVERY render (Rules of Hooks) — these
  // memos are computed before the loading/error early returns below.
  const readyPlugins = view.status === "ready" ? view.plugins : []
  const manageable = useMemo(() => readyPlugins.filter((plugin) => plugin.manageable).map(annotate), [readyPlugins])
  const locked = useMemo(() => readyPlugins.filter((plugin) => !plugin.manageable).map(annotate), [readyPlugins])

  if (view.status === "loading") {
    return (
      <div style={sectionStyle} aria-busy="true">
        <p style={statusLineStyle}>{t("loading")}</p>
      </div>
    )
  }
  if (view.status === "error") {
    return (
      <div style={sectionStyle} role="alert">
        <p style={errorStyle}>{t("error")}</p>
        <div>
          <button type="button" style={retryButtonStyle} onClick={() => setAttempt((n) => n + 1)}>
            {t("retry")}
          </button>
        </div>
      </div>
    )
  }

  const isSearching = query.trim().length > 0
  const manageableFiltered = isSearching ? manageable.filter(searchMatch) : manageable
  const lockedFiltered = isSearching ? locked.filter(searchMatch) : locked
  // Searching temporarily auto-expands the locked section; clearing the query
  // restores the previous collapsed state.
  const showLockedSection = isSearching ? true : showLocked
  const lockedCount = isSearching ? lockedFiltered.length : locked.length
  const emptyResult = isSearching && manageableFiltered.length === 0 && lockedFiltered.length === 0

  return (
    <div style={sectionStyle}>
      <p style={introStyle}>{t("intro")}</p>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("searchPlaceholder")}
        aria-label={t("searchPlaceholder")}
        style={searchInputStyle}
      />
      {toggleError !== null ? (
        <p style={errorStyle} role="alert">{t("toggleFailed", { message: toggleError })}</p>
      ) : null}
      {notice !== null ? (
        <p style={{ ...statusLineStyle, color: "var(--dsw-alias-state-success-primary)" }} role="status">
          {notice}
        </p>
      ) : null}

      <h2 style={headingStyle}>{t("manageableHeading")}</h2>
      {manageableFiltered.length > 0 ? (
        <ul style={blockStyle}>
          {manageableFiltered.map(({ plugin, entry }) => (
            <PluginCard
              key={plugin.id}
              plugin={plugin}
              entry={entry}
              t={t}
              busy={busyId === plugin.id}
              expanded={expanded[plugin.id] ?? false}
              onToggleExpanded={() => { toggleExpanded(plugin.id) }}
              onToggle={toggle}
            />
          ))}
        </ul>
      ) : null}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
        <h2 style={{ ...headingStyle, margin: 0 }}>{t("lockedHeading")}</h2>
        <button
          type="button"
          style={toggleButtonStyle}
          aria-expanded={showLockedSection}
          onClick={() => setShowLocked((v) => !v)}
        >
          {showLockedSection ? t("hideLocked") : t("lockedHint") + " · " + String(lockedCount)}
        </button>
      </div>
      {emptyResult ? (
        <p style={statusLineStyle}>{t("searchEmpty")}</p>
      ) : showLockedSection ? (
        <ul style={blockStyle}>
          {lockedFiltered.map(({ plugin, entry }) => (
            <PluginCard
              key={plugin.id}
              plugin={plugin}
              entry={entry}
              t={t}
              busy={busyId === plugin.id}
              expanded={expanded[plugin.id] ?? false}
              onToggleExpanded={() => { toggleExpanded(plugin.id) }}
              onToggle={toggle}
            />
          ))}
        </ul>
      ) : null}
    </div>
  )
}
