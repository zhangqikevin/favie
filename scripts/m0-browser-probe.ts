/** M0 follow-up: what does the built-in browser tool offer for login / persistence? */
import { createZooworkClient, ZooworkError } from '@zoowork-ai/sdk'
import { streamTurn } from '../src/lib/zoowork/streamTurn'

const zc = createZooworkClient()
const LABELS = { app: 'favie', purpose: 'm0-browser-probe' }
const models = await zc.listModels()
const model = models.find((m) => m.model.includes('claude-sonnet-5'))?.model ?? models[0]!.model
const created = await zc.createAgent({ resource: {
  name: 'favie-m0-browser-probe', model: { primary: model }, labels: LABELS, sandbox: { scope: 'agent' },
  persona: { docs: [{ name: 'AGENTS.md', content: 'You are a test agent. Answer precisely from your tool definitions. Never navigate to any website.' }] },
} }, `favie-m0-browser-probe-${Date.now()}`)
const agentId = created.agent_id
console.log('agent', agentId)
try {
  await zc.startAgent(agentId); await zc.waitUntilRunning(agentId, { timeoutMs: 90_000 })
  const globalSkills = await zc.listSkills({ scope: 'global' })
  const bo = globalSkills.find((s) => s.name === 'browser-ops')!
  try { const r = await zc.putAgentSkill(agentId, bo.skill_id); console.log('putAgentSkill(browser-ops) →', JSON.stringify(r)) }
  catch (e) { const err = e as ZooworkError; console.log('putAgentSkill(browser-ops) →', err.status, err.type, err.message) }
  const attached = await zc.listAgentSkills(agentId, { verbose: true } as any)
  console.log('attached browser-ish:', JSON.stringify(attached.filter((s: any) => /browser/i.test(s.name ?? ''))))

  const out = await zc.exec(agentId, ['bash', '-lc', 'ls -la /skills 2>/dev/null; find / -maxdepth 4 -iname "*browser-ops*" -not -path "*/proc/*" 2>/dev/null | head; f=$(find / -maxdepth 5 -path "*browser-ops*" -name SKILL.md 2>/dev/null | head -1); [ -n "$f" ] && sed -n 1,120p "$f"'])
  console.log('exec exit', out.exit_code, '\n', out.stdout.slice(0, 6000), out.stderr.slice(0, 500))

  const s = await zc.createSession(agentId, { initial_events: [{ type: 'user.message', content: [
    'Do NOT navigate anywhere. From your tool definitions only, document the `browser` tool completely:',
    '1. List every `action` value it accepts and, for each, the parameters (name, type, required, description).',
    '2. Quote verbatim any part of the tool description or parameter descriptions that mentions: login, credentials, password, cookies, profile, session, persistence, storage state, handoff, human, 2FA/OTP, upload, download, screenshot.',
    '3. Say whether the tool offers a way to persist a logged-in state between runs (e.g., named profiles, saved sessions, a credential vault) and how it would be used.',
    '4. If a `browser-ops` skill file is available to you, read it and summarize its login and handoff sections; otherwise say it is not available.',
    'Answer in structured markdown. Do not speculate beyond what the definitions say.',
  ].join('\n') }] })
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4 * 60_000)
  const r = await streamTurn(zc, agentId, s.session_id, { signal: ctl.signal })
  clearTimeout(t)
  console.log('\n===== browser tool self-description (outcome', r.outcome, ') =====\n' + r.text)
} finally {
  await zc.stopAgent(agentId).catch(() => {}); await zc.deleteAgent(agentId).catch(() => {})
  console.log('\nteardown done; remaining:', (await zc.listAgents({ labels: LABELS })).length)
}
