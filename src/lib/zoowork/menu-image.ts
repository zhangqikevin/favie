/**
 * Dish photo generation through the restaurant agent's `image_generate` tool (ZooWork-hosted image
 * providers — measured 6 s per 1024×1024 image on gpt-image-1.5 / gpt-image-2, 2026-09-11).
 *
 * The tool runs as a background task and delivers its result as an `attachment.created` session event;
 * the model itself is unreliable at waiting for that completion (it yields, polls, and sometimes never
 * sees the event). So the BACKEND orchestrates:
 *   1. one short turn: "call image_generate once and reply STARTED" (the agent never waits);
 *   2. poll the session's events for the `attachment.created` row → exact artifactId + r2Key;
 *   3. one more turn: "materialize that artifactId to /workspace/output/<file> and artifact_publish it";
 *   4. read the artifact URL from that turn's tool result (or via listArtifacts) and download it.
 */
import { eq } from 'drizzle-orm'
import { toolCall } from '@zoowork-ai/sdk'
import { db, schema } from '@/lib/db/client'
import { zoowork, logged } from './client'
import { streamTurn } from './streamTurn'
import { localDate } from './collect'

export type GeneratedImage = { bytes: Uint8Array; contentType: string; model: string; artifactUrl: string; r2Key: string; ms: number }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export type StyleCheck = { pass: boolean; edge_to_edge: boolean; same_surface: boolean; same_container: boolean; same_angle: boolean; clean: boolean; issues: string }

/**
 * Generate, then (when reference photos were given) have the agent's vision tool compare the result with
 * the references. A failed check regenerates once with the concrete complaint appended to the prompt;
 * the second attempt is kept either way (with its check recorded) so the owner always gets a photo.
 */
export async function generateDishImageViaAgent(restaurantId: string, opts: { prompt: string; model: string; filename: string; references?: string[]; jobId?: string; budgetMs?: number }): Promise<GeneratedImage & { check?: StyleCheck; attempts: number }> {
  const first = await generateOnce(restaurantId, opts)
  if (!opts.references?.length) return { ...first, attempts: 1 }
  const check = await checkStyle(first.sessionId, first.agentId, first.artifactUrl, opts.references).catch((e) => { console.warn('[menuImage] style check failed:', (e as Error).message); return null })
  if (!check || check.pass) return { ...first, check: check ?? undefined, attempts: 1 }
  const correction = `\nPREVIOUS ATTEMPT WAS REJECTED because: ${check.issues}. Fix exactly that. ${!check.edge_to_edge ? 'The table surface must fill the whole frame edge to edge with no table edge, chair, wall or room visible, as in the references.' : ''}`
  const second = await generateOnce(restaurantId, { ...opts, prompt: opts.prompt + correction, filename: opts.filename.replace(/(\.[a-z]+)?$/i, '-2$1') })
  const check2 = await checkStyle(second.sessionId, second.agentId, second.artifactUrl, opts.references).catch(() => null)
  return { ...second, check: check2 ?? undefined, attempts: 2 }
}

/** Vision comparison inside the same session: the `image` tool takes URLs, so the published artifact and the reference photos go in together. */
async function checkStyle(sessionId: string, agentId: string, artifactUrl: string, references: string[]): Promise<StyleCheck> {
  const zc = zoowork()
  const ask = [
    'FAVIE_MENU_IMAGE — quality check. Call the `image` tool ONCE with images = [the generated photo, then the reference photos] and this prompt:',
    `"Image 1 is a newly generated dish photo; images 2..${references.length + 1} are reference photos from the same restaurant menu. Answer strictly as JSON: {\"edge_to_edge\": <true if in image 1 the table/background surface fills the entire frame edge to edge with NO table edge, chair, wall, window, floor or room visible>, \"same_surface\": <true if image 1 uses the same kind of table/background surface and colour as the references>, \"same_container\": <true if the bowl/plate type and colour match the references>, \"same_angle\": <true if camera angle and framing distance are similar>, \"clean\": <true if image 1 has no people, hands, text, logos or watermark>, \"issues\": \"<one sentence naming what differs, or empty>\"}"`,
    `Generated photo: ${artifactUrl}`,
    ...references.map((r, i) => `Reference ${i + 1}: ${r}`),
    'Reply with the JSON object only, as your final message (not via the message tool).',
  ].join('\n')
  const prior = await zc.listAllEvents(agentId, sessionId)
  const afterSeq = prior.reduce((m, e) => Math.max(m, e.seq), -1)
  await zc.postEvents(agentId, sessionId, [{ type: 'user.message', content: ask, idempotency_key: `menu-image-check-${sessionId}-${Date.now()}` }])
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 120_000)
  let text = ''
  try { text = (await streamTurn(zc, agentId, sessionId, { signal: ctl.signal, afterSeq })).text } finally { clearTimeout(t) }
  const m = /\{[\s\S]*\}/.exec(text)
  if (!m) throw new Error('no JSON in style check')
  const j = JSON.parse(m[0]) as Partial<StyleCheck>
  const c: StyleCheck = { edge_to_edge: !!j.edge_to_edge, same_surface: !!j.same_surface, same_container: !!j.same_container, same_angle: !!j.same_angle, clean: j.clean !== false, issues: String(j.issues ?? ''), pass: false }
  c.pass = c.edge_to_edge && c.same_surface && c.clean // container/angle are advisory
  return c
}

async function generateOnce(restaurantId: string, opts: { prompt: string; model: string; filename: string; references?: string[]; jobId?: string; budgetMs?: number }): Promise<GeneratedImage & { sessionId: string; agentId: string }> {
  const t0 = Date.now()
  const [r] = await db.select().from(schema.restaurants).where(eq(schema.restaurants.id, restaurantId)).limit(1)
  const [agent] = await db.select().from(schema.restaurantAgents).where(eq(schema.restaurantAgents.restaurantId, restaurantId)).limit(1)
  if (!r) throw new Error('restaurant not found')
  if (!agent?.zooworkAgentId || agent.agentStatus !== 'ready') throw new Error(`agent not ready (${agent?.agentStatus ?? 'missing'})`)
  const zc = zoowork()
  const agentId = agent.zooworkAgentId
  const file = opts.filename.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'dish.jpg'

  // 1. Start the generation. The agent must not wait for it.
  const start = [
    'FAVIE_MENU_IMAGE — step 1 of 2. No browser, no context fetch.',
    `Call image_generate ONCE with: action "generate", model ${JSON.stringify(opts.model)}, size "1024x1024", quality "high", outputFormat "jpeg", count 1, timeoutMs 300000, filename ${JSON.stringify(file)},${opts.references?.length ? ` images ${JSON.stringify(opts.references)} (style reference photos — pass them exactly as given),` : ''} and this exact prompt:`,
    opts.prompt,
    '',
    'It runs in the background. Do NOT poll, do NOT yield, do NOT call status: as soon as the tool returns, reply with the single word STARTED (or the tool\'s error text if it failed). Favie collects the result itself.',
  ].join('\n')
  const session = await logged('createSession.menuImage', agent.id, { model: opts.model, jobId: opts.jobId }, () =>
    zc.createSession(agentId, { initial_events: [{ type: 'user.message', content: start }], metadata: { kind: 'menu', restaurant_id: restaurantId, job_id: opts.jobId ?? null, purpose: 'image' } }))
  const [run] = await db.insert(schema.agentRuns).values({
    restaurantId, restaurantAgentId: agent.id, zooworkAgentId: agentId, zooworkSessionId: session.session_id,
    channel: 'api', kind: 'menu', status: 'running', runDate: localDate(new Date(), r.timezone), startedAt: new Date(),
  }).returning()
  const budget = opts.budgetMs ?? 6 * 60_000
  const deadline = t0 + budget
  const turn = async (afterSeq: number) => {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), Math.max(15_000, deadline - Date.now()))
    try { return await streamTurn(zc, agentId, session.session_id, { signal: ctl.signal, afterSeq }) } finally { clearTimeout(t) }
  }
  try {
    const first = await turn(-1)
    if (/error|failed|denied|insufficient/i.test(first.text) && !/STARTED/i.test(first.text)) throw new Error(`image_generate: ${first.text.trim().slice(0, 300)}`)

    // 2. Wait for the attachment.created event of the image_generate task (the generation itself is ~6 s).
    let att: { artifactId: string; r2Key: string; fileName: string; mimeType: string } | null = null
    let lastSeq = -1
    while (!att && Date.now() < deadline) {
      await sleep(3000)
      const events = await zc.listAllEvents(agentId, session.session_id)
      for (const e of events as unknown as { seq: number; eventType: string; payload?: Record<string, unknown> }[]) {
        lastSeq = Math.max(lastSeq, e.seq)
        const p = e.payload ?? {}
        if (e.eventType === 'attachment.created' && p.toolName === 'image_generate' && typeof p.artifactId === 'string' && typeof p.r2Key === 'string') {
          att = { artifactId: p.artifactId, r2Key: p.r2Key, fileName: String(p.fileName ?? file), mimeType: String(p.mimeType ?? 'image/png') }
        }
        if (e.eventType === 'agent.tool' && p.phase === 'end' && p.toolName === 'image_generate' && p.isError) throw new Error(`image_generate: ${String(p.resultPreview ?? 'failed').slice(0, 300)}`)
      }
    }
    if (!att) throw new Error('image generation did not complete in time')

    // 3. Publish it as an artifact so Favie can download it.
    const publish = [
      'FAVIE_MENU_IMAGE — step 2 of 2. The image is ready.',
      `Call media_materialize with artifactId ${JSON.stringify(att.artifactId)} and path ${JSON.stringify(`/workspace/output/${file}`)} (overwrite true), then artifact_publish that path.`,
      'Reply with the artifact_publish JSON result verbatim as your final message. Nothing else, no other tools.',
    ].join('\n')
    await zc.postEvents(agentId, session.session_id, [{ type: 'user.message', content: publish, idempotency_key: `menu-image-publish-${session.session_id}` }])
    // The async-completion run and our follow-up run interleave, so a plain stream of "the next run" is
    // unreliable here; watch the event log for the artifact_publish tool result instead.
    let artifactUrl: string | null = null
    let artifactId: string | null = null
    while (!artifactUrl && Date.now() < deadline) {
      await sleep(3000)
      const events = await zc.listAllEvents(agentId, session.session_id)
      for (const e of events as unknown as { seq: number; eventType: string; payload?: Record<string, unknown> }[]) {
        if (e.seq <= lastSeq) continue
        const p = e.payload ?? {}
        if (e.eventType === 'agent.tool' && p.phase === 'end' && p.toolName === 'artifact_publish') {
          const preview = String(p.resultPreview ?? '')
          artifactUrl = /"url"\s*:\s*"(https:\/\/[^"]+)"/.exec(preview)?.[1] ?? artifactUrl
          artifactId = /"artifactId"\s*:\s*"(art_[^"]+)"/.exec(preview)?.[1] ?? artifactId
          if (p.isError) throw new Error(`artifact_publish: ${preview.slice(0, 300)}`)
        }
        if (e.eventType === 'agent.tool' && p.phase === 'end' && p.toolName === 'media_materialize' && p.isError) throw new Error(`media_materialize: ${String(p.resultPreview ?? '').slice(0, 300)}`)
      }
      if (!artifactUrl) {
        // The artifacts API sees the row as soon as it is finalized, even when the preview was cut short.
        const page = await zc.listArtifacts(agentId, { sessionId: session.session_id, limit: 10 }).catch(() => null)
        const row = page?.artifacts.find((a) => a.status === 'ready' && a.file_name === file)
        if (row?.artifact_id) { artifactId = row.artifact_id; artifactUrl = row.url ?? (await zc.downloadArtifact(agentId, row.artifact_id)).url ?? null }
      }
    }
    if (!artifactUrl) throw new Error('the agent did not publish the generated image')

    // 4. Download.
    const res = await fetch(artifactUrl, { signal: AbortSignal.timeout(60_000) })
    if (!res.ok) throw new Error(`artifact download ${res.status}`)
    const bytes = new Uint8Array(await res.arrayBuffer())
    const contentType = res.headers.get('content-type')?.split(';')[0] || att.mimeType
    await db.update(schema.agentRuns).set({ status: 'finished', outcome: 'succeeded', finalText: `image ${artifactId ?? ''} ${artifactUrl}`, finishedAt: new Date(), updatedAt: new Date() }).where(eq(schema.agentRuns.id, run!.id))
    return { bytes, contentType, model: opts.model, artifactUrl, r2Key: att.r2Key, ms: Date.now() - t0, sessionId: session.session_id, agentId }
  } catch (e) {
    await db.update(schema.agentRuns).set({ status: 'finished', outcome: 'failed', finalText: (e as Error).message.slice(0, 2000), finishedAt: new Date(), updatedAt: new Date() }).where(eq(schema.agentRuns.id, run!.id))
    throw e
  } finally {
    void toolCall // keep the SDK helper import alive for future event parsing
  }
}
