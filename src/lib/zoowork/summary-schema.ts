import { z } from 'zod'
import { actionCategoryEnum } from '@/lib/db/schema'
import { extractFavieSummary } from './summary'

export const FavieAction = z.object({
  category: z.enum(actionCategoryEnum.enumValues),
  title: z.string().min(1),
  reason: z.string().min(1), // required: the dashboard's "why"
  before: z.unknown().nullable().optional(),
  after: z.unknown().nullable().optional(),
  amount_cents: z.number().int().nullable().optional(),
  needs_attention: z.boolean().default(false),
})

export const FavieStore = z.object({
  name: z.string().min(1),
  external_id: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
})

export const FaviePlatformReport = z.object({
  platform: z.enum(['uber_eats', 'doordash']),
  stores: z.array(FavieStore).default([]), // every store visible in the account (verify / confirm-login)
  login: z.enum(['ok', 'failed', 'skipped']),
  login_failure_reason: z.string().nullable().optional(),
  store_visible: z.boolean().nullable().optional(),
  store_name: z.string().nullable().optional(),
  store_external_id: z.string().nullable().optional(),
  role_seen: z.string().nullable().optional(),
  ad_spend_mtd_cents: z.number().int().nullable().optional(),
  campaigns_seen: z.number().int().nullable().optional(),
  actions: z.array(FavieAction).default([]),
  observations: z.array(z.string()).default([]),
  errors: z.array(z.string()).default([]),
})

export const FavieSummary = z.object({
  favie_summary_version: z.literal(1),
  mode: z.enum(['daily', 'verify']),
  run_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  aborted_early: z.boolean().default(false),
  abort_reason: z.string().nullable().optional(),
  platforms: z.array(FaviePlatformReport).default([]),
  notes: z.string().nullable().optional(),
})
export type FavieSummary = z.infer<typeof FavieSummary>

export function parseFavieSummary(text: string): { summary: FavieSummary } | { error: string } {
  const ex = extractFavieSummary(text)
  if ('error' in ex) return ex
  const v = FavieSummary.safeParse(ex.json)
  if (!v.success) return { error: 'schema: ' + v.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ') }
  return { summary: v.data }
}
