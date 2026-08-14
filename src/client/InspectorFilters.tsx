import type { CSSProperties, JSX } from 'react'
import type { BuiltinTogglesTabProps } from './BuiltinTogglesTab.tsx'
import { categoryLabel, lifecycleLabel, planeLabel, policyLabel } from './labels.ts'
import type { InspectorFilters as Filters, InspectionSnapshot } from './inspector-model.ts'

const wrap: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }
const control: CSSProperties = { boxSizing: 'border-box', minWidth: 0, border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 6, background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)', font: 'inherit', fontSize: 12, padding: '6px 8px' }

export function InspectorFilters({ snapshot, filters, onChange, t }: { snapshot: InspectionSnapshot; filters: Filters; onChange: (next: Filters) => void; t: BuiltinTogglesTabProps['t'] }): JSX.Element {
  const categories = unique(snapshot.capabilities.map((capability) => capability.category))
  const planes = unique(snapshot.capabilities.map((capability) => capability.managementPlane))
  const lifecycles = unique(snapshot.capabilities.map((capability) => capability.runtimeState.lifecycle))
  const select = (field: keyof Filters, values: readonly string[], label: string, format: (value: string) => string = (value) => value) => <select aria-label={label} style={control} value={filters[field] as string} onChange={(event) => onChange({ ...filters, [field]: event.target.value })}><option value="all">{t('filterAll')}</option>{values.map((value) => <option value={value} key={value}>{format(value)}</option>)}</select>
  return <div style={wrap}>
    <input type="search" aria-label={t('searchPlaceholder')} placeholder={t('searchPlaceholder')} style={control} value={filters.query} onChange={(event) => onChange({ ...filters, query: event.target.value })} />
    {select('category', categories, t('filterCategory'), (value) => categoryLabel(t, value))}
    {select('managementPlane', planes, t('filterManagementPlane'), (value) => planeLabel(t, value))}
    {select('policy', ['manageable', 'locked'], t('filterPolicy'), (value) => policyLabel(t, value))}
    {select('verification', ['verified', 'drifted', 'unverified'], t('filterVerification'))}
    {select('runtime', lifecycles, t('filterRuntime'), (value) => lifecycleLabel(t, value))}
    <label style={{ ...control, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={filters.anomaliesOnly} onChange={(event) => onChange({ ...filters, anomaliesOnly: event.target.checked })} />{t('filterAnomalies')}</label>
  </div>
}

function unique(values: readonly string[]): string[] { return [...new Set(values)].sort() }
