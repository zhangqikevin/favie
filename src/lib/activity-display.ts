/**
 * Display helpers shared by the activity calendar and the run report.
 *
 * In observe-only mode the agent used to prefix titles with an English "Observe-only:" (sometimes half
 * translated: "观察-only建议:"). The prefix is stripped for display and replaced by a localized chip; newer
 * runs flag it as `after.observe_only = true` instead.
 */
const OBSERVE_PREFIX = /^\s*(observe[\s-]*only|观察[\s-]*only|仅观察|觀察[\s-]*only|僅觀察|solo\s+observaci[oó]n|観察のみ)\s*(建议|建議|suggestion|recommendation)?\s*[:：\-–]\s*/i

export function displayTitle(title: string) {
  return title.replace(OBSERVE_PREFIX, '').replace(/^./, (c) => c.toUpperCase())
}

export function isObserveOnly(title: string, after: Record<string, unknown> | null | undefined) {
  return OBSERVE_PREFIX.test(title) || after?.observe_only === true
}

/** Keys of before/after that are flags for the UI, not facts for the owner. */
export function visibleEntries(v: Record<string, unknown> | null | undefined) {
  return Object.entries(v ?? {}).filter(([k]) => k !== 'observe_only')
}

export const moneyFromCents = (c: number) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 })}`
