/** M0 follow-up: does `browser session save_login` + `loginLabel` persist state across sessions? */
import { createZooworkClient } from '@zoowork-ai/sdk'
import { streamTurn } from '../src/lib/zoowork/streamTurn'
import { extractFavieSummary } from '../src/lib/zoowork/summary'

const zc = createZooworkClient()
const LABELS = { app: 'favie', purpose: 'm0-savelogin-probe' }
const models = await zc.listModels()
const model = models.find((m) => m.model.includes('claude-sonnet-5'))?.model ?? models[0]!.model
const created = await zc.createAgent({ resource: {
  name: 'favie-m0-savelogin', model: { primary: model }, labels: LABELS, sandbox: { scope: 'agent' },
  persona: { docs: [{ name: 'AGENTS.md', content: 'You are a test agent. Use the browser tool exactly as instructed. Be terse.' }] },
} }, `favie-m0-savelogin-${Date.now()}`)
const agentId = created.agent_id
console.log('agent', agentId)
const SUMMARY = 'End your final message with exactly one fenced block:\n```favie-summary\n{ "favie_summary_version": 1, "mode": "cookie", "checks": [], "cookies_seen": { }, "notes": "..." }\n```\nPut the cookies shown by httpbin into cookies_seen (flat object; {} if none).'

async function turn(label: string, msg: string) {
  const s = await zc.createSession(agentId, { initial_events: [{ type: 'user.message', content: msg }] })
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4 * 60_000)
  const calls: string[] = []
  const r = await streamTurn(zc, agentId, s.session_id, { signal: ctl.signal, onEvent: (ev) => {
    const p = ev.payload as any
    if (ev.eventType === 'agent.tool' && p?.phase === 'start') calls.push(`${p.toolName ?? p.name} ${JSON.stringify(p.args ?? p.input ?? {}).slice(0, 120)}`)
  } })
  clearTimeout(t)
  const parsed = extractFavieSummary(r.text)
  console.log(`\n--- ${label}: outcome=${r.outcome}\n  calls: ${calls.join(' | ')}\n  summary: ${'json' in parsed ? JSON.stringify(parsed.json) : parsed.error}\n  tail: ${r.text.slice(-500).replace(/\n/g, ' ')}`)
  return 'json' in parsed ? (parsed.json as any) : null
}

try {
  await zc.startAgent(agentId); await zc.waitUntilRunning(agentId, { timeoutMs: 90_000 })

  const a = await turn('A set+save_login+close', [
    'Using the browser tool: (1) navigate to https://httpbin.org/cookies/set?favie_saved=yes then to https://httpbin.org/cookies and snapshot to confirm the cookie is present;',
    '(2) call the browser tool with action "session" and op "save_login" to checkpoint the login state; report the tool\'s response verbatim;',
    '(3) call action "session" op "close". Report each step.', SUMMARY].join('\n'))

  await new Promise((r) => setTimeout(r, 20_000))
  const b = await turn('B fresh session, plain navigate', [
    'Using the browser tool: navigate to https://httpbin.org/cookies, snapshot, and report the JSON body. Then call action "session" op "close".', SUMMARY].join('\n'))

  await new Promise((r) => setTimeout(r, 20_000))
  const c = await turn('C restart with loginLabel default', [
    'Using the browser tool: first call action "session" op "restart" with loginLabel "default" and report the response verbatim. Then navigate to https://httpbin.org/cookies, snapshot, and report the JSON body. Then call action "session" op "close".', SUMMARY].join('\n'))

  const has = (x: any) => !!x?.cookies_seen && Object.keys(x.cookies_seen).includes('favie_saved')
  console.log('\n===== VERDICT =====')
  console.log('A saw cookie after set:', has(a))
  console.log('B plain new session persisted:', has(b))
  console.log('C restart(loginLabel=default) persisted:', has(c))
} finally {
  await zc.stopAgent(agentId).catch(() => {}); await zc.deleteAgent(agentId).catch(() => {})
  console.log('teardown done; remaining:', (await zc.listAgents({ labels: LABELS })).length)
}
