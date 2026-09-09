/** How does `browser handoff` surface the live-view link to an API caller? Also: is there an agent `browser` config section? */
import { createZooworkClient, toolCall, ZooworkError } from '@zoowork-ai/sdk'
import { streamTurn } from '../src/lib/zoowork/streamTurn'

const zc = createZooworkClient()
const LABELS = { app: 'favie', purpose: 'm0-handoff-probe' }
const models = await zc.listModels()
const model = models.find((m) => m.model.includes('claude-sonnet-5'))?.model ?? models[0]!.model

// Probe 1: does createAgent accept a `browser` section? (browser-ops skill requires config key "browser")
let agentId: string | undefined
for (const variant of [{ browser: { enabled: true } }, { browser: {} }, {}]) {
  try {
    const created = await zc.createAgent({ resource: {
      name: 'favie-m0-handoff', model: { primary: model }, labels: LABELS, sandbox: { scope: 'agent' },
      persona: { docs: [{ name: 'AGENTS.md', content: 'You are a test agent. Use the browser tool exactly as instructed. Be terse. Never log in yourself.' }] },
      ...(variant as object),
    } as any }, `favie-m0-handoff-${Date.now()}`)
    agentId = created.agent_id
    console.log('createAgent accepted variant', JSON.stringify(variant), '→', agentId)
    break
  } catch (e) {
    const err = e as ZooworkError
    console.log('createAgent rejected variant', JSON.stringify(variant), '→', err.status, err.type, err.message.slice(0, 200))
  }
}
if (!agentId) throw new Error('could not create agent')
try {
  await zc.startAgent(agentId); await zc.waitUntilRunning(agentId, { timeoutMs: 90_000 })
  const a = await zc.getAgent(agentId)
  console.log('declared keys:', Object.keys(a.declared ?? {}), 'browser section:', JSON.stringify((a.declared as any)?.browser ?? null))
  const skills = await zc.listAgentSkills(agentId, { verbose: true } as any)
  const bo = skills.find((s: any) => s.name === 'browser-ops') as any
  console.log('browser-ops eligible:', bo?.eligible, 'missing:', JSON.stringify(bo?.missing ?? null))

  // Probe 2: handoff. Capture the raw tool result event payload.
  const s = await zc.createSession(agentId, { initial_events: [{ type: 'user.message', content: [
    'Using the browser tool: (1) call action "session" op "restart" with loginLabel "probe-doordash" and egressCountry "US";',
    '(2) navigate to https://www.doordash.com/merchant/login/ ;',
    '(3) call action "handoff" with reason "Please log in to DoorDash Merchant Portal" and paste the tool\'s ENTIRE response verbatim (including any URL) in your reply;',
    '(4) do NOT close the session. Then stop and reply.',
  ].join('\n') }] })
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4 * 60_000)
  const r = await streamTurn(zc, agentId, s.session_id, { signal: ctl.signal, onEvent: (ev) => {
    const c = toolCall(ev)
    if (c?.toolName === 'browser') console.log(`  [${c.phase}] browser`, JSON.stringify(c.phase === 'start' ? c.args : (ev.payload as any)).slice(0, 700))
  } })
  clearTimeout(t)
  console.log('\n===== reply (outcome', r.outcome, ') =====\n' + r.text.slice(-2500))
  console.log('\nsession', s.session_id, 'kept open for follow-up; agent', agentId, '(M0_KEEP=1 keeps it)')
  if (process.env.M0_KEEP !== '1') { await zc.stopAgent(agentId).catch(() => {}); await zc.deleteAgent(agentId).catch(() => {}); console.log('teardown done') }
} catch (e) {
  await zc.stopAgent(agentId).catch(() => {}); await zc.deleteAgent(agentId).catch(() => {}); throw e
}
