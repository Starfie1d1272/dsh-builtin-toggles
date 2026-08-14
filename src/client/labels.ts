import type { BuiltinTogglesTabProps } from './BuiltinTogglesTab.tsx'

type Translate = BuiltinTogglesTabProps['t']

export function categoryLabel(t: Translate, value: string): string { return t(`category${capitalize(value)}` as never) }
export function planeLabel(t: Translate, value: string): string { return t(`plane${capitalize(value)}` as never) }
export function policyLabel(t: Translate, value: string): string { return t(`policy${capitalize(value)}` as never) }
export function lockLabel(t: Translate, value: string): string { return t(`lock${capitalize(value)}` as never) }
export function lifecycleLabel(t: Translate, value: string): string { return t(`lifecycle${capitalize(value)}` as never) }
export function verificationLabel(t: Translate, value: string): string { return t(`verification${capitalize(value)}` as never) }

function capitalize(value: string): string { return value.replace(/(^|[-_])([a-z])/g, (_all, _prefix, char: string) => char.toUpperCase()) }
