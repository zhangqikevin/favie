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

export const FavieDispute = z.object({
  order_id: z.string().min(1),
  order_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  kind: z.enum(['missing_item', 'wrong_item', 'late', 'refund', 'error_charge', 'other']).default('other'),
  amount_cents: z.number().int().nullable().optional(),
  recovered_cents: z.number().int().nullable().optional(),
  status: z.enum(['open', 'filed', 'won', 'lost', 'expired', 'skipped']),
  reason: z.string().nullable().optional(),   // the argument made, or why no appeal
  evidence: z.string().nullable().optional(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  // FAVIE_DISPUTES archive: what the portal showed and what was submitted.
  reason_category: z.string().nullable().optional(),   // the portal's own reason option, in English
  submitted_text: z.string().nullable().optional(),    // the dispute text exactly as sent (≤ 400 chars)
  customer_note: z.string().nullable().optional(),     // the customer's complaint / issue description
  customer_photo: z.boolean().nullable().optional(),
  items_total: z.number().int().nullable().optional(),
  items_disputed: z.string().nullable().optional(),    // which items the customer reported
  customer_type: z.enum(['new', 'returning']).nullable().optional(),
  filed_by: z.enum(['favie', 'owner']).nullable().optional(), // owner = already disputed before Favie saw it
  decision_text: z.string().nullable().optional(),     // the platform's decision wording, when one appeared
})
export type FavieDispute = z.infer<typeof FavieDispute>

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
  promo_spend_mtd_cents: z.number().int().nullable().optional(), // discounts + marketing fees the portal shows for this month
  new_customer_share: z.number().min(0).max(1).nullable().optional(), // share of recent orders from new customers, when the portal shows it
  campaigns_seen: z.number().int().nullable().optional(),
  actions: z.array(FavieAction).default([]),
  disputes: z.array(FavieDispute).default([]), // every error charge / refund claim seen today and what happened to it
  disputes_found: z.number().int().nullable().optional(), // FAVIE_DISPUTES: charged-issue orders visible in the 30-day list
  observations: z.array(z.string()).default([]),
  errors: z.array(z.string()).default([]),
})

export const FavieSummary = z.object({
  favie_summary_version: z.literal(1),
  mode: z.enum(['daily', 'verify', 'disputes']),
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
