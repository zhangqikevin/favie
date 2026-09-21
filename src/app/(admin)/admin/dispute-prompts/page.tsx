import { getSetting, SETTING_KEYS } from '@/server/settings'
import { DEFAULT_DISPUTE_PROMPT_UBER_EATS, DEFAULT_DISPUTE_PROMPT_DOORDASH, DEFAULT_DISPUTE_WRITING_RULES, fillDisputesPrompt } from '@/lib/disputes/prompts'
import { DisputePromptEditor } from './DisputePromptEditor'

export default async function AdminDisputePrompts() {
  const [ue, dd, rules] = await Promise.all([getSetting(SETTING_KEYS.disputesPromptUberEats), getSetting(SETTING_KEYS.disputesPromptDoordash), getSetting(SETTING_KEYS.disputesWritingRules)])
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
    </section>
  )
}
