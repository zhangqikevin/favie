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

export async function generateDishImageViaAgent(restaurantId: string, opts: { prompt: string; model: string; filename: string; jobId?: string; budgetMs?: number }): Promise<GeneratedImage> {
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
    `Call image_generate ONCE with: action "generate", model ${JSON.stringify(opts.model)}, size "1024x1024", quality "high", outputFormat "jpeg", count 1, timeoutMs 300000, filename ${JSON.stringify(file)}, and this exact prompt:`,
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
    const second = await turn(lastSeq)
    let artifactUrl = /"url"\s*:\s*"(https:\/\/[^"]+)"/.exec(second.text)?.[1] ?? null
    let artifactId = /"artifactId"\s*:\s*"(art_[^"]+)"/.exec(second.text)?.[1] ?? null
    if (!artifactUrl) {
      // Fall back to the artifacts API (the tool result is also recorded there).
      const page = await zc.listArtifacts(agentId, { sessionId: session.session_id, limit: 10 })
      const row = page.artifacts.find((a) => a.status === 'ready' && a.url) ?? page.artifacts[0]
      if (row?.artifact_id) { artifactId = row.artifact_id; artifactUrl = row.url ?? (await zc.downloadArtifact(agentId, row.artifact_id)).url ?? null }
    }
    if (!artifactUrl) throw new Error('the agent did not publish the generated image')

    // 4. Download.
    const res = await fetch(artifactUrl, { signal: AbortSignal.timeout(60_000) })
    if (!res.ok) throw new Error(`artifact download ${res.status}`)
    const bytes = new Uint8Array(await res.arrayBuffer())
    const contentType = res.headers.get('content-type')?.split(';')[0] || att.mimeType
    await db.update(schema.agentRuns).set({ status: 'finished', outcome: 'succeeded', finalText: `image ${artifactId ?? ''} ${artifactUrl}`, finishedAt: new Date(), updatedAt: new Date() }).where(eq(schema.agentRuns.id, run!.id))
    return { bytes, contentType, model: opts.model, artifactUrl, r2Key: att.r2Key, ms: Date.now() - t0 }
  } catch (e) {
    await db.update(schema.agentRuns).set({ status: 'finished', outcome: 'failed', finalText: (e as Error).message.slice(0, 2000), finishedAt: new Date(), updatedAt: new Date() }).where(eq(schema.agentRuns.id, run!.id))
    throw e
  } finally {
    void toolCall // keep the SDK helper import alive for future event parsing
  }
}
