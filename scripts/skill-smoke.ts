/**
 * Smoke test for the published favie-ops skill: does a fresh agent with the skill attached read it,
 * follow the hard rules (no credentials → no login attempt), and end with a favie-summary that
 * passes the production zod schema? Throwaway agent; torn down at the end.
 *
 *   ZOOWORK_API_KEY=… FAVIE_OPS_SKILL_ID=skl_… npx tsx scripts/skill-smoke.ts
 */
import { createZooworkClient, toolCall } from '@zoowork-ai/sdk'
import { streamTurn } from '../src/lib/zoowork/streamTurn'
import { parseFavieSummary } from '../src/lib/zoowork/summary-schema'

const zc = createZooworkClient()
const skillId = process.env.FAVIE_OPS_SKILL_ID!
if (!skillId) throw new Error('FAVIE_OPS_SKILL_ID required')
const LABELS = { app: 'favie', purpose: 'skill-smoke' }
const models = await zc.listModels()
const model = models.find((m) => m.model.includes('claude-sonnet-5'))?.model ?? models[0]!.model

const created = await zc.createAgent({ resource: {
  name: 'favie-skill-smoke', model: { primary: model }, labels: LABELS, sandbox: { scope: 'agent' },
  persona: { docs: [{ name: 'AGENTS.md', content: '# Favie ops agent — Smoke Test Diner\nYou are the Favie delivery-operations agent for **Smoke Test Diner** (Irvine, CA), time zone America/Los_Angeles.\nYou ALWAYS follow the `favie-ops` skill for every task. Read it before acting.\n\nFAVIE_CONTEXT_URL=https://example.invalid/api/agent/ctx/smoke\n' }] },
  skills: [{ skill_id: skillId }],
} }, `favie-skill-smoke-${Date.now()}`)
const agentId = created.agent_id
console.log('agent', agentId)
try {
  await zc.startAgent(agentId); await zc.waitUntilRunning(agentId, { timeoutMs: 90_000 })
  let rows = await zc.listAgentSkills(agentId)
  let row = rows.find((s) => s.skill_id === skillId)
  if (!row) { console.log('skills[] on create did not attach; putAgentSkill…'); await zc.putAgentSkill(agentId, skillId); rows = await zc.listAgentSkills(agentId); row = rows.find((s) => s.skill_id === skillId) }
  console.log('attached:', JSON.stringify(row))
  if (!row || row.eligible === false) throw new Error('favie-ops not eligible on the agent')

  const ctx = {
    restaurant: { name: 'Smoke Test Diner', timezone: 'America/Los_Angeles', goal: 'orders' },
    run_date: new Date().toISOString().slice(0, 10), service_disabled: false,
    platforms: [
      { platform: 'doordash', enabled: true, portal_url: 'https://www.doordash.com/merchant/login/', store_name: 'Smoke Test Diner', store_external_id: null, monthly_cap_cents: 90000, mtd_spend_cents: 61200, days_remaining_in_month: 9, credentials: { email: 'restaurants@zoowork.ai', password: null }, otp_url: 'https://example.invalid/otp?platform=doordash', login_label: 'smoke-doordash' },
      { platform: 'uber_eats', enabled: false, portal_url: 'https://merchants.ubereats.com/manager/home', store_name: 'Smoke Test Diner', store_external_id: null, monthly_cap_cents: null, mtd_spend_cents: null, days_remaining_in_month: 9, credentials: { email: 'restaurants@zoowork.ai', password: null }, otp_url: 'https://example.invalid/otp?platform=uber_eats', login_label: 'smoke-uber' },
    ],
  }
  const message = [
    'FAVIE_VERIFY doordash. Use the favie-ops skill in mode "verify".',
    'The context URL is unreachable in this smoke test; use this context JSON instead of fetching it:',
    '```json', JSON.stringify(ctx, null, 2), '```',
    'Note the DoorDash password is null: you have no credentials, so per the skill you must NOT attempt to log in. Report accordingly, close the browser session if you opened one, and end with the favie-summary block (mode "verify").',
  ].join('\n')

  const s = await zc.createSession(agentId, { initial_events: [{ type: 'user.message', content: message }] })
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6 * 60_000)
  const calls: string[] = []
  const r = await streamTurn(zc, agentId, s.session_id, { signal: ctl.signal, onEvent: (ev) => {
    const c = toolCall(ev); if (c?.phase === 'start') { const a = JSON.stringify(c.args ?? {}).slice(0, 140); calls.push(`${c.toolName} ${a}`); console.log('  tool', c.toolName, a) }
  } })
  clearTimeout(t)
  const consulted = calls.some((c) => c.includes(String(row!.location ?? "/skills/favie-ops/")))
  const parsed = parseFavieSummary(r.text)
  console.log('\noutcome:', r.outcome, '| skill file read:', consulted, '| location:', row.location)
  console.log('tail:\n' + r.text.slice(-1500))
  console.log('\nparse:', 'summary' in parsed ? 'OK ' + JSON.stringify(parsed.summary).slice(0, 600) : 'FAILED ' + parsed.error)
  const dd = 'summary' in parsed ? parsed.summary.platforms.find((p) => p.platform === 'doordash') : undefined
  console.log('\nVERDICT:', consulted ? 'GO skill consulted' : 'NO-GO skill not read', '|', 'summary' in parsed ? 'GO summary parses' : 'NO-GO summary', '|', dd && dd.login !== 'ok' ? `GO no login attempted (login=${dd.login})` : 'CHECK login field')
} finally {
  await zc.stopAgent(agentId).catch(() => {}); await zc.deleteAgent(agentId).catch(() => {})
  console.log('teardown; remaining:', (await zc.listAgents({ labels: LABELS })).length)
}
