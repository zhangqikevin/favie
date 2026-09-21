import { getSetting, SETTING_KEYS } from '@/server/settings'
import { DEFAULT_DISPUTE_PROMPT_UBER_EATS, DEFAULT_DISPUTE_PROMPT_DOORDASH, DEFAULT_DISPUTE_WRITING_RULES, DEFAULT_DISPUTE_FAST_UBER_EATS, DEFAULT_DISPUTE_FAST_DOORDASH, fillDisputesPrompt } from '@/lib/disputes/prompts'
import { DisputePromptEditor } from './DisputePromptEditor'

export default async function AdminDisputePrompts() {
  const [ue, dd, rules, fue, fdd] = await Promise.all([getSetting(SETTING_KEYS.disputesPromptUberEats), getSetting(SETTING_KEYS.disputesPromptDoordash), getSetting(SETTING_KEYS.disputesWritingRules), getSetting(SETTING_KEYS.disputesFastUberEats), getSetting(SETTING_KEYS.disputesFastDoordash)])
  const rulesText = rules?.value ?? DEFAULT_DISPUTE_WRITING_RULES
  const sampleUe = fillDisputesPrompt(ue?.value ?? DEFAULT_DISPUTE_PROMPT_UBER_EATS, rulesText, 'uber_eats', { name: 'Jun Bistro', id: '59d27fe6-10e9-5ebb-836c-458e6a85b13b' })
  const sampleDd = fillDisputesPrompt(dd?.value ?? DEFAULT_DISPUTE_PROMPT_DOORDASH, rulesText, 'doordash', { name: 'Jun Bistro', id: '27513912' })
  return (
    <section className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Dispute prompts</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-500">
          What the agent is told when it handles disputed orders: one portal procedure per platform, and one set of rules for the dispute text that both share.
          They travel inside the task message, so a saved prompt is used by the very next check — no skill publish. The report format the backend parses is fixed in code.
          Placeholders: <code>{'{store_name}'}</code> <code>{'{store_id}'}</code> <code>{'{list_url}'}</code> and <code>{'{writing_rules}'}</code> (where the shared rules are inserted).
        </p>
      </div>

      <DisputePromptEditor which="rules" title="Dispute text — writing rules (shared)"
        help="Language, length limit, tone, the two-checks frame and what counts as a hard fact. Inserted into both procedures where {writing_rules} stands."
        value={rules?.value ?? null} defaultValue={DEFAULT_DISPUTE_WRITING_RULES} updatedAt={rules?.updatedAt.toISOString() ?? null} />

      <DisputePromptEditor which="uber_eats" title="Uber Eats — charged order issues"
        help="Orders → History → last 30 days → Order issue filter; only 'Charged issue' rows are disputed. Must contain {writing_rules}."
        value={ue?.value ?? null} defaultValue={DEFAULT_DISPUTE_PROMPT_UBER_EATS} updatedAt={ue?.updatedAt.toISOString() ?? null} preview={sampleUe} />

      <DisputePromptEditor which="doordash" title="DoorDash — error charges"
        help="Financials → Transactions?store_id=… → last 30 days → transaction type 'Error charge'; order panel → 'Dispute charge' → reason per item + additional notes (500 chars; 'Other reason' needs the same text in both boxes). Must contain {writing_rules}."
        value={dd?.value ?? null} defaultValue={DEFAULT_DISPUTE_PROMPT_DOORDASH} updatedAt={dd?.updatedAt.toISOString() ?? null} preview={sampleDd} />

      <div>
        <h2 className="font-display text-xl font-bold tracking-tight">Fast (scripted) single-order runs</h2>
        <p className="mt-1 max-w-3xl text-sm text-ink-500">Used by the "Fast process" button on a restaurant's Disputes page: one order id, no skill read, no context fetch, a fixed sequence of calls with exact selectors. Extra placeholders: <code>{'{order_id}'}</code> <code>{'{order_id_lower}'}</code> <code>{'{detail_url}'}</code>.</p>
      </div>

      <DisputePromptEditor which="fast_doordash" title="DoorDash — fast script"
        help="Opens the order panel directly when an earlier run reported its URL, otherwise through the filtered list; selectors for the dispute button, reason, the two text boxes and Submit. Must contain {writing_rules}."
        value={fdd?.value ?? null} defaultValue={DEFAULT_DISPUTE_FAST_DOORDASH} updatedAt={fdd?.updatedAt.toISOString() ?? null} />

      <DisputePromptEditor which="fast_uber_eats" title="Uber Eats — fast script"
        help="Filtered History list → search the order id → Dispute → reason → text → Submit. Not yet exercised on a real open charge. Must contain {writing_rules}."
        value={fue?.value ?? null} defaultValue={DEFAULT_DISPUTE_FAST_UBER_EATS} updatedAt={fue?.updatedAt.toISOString() ?? null} />
    </section>
  )
}
