import type { InspectionSnapshot, MutationAction } from './inspector-model.ts'

export const INSPECTION_API = '/api/builtin-toggles/v1/inspection'
const MUTATION_API = '/api/builtin-toggles'

export async function fetchInspection(fetcher: typeof fetch): Promise<InspectionSnapshot> {
  const response = await fetcher(INSPECTION_API)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return await response.json() as InspectionSnapshot
}

/** Never derives a predicted effective state: POST is followed by a fresh GET. */
export async function mutateAndRefresh(fetcher: typeof fetch, id: string, action: MutationAction): Promise<InspectionSnapshot> {
  const response = await fetcher(`${MUTATION_API}/${encodeURIComponent(id)}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null
    throw new Error(body?.message ?? `HTTP ${response.status}`)
  }
  return fetchInspection(fetcher)
}
