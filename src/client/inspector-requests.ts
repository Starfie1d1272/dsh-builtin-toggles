import type { InspectionSnapshot, MutationAction } from './inspector-model.ts'

export const INSPECTION_API = '/api/builtin-toggles/v1/inspection'
const MUTATION_API = '/api/builtin-toggles'
const RESTORE_FOLLOW_UP_READS = 2
const RESTORE_RECHECK_DELAY_MS = 125

export interface MutationRequestOptions {
  wait?: (milliseconds: number) => Promise<void>
  restoreFollowUpReads?: number
}

export async function fetchInspection(fetcher: typeof fetch): Promise<InspectionSnapshot> {
  const response = await fetcher(INSPECTION_API)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return await response.json() as InspectionSnapshot
}

/** Never derives a predicted effective state: POST is followed by a fresh GET. */
export async function mutateAndRefresh(fetcher: typeof fetch, id: string, action: MutationAction, options: MutationRequestOptions = {}): Promise<InspectionSnapshot> {
  const response = await fetcher(`${MUTATION_API}/${encodeURIComponent(id)}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null
    throw new Error(body?.message ?? `HTTP ${response.status}`)
  }
  let snapshot = await fetchInspection(fetcher)
  if (action !== 'restore-inheritance') return snapshot
  const wait = options.wait ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)))
  const reads = options.restoreFollowUpReads ?? RESTORE_FOLLOW_UP_READS
  for (let attempt = 0; attempt < reads; attempt += 1) {
    try {
      await wait(RESTORE_RECHECK_DELAY_MS)
      snapshot = await fetchInspection(fetcher)
    } catch {
      // A completed mutation still leaves the most recent authoritative state
      // visible; follow-up reads are convergence aids, not a state prediction.
      break
    }
  }
  return snapshot
}
