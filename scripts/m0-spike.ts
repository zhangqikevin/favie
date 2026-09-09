/**
 * M0 spike — go/no-go checks for running Favie's delivery-ops agent on ZooWork.
 *
 *   ZOOWORK_API_KEY=zct_... npx tsx scripts/m0-spike.ts
 *
 * Optional env:
 *   M0_KEEP_AGENT=1              keep the throwaway agent (skip teardown)
 *   M0_AGENT_ID=agt_...          reuse an existing spike agent instead of creating one
 *   M0_SKIP=browser,cookie,cron  skip named steps
 *   M0_DD_EMAIL / M0_DD_PASSWORD attempt a real DoorDash Merchant Portal login
 *   M0_UE_EMAIL / M0_UE_PASSWORD attempt a real Uber Eats Manager login
 *
 * Every step prints GO / NO-GO / SKIP. Nothing here is production code.
 */
import {
  createZooworkClient, ZooworkError, toolCall, type SessionEvent, type ZooworkClient,
} from '@zoowork-ai/sdk'
import { z } from 'zod'
import { streamTurn } from '../src/lib/zoowork/streamTurn'
import { extractFavieSummary } from '../src/lib/zoowork/summary'

const LABELS = { app: 'favie', purpose: 'm0-spike' }
const SKIP = new Set((process.env.M0_SKIP ?? '').split(',').map((s) => s.trim()).filter(Boolean))
const results: { step: string; verdict: 'GO' | 'NO-GO' | 'SKIP' | 'INFO'; note: string }[] = []
const report = (step: string, verdict: 'GO' | 'NO-GO' | 'SKIP' | 'INFO', note: string) => {
  results.push({ step, verdict, note })
  console.log(`\n[${verdict}] ${step} — ${note}\n`)
}
const t0 = Date.now()
const stamp = () => `+${((Date.now() - t0) / 1000).toFixed(0)}s`

// ---------------------------------------------------------------------------------------------
// Summary contract used by the spike turns (mechanism test for the real favie-summary contract).
const M0Summary = z.object({
  favie_summary_version: z.literal(1),
  mode: z.string(),
  checks: z.array(z.object({
    name: z.string(),
    final_url: z.string().nullable().optional(),
    page_title: z.string().nullable().optional(),
    login_form_visible: z.boolean().nullable().optional(),
    captcha_or_block: z.boolean().nullable().optional(),
    reached_state: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  })).default([]),
  cookies_seen: z.record(z.string(), z.string()).nullable().optional(),
  notes: z.string().nullable().optional(),
})
type M0Summary = z.infer<typeof M0Summary>

const SUMMARY_INSTRUCTION = `
When you are completely done, END your final message with exactly one fenced block and nothing after it:

\`\`\`favie-summary
{ "favie_summary_version": 1, "mode": "<mode>", "checks": [ { "name": "...", "final_url": "...", "page_title": "...", "login_form_visible": true, "captcha_or_block": false, "reached_state": "...", "notes": "..." } ], "cookies_seen": null, "notes": "..." }
\`\`\`
Use null for anything you could not determine. Never include passwords or codes in the summary.`

// ---------------------------------------------------------------------------------------------
async function runTurn(
  zc: ZooworkClient, agentId: string, message: string, label: string, budgetMs = 9 * 60_000,
): Promise<{ text: string; outcome?: string; sessionId: string; tools: string[]; summary?: M0Summary; summaryError?: string }> {
  console.log(`\n=== turn "${label}" ${stamp()}`)
  const session = await zc.createSession(agentId, {
    initial_events: [{ type: 'user.message', content: message }],
    metadata: { origin: 'm0-spike', label },
  })
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), budgetMs)
  const tools: string[] = []
  let toolErrors = 0
  const onEvent = (ev: SessionEvent) => {
    const call = toolCall(ev)
    if (call?.phase === 'start') {
      const args = JSON.stringify(call.args ?? {}).slice(0, 160)
      tools.push(`${call.toolName} ${args}`)
      console.log(`  ${stamp()} tool ${call.toolName} ${args}`)
    }
    if (call?.phase === 'end' && call.isError) toolErrors += 1
    if (ev.eventType === 'agent.error') console.log(`  ${stamp()} agent.error ${JSON.stringify(ev.payload).slice(0, 300)}`)
  }
  let res
  try {
    res = await streamTurn(zc, agentId, session.session_id, { signal: ctl.signal, onEvent })
  } finally {
    clearTimeout(timer)
  }
  if (!res.outcome && ctl.signal.aborted) {
    console.log(`  turn exceeded ${budgetMs / 1000}s budget; sending user.interrupt`)
    await zc.postEvents(agentId, session.session_id, [{ type: 'user.interrupt' }]).catch(() => {})
  }
  console.log(`  outcome=${res.outcome ?? 'none'} tools=${tools.length} toolErrors=${toolErrors} ${stamp()}`)
  console.log('  --- reply (tail) ---\n' + res.text.slice(-1800) + '\n  --- end ---')
  const parsed = extractFavieSummary(res.text)
  let summary: M0Summary | undefined
  let summaryError: string | undefined
  if ('error' in parsed) summaryError = parsed.error
  else {
    const v = M0Summary.safeParse(parsed.json)
    if (v.success) summary = v.data
    else summaryError = 'schema mismatch: ' + v.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
  }
  return { text: res.text, outcome: res.outcome, sessionId: session.session_id, tools, summary, summaryError }
}

// ---------------------------------------------------------------------------------------------
async function main() {
  const zc = createZooworkClient()
  let agentId = process.env.M0_AGENT_ID
  let scheduleCreated = false

  // Step 1 — is there a browser skill in the global catalog?
  const globalSkills = await zc.listSkills({ scope: 'global' })
  const browserSkill = globalSkills.find((s) => /browser/i.test(s.name ?? ""))
  if (browserSkill) report('1 browser skill exists', 'GO', `${browserSkill.name} v${browserSkill.latest_version}: ${browserSkill.description}`)
  else report('1 browser skill exists', 'NO-GO', `no global skill matches /browser/; catalog: ${globalSkills.map((s) => s.name).join(', ')}`)

  // Step 2 — create + start a throwaway agent
  const models = await zc.listModels()
  const model = models.find((m) => m.model.includes('claude-sonnet-5'))?.model ?? models[0]?.model
  if (!model) throw new Error('no models available to this key')
  console.log(`model: ${model}`)

  if (!agentId) {
    const existing = await zc.listAgents({ labels: LABELS })
    agentId = existing[0]?.agent_id
    if (agentId) console.log(`reusing spike agent ${agentId}`)
  }
  if (!agentId) {
    const created = await zc.createAgent(
      {
        resource: {
          name: 'favie-m0-spike',
          model: { primary: model },
          labels: LABELS,
          sandbox: { scope: 'agent' },
          persona: {
            docs: [{
              name: 'AGENTS.md',
              content: [
                '# Favie M0 spike agent',
                'You are a test agent verifying that this platform can operate restaurant delivery portals.',
                'Always use the browser-ops skill for any web page task. Never attempt to bypass a CAPTCHA or bot check: if you see one, stop and report it.',
                'Never log in unless the message explicitly gives you credentials. Never accept terms, change settings, or grant permissions.',
                'Be terse. Report facts you observed, not guesses.',
              ].join('\n'),
            }],
          },
        },
      },
      `favie-m0-spike-${Date.now()}`, // NOTE: reusing an idempotency key of a DELETED agent makes createAgent answer 502
    )
    agentId = created.agent_id
    console.log(`created ${agentId} (config_version ${created.config_version})`)
  }
  if (!agentId) throw new Error('no agent id')
  const { warnings } = await zc.startAgent(agentId)
  if (warnings.length) console.log('start warnings:', warnings)
  const running = await zc.waitUntilRunning(agentId, { timeoutMs: 90_000 })
  const attached = await zc.listAgentSkills(agentId)
  const hasBrowserSkill = attached.find((s) => /browser/i.test(s.name ?? ''))
  // Observed 2026-09-08: browser-ops is NOT in listAgentSkills of a fresh agent, yet the built-in
  // `browser` tool is available to it anyway. The real test is 4a (tool actually used).
  report('2 agent running', running.status?.desired_state === 'running' ? 'GO' : 'NO-GO',
    `desired_state=${running.status?.desired_state}; browser-ops attached: ${hasBrowserSkill ? 'yes' : 'no (built-in browser tool still expected)'}; skills: ${attached.map((s) => `${s.name}${s.eligible === false ? '(ineligible)' : ''}`).join(', ')}`)

  // Step 3 — sandbox sanity via exec: outbound HTTPS (ctx endpoint path), curl, browser binary
  try {
    const out = await zc.exec(agentId, ['bash', '-lc', [
      'echo "curl=$(command -v curl || echo none) node=$(command -v node || echo none) python3=$(command -v python3 || echo none)"',
      'echo "chromium=$(command -v chromium || command -v chromium-browser || command -v google-chrome || echo none)"',
      'echo "egress_https=$(curl -sS -o /dev/null -m 15 -w %{http_code} https://api.zoodata.ai/ 2>&1 || echo fail)"',
      'echo "egress_ip=$(curl -sS -m 15 https://api.ipify.org 2>/dev/null || echo unknown)"',
      'echo "skills=$(ls /skills 2>/dev/null | tr "\\n" " ")"',
      'echo "workspace=$(ls -la /workspace 2>/dev/null | wc -l) lines"',
    ].join('; ')])
    const ok = out.exit_code === 0 && /egress_https=\d{3}/.test(out.stdout) && !/egress_https=000/.test(out.stdout)
    report('3 sandbox exec + outbound HTTPS', ok ? 'GO' : 'NO-GO', `exit=${out.exit_code}\n${out.stdout.trim()}${out.stderr ? '\nstderr: ' + out.stderr.trim() : ''}`)
  } catch (e) {
    const err = e as ZooworkError
    report('3 sandbox exec + outbound HTTPS', 'NO-GO', `exec failed: ${err.status} ${err.type} ${err.message}`)
  }

  // Step 4 — browser reaches DD / UE portals without CAPTCHA (no login) + emits summary block
  if (!SKIP.has('browser')) {
    const r = await runTurn(zc, agentId, [
      'Use the browser-ops skill. Do NOT log in anywhere. Visit these two pages in order and, for each, record the final URL after redirects, the page title, whether an email/password login form is visible, and whether any CAPTCHA, bot check, "access denied", or Cloudflare challenge appears:',
      '1. DoorDash Merchant Portal: https://www.doordash.com/merchant/login/',
      '2. Uber Eats Manager: https://merchants.ubereats.com/manager/home',
      'Then visit https://httpbin.org/cookies/set?favie_m0=persist-test (this sets a cookie; you may be redirected to /cookies — that is fine) and record what /cookies shows.',
      'Finally, close the browser session (browser tool: action "session", op "close") so the profile lock is released for the next run.',
      'Report only what you observed.',
      SUMMARY_INSTRUCTION.replace('<mode>', 'portal-reach'),
    ].join('\n'), 'portal-reach')
    const usedBrowser = r.tools.some((t) => /browser|navigate|snapshot/i.test(t))
    const dd = r.summary?.checks.find((c) => /doordash/i.test(c.name) || /doordash/i.test(c.final_url ?? ''))
    const ue = r.summary?.checks.find((c) => /uber/i.test(c.name) || /uber/i.test(c.final_url ?? ''))
    const blocked = [dd, ue].some((c) => c?.captcha_or_block === true)
    report('4a browser tool actually used', usedBrowser ? 'GO' : 'NO-GO', `tool calls: ${r.tools.slice(0, 12).join(' | ')}`)
    report('4b portals reachable without bot-block', r.summary ? (blocked ? 'NO-GO' : dd && ue ? 'GO' : 'INFO') : 'INFO',
      `DD: ${JSON.stringify(dd ?? null)}\nUE: ${JSON.stringify(ue ?? null)}`)
    report('6 favie-summary block emitted + parses', r.summary ? 'GO' : 'NO-GO', r.summaryError ?? `parsed OK (${r.summary!.checks.length} checks)`)
    if (r.outcome !== 'succeeded') report('4 run outcome', 'INFO', `outcome=${r.outcome ?? 'none (timed out?)'}`)
  } else report('4 browser reach', 'SKIP', 'M0_SKIP')

  // Step 5 — does browser state persist across sessions (agent-scope /workspace)?
  // Observed 2026-09-08: the browser profile is per-agent and stays LOCKED for a while after the
  // previous session ends (409 "Profile … is locked by another session"). Give it time to release.
  if (!SKIP.has('cookie')) {
    console.log('waiting 45s for the browser profile lock to release…')
    await new Promise((r) => setTimeout(r, 45_000))
    const r = await runTurn(zc, agentId, [
      'Use the browser-ops skill. Navigate to https://httpbin.org/cookies and report the JSON body exactly as shown.',
      'If the browser tool answers that the profile is locked by another session, wait 20 seconds and retry, up to 4 times. Do nothing else. Close the browser session when done.',
      SUMMARY_INSTRUCTION.replace('<mode>', 'cookie-persistence') + '\nPut the cookies you saw into "cookies_seen" as a flat object (empty object if none).',
    ].join('\n'), 'cookie-persistence', 5 * 60_000)
    const seen = r.summary?.cookies_seen ?? null
    const persisted = !!seen && Object.keys(seen).some((k) => k === 'favie_m0')
    report('5 browser state persists across sessions', r.summary ? (persisted ? 'GO' : 'NO-GO') : 'INFO',
      `cookies_seen=${JSON.stringify(seen)}${persisted ? '' : ' → every run will need a fresh login (+OTP) unless browser-ops offers a persistent profile'}`)
  } else report('5 cookie persistence', 'SKIP', 'M0_SKIP')

  // Step 7 — cron schedule: trigger, find the session by prefix, read the outcome
  if (!SKIP.has('cron')) {
    const scheduleId = 'm0-cron-probe'
    try {
      await zc.createSchedule(agentId, {
        schedule_id: scheduleId,
        schedule: { kind: 'cron', expr: '0 3 1 1 *', tz: 'UTC' }, // Jan 1st 03:00 — effectively never; we trigger by hand
        payload: { kind: 'agentTurn', message: 'Reply with exactly the word OK and nothing else. Do not use any tools.' },
        sessionTarget: 'isolated',
        delivery: { mode: 'none' },
        enabled: true,
      }, `m0-cron-probe-${agentId}`)
      scheduleCreated = true
      const stored = await zc.getSchedule(agentId, scheduleId)
      console.log(`schedule stored: name=${stored.name} enabled=${stored.enabled} cron=${stored.scheduleSpec?.cronExpressions?.[0]}`)
      const trig = await zc.triggerSchedule(agentId, scheduleId)
      console.log(`triggerSchedule → ${JSON.stringify(trig)} ${stamp()}`)

      const prefix = `agent:${agentId}:cron:${scheduleId}:`
      let cronSession: Awaited<ReturnType<typeof zc.listSessions>>[number] | undefined
      for (let i = 0; i < 24 && !cronSession; i += 1) {
        await new Promise((r) => setTimeout(r, 5_000))
        const sessions = await zc.listSessions(agentId, { page: 1 })
        cronSession = sessions.find((s) => s.channel === 'cron' && (s.session_key ?? '').startsWith(prefix))
        if (!cronSession && i === 3) {
          console.log('  no prefix match yet; cron-channel keys seen:', sessions.filter((s) => s.channel === 'cron').map((s) => s.session_key))
        }
      }
      if (!cronSession) {
        const sessions = await zc.listSessions(agentId, { page: 1 })
        report('7 cron fire → session discoverable by prefix', 'NO-GO',
          `no session with channel=cron and key prefix ${prefix} within 120s. Keys seen: ${sessions.map((s) => `${s.channel}:${s.session_key}`).join(', ')}`)
      } else {
        let runStatus = cronSession.run_status
        for (let i = 0; i < 24 && (runStatus === 'running' || runStatus === undefined); i += 1) {
          await new Promise((r) => setTimeout(r, 5_000))
          const s = await zc.getSession(agentId, cronSession.session_id)
          runStatus = s.run_status
        }
        const events = await zc.listAllEvents(agentId, cronSession.session_id)
        const finished = events.filter((e) => e.eventType === 'run.finished').at(-1)
        const reply = events.filter((e) => e.eventType === 'agent.assistant').map((e) => JSON.stringify(e.payload).slice(0, 200)).join(' ')
        report('7 cron fire → session discoverable by prefix', 'GO',
          `session_key=${cronSession.session_key} run_status=${runStatus} run.finished=${JSON.stringify(finished?.payload ?? null)} events=${events.length}\n  assistant: ${reply.slice(0, 300)}`)
      }
    } catch (e) {
      const err = e as ZooworkError
      report('7 cron schedule', 'NO-GO', `${err.status} ${err.type} ${err.message}`)
    } finally {
      if (scheduleCreated) {
        await zc.deleteSchedule(agentId, scheduleId).catch((e) => console.log('deleteSchedule failed:', e.message))
        console.log('schedule deleted')
      }
    }
  } else report('7 cron schedule', 'SKIP', 'M0_SKIP')

  // Step 8 (optional) — real logins
  const logins: { name: string; url: string; email?: string; password?: string }[] = [
    { name: 'doordash', url: 'https://www.doordash.com/merchant/login/', email: process.env.M0_DD_EMAIL, password: process.env.M0_DD_PASSWORD },
    { name: 'ubereats', url: 'https://merchants.ubereats.com/manager/home', email: process.env.M0_UE_EMAIL, password: process.env.M0_UE_PASSWORD },
  ]
  for (const l of logins) {
    if (!l.email || !l.password) { report(`8 ${l.name} login`, 'SKIP', `set M0_${l.name === 'doordash' ? 'DD' : 'UE'}_EMAIL/_PASSWORD to run`); continue }
    const r = await runTurn(zc, agentId, [
      `Use the browser-ops skill. Go to ${l.url} and log in with email "${l.email}" and the password "${l.password}".`,
      'If a 2FA / verification code screen appears, STOP there (do not guess a code) and report reached_state="2fa_required" with the exact prompt text and how the code is delivered (email/SMS/app).',
      'If you see a CAPTCHA or bot check, STOP and report reached_state="captcha".',
      'If login succeeds, report reached_state="logged_in", the page title, and the names of the stores/businesses you can see in the account. Then, if an Ads or Marketing / Promotions section is visible, open it and list the campaign names and their current daily/monthly budgets. Change nothing.',
      SUMMARY_INSTRUCTION.replace('<mode>', `login-${l.name}`),
    ].join('\n'), `login-${l.name}`)
    const c = r.summary?.checks[0]
    report(`8 ${l.name} login`, c?.reached_state === 'logged_in' ? 'GO' : 'INFO', `reached_state=${c?.reached_state ?? 'unknown'} notes=${c?.notes ?? r.summaryError ?? ''}`)
  }

  // Teardown
  if (process.env.M0_KEEP_AGENT === '1') {
    report('teardown', 'SKIP', `M0_KEEP_AGENT=1 — agent ${agentId} left running; rerun with M0_AGENT_ID=${agentId} to reuse`)
  } else {
    for (const s of await zc.listSchedules(agentId)) {
      const id = (s as any).name ?? (s as any).memo?.schedule_id
      if (id) await zc.deleteSchedule(agentId, id).catch(() => {})
    }
    await zc.stopAgent(agentId)
    await zc.deleteAgent(agentId)
    const left = await zc.listAgents({ labels: LABELS })
    report('teardown', left.length === 0 ? 'GO' : 'NO-GO', `schedules removed, agent stopped+deleted; listAgents(labels) → ${left.length}`)
  }

  console.log('\n\n================ M0 SUMMARY ================')
  for (const r of results) console.log(`${r.verdict.padEnd(6)} ${r.step}`)
  console.log(`total ${stamp()}`)
}

main().catch((e) => {
  if (e instanceof ZooworkError) console.error('ZooworkError', e.status, e.type, e.message)
  else console.error(e)
  process.exit(1)
})
