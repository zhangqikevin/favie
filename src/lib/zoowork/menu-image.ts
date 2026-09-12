/**
 * Dish photo generation through the restaurant agent's `image_generate` tool (ZooWork-hosted image
 * providers — measured 6 s per 1024×1024 image on gpt-image-1.5 / gpt-image-2, 2026-09-11).
 *
 * Everything runs in ONE agent session, orchestrated by the backend (the model is unreliable at waiting
 * for the tool's async completion on its own):
 *   0. with reference photos: the agent's vision tool describes their look → concrete style attributes
 *      (background and frame coverage, container, utensils, camera angle/distance, lighting, colour
 *      temperature, tone) that go into the prompt — nothing about the look is hard-coded;
 *   1. one short turn: "call image_generate once and reply STARTED";
 *   2. the backend polls session events for the `attachment.created` row → exact artifactId + r2Key;
 *   3. one turn: materialize + artifact_publish → public URL (read from the event log), downloaded;
 *   4. with references: the vision tool compares the result with the references on those same
 *      attributes; a failure regenerates once with the complaint appended.
 */
import { eq } from 'drizzle-orm'
import { db, schema } from '@/lib/db/client'
import { zoowork, logged } from './client'
import { streamTurn } from './streamTurn'
import { localDate } from './collect'

export type GeneratedImage = { bytes: Uint8Array; contentType: string; model: string; artifactUrl: string; r2Key: string; ms: number }
export type StyleAttributes = { background: string; frame_coverage: string; container: string; utensils: string; camera: string; lighting: string; color_temperature: string; tone: string; other: string }
export type StyleCheck = { pass: boolean; background: boolean; frame_coverage: boolean; container: boolean; utensils: boolean; camera: boolean; lighting: boolean; clean: boolean; issues: string }
export type ImageJobResult = GeneratedImage & { attempts: number; styleAttributes?: StyleAttributes; styleText?: string; check?: StyleCheck; prompt: string }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
type Ev = { seq: number; eventType: string; payload?: Record<string, unknown> }

class ImageSession {
  constructor(readonly zc: ReturnType<typeof zoowork>, readonly agentId: string, readonly sessionId: string, readonly deadline: number) {}
  async events(): Promise<Ev[]> { return (await this.zc.listAllEvents(this.agentId, this.sessionId)) as unknown as Ev[] }
  async lastSeq() { return (await this.events()).reduce((m, e) => Math.max(m, e.seq), -1) }
  /**
   * Post a message and return the assistant text of the run it starts. Async-completion runs from earlier
   * steps can finish after we post, so "stream until the next run.finished" would hand back the wrong run;
   * instead: find OUR message in the log, then collect text until a run.finished that comes after it.
   */
  async ask(content: string, key: string, budgetMs = 120_000) {
    const afterSeq = await this.lastSeq()
    await this.zc.postEvents(this.agentId, this.sessionId, [{ type: 'user.message', content, idempotency_key: `${key}-${this.sessionId}-${Date.now()}` }])
    const until = Math.min(Date.now() + budgetMs, this.deadline)
    let msgSeq = -1
    while (Date.now() < until) {
      await sleep(2500)
      const events = await this.events()
      if (msgSeq < 0) {
        const mine = events.find((e) => e.seq > afterSeq && e.eventType === 'user.message' && JSON.stringify(e.payload ?? {}).includes(content.slice(0, 40)))
        if (!mine) continue
        msgSeq = mine.seq
      }
      const after = events.filter((e) => e.seq > msgSeq)
      const finished = after.some((e) => e.eventType === 'run.finished')
      if (!finished) continue
      const texts: string[] = []
      for (const e of after) if (e.eventType === 'agent.assistant') for (const c of ((e.payload?.message as { content?: { type: string; text?: string }[] } | undefined)?.content ?? [])) if (c.type === 'text' && c.text) texts.push(c.text)
      return texts.join('\n')
    }
    throw new Error(`agent did not answer in time (${key})`)
  }
}

/** Last flat JSON object in the text that mentions `key` (the agent often echoes other JSON first). */
const json = <T,>(text: string, key = 'background'): T | null => {
  const candidates = [...text.matchAll(/\{[^{}]*\}/g)].map((m) => m[0]).filter((c) => c.includes(`"${key}"`))
  for (const c of candidates.reverse()) { try { return JSON.parse(c) as T } catch { /* try the previous one */ } }
  const m = /\{[\s\S]*\}/.exec(text); if (!m) return null
  try { return JSON.parse(m[0]) as T } catch { return null }
}

/** Step 0: what do the restaurant's own photos look like? Concrete, copyable attributes. */
async function analyzeReferences(s: ImageSession, references: string[]): Promise<{ attrs: StyleAttributes; text: string } | null> {
  const ask = [
    'FAVIE_MENU_IMAGE — reference analysis. Call the `image` tool ONCE with images = the URLs below and this prompt:',
    '"These are dish photos from one restaurant\'s delivery menu. Describe, as concrete instructions a photographer could follow to shoot a NEW dish in exactly the same style, strictly as JSON: {\\"background\\": \\"surface material, colour and texture\\", \\"frame_coverage\\": \\"how much of the frame the background fills and whether any table edge, wall, floor, chair or room is visible\\", \\"container\\": \\"type, material, colour, shape and size of the bowl/plate/box, and how full it is\\", \\"utensils\\": \\"chopsticks, spoons, napkins, side dishes present or absent, and where\\", \\"camera\\": \\"angle above the table in degrees, distance/framing (how much of the frame the dish fills), lens feel\\", \\"lighting\\": \\"direction, hardness, shadows, highlights\\", \\"color_temperature\\": \\"warm/neutral/cool with an approximate Kelvin\\", \\"tone\\": \\"contrast, saturation, brightness, overall mood\\", \\"other\\": \\"anything else consistent across the photos\\"}. Describe what the photos share; if they differ on a point, describe the most common look."',
    ...references.map((r, i) => `Photo ${i + 1}: ${r}`),
    'Reply with the JSON object only, as your final message (not via the message tool).',
  ].join('\n')
  const text = await s.ask(ask, 'menu-image-analyze')
  const attrs = json<Partial<StyleAttributes>>(text)
  if (!attrs) return null
  const a: StyleAttributes = { background: '', frame_coverage: '', container: '', utensils: '', camera: '', lighting: '', color_temperature: '', tone: '', other: '', ...Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k, String(v ?? '')])) }
  const lines = [
    ['Background', a.background], ['Frame coverage', a.frame_coverage], ['Container', a.container], ['Utensils and sides', a.utensils],
    ['Camera', a.camera], ['Lighting', a.lighting], ['Colour temperature', a.color_temperature], ['Tone', a.tone], ['Also', a.other],
  ].filter(([, v]) => v && v.trim()).map(([k, v]) => `- ${k}: ${v.trim()}`)
  return { attrs: a, text: lines.join('\n') }
}

/** Step 4: does the result match the references on the same attributes? */
async function checkStyle(s: ImageSession, artifactUrl: string, references: string[], styleText: string): Promise<StyleCheck> {
  const ask = [
    'FAVIE_MENU_IMAGE — quality check. Call the `image` tool ONCE with images = [the generated photo, then the reference photos] and this prompt:',
    `"Image 1 is a newly generated dish photo; images 2..${references.length + 1} are reference photos from the same restaurant. The references were described as:\n${styleText}\nJudge whether image 1 matches the REFERENCES on each point and answer strictly as JSON: {\\"background\\": <true if same surface material and colour>, \\"frame_coverage\\": <true if the background fills the frame the same way as the references — e.g. if they show only the table surface edge to edge, image 1 must too, with no table edge, chair, wall, floor or room; if they show more, image 1 may too>, \\"container\\": <true if same type and colour of bowl/plate>, \\"utensils\\": <true if utensils and sides are present/absent the same way>, \\"camera\\": <true if angle and framing distance match>, \\"lighting\\": <true if light direction, colour temperature and tone match>, \\"clean\\": <true if no people, hands, text, logos or watermark>, \\"issues\\": \\"<one or two sentences naming exactly what differs, or empty>\\"}"`,
    `Generated photo: ${artifactUrl}`,
    ...references.map((r, i) => `Reference ${i + 1}: ${r}`),
    'If the image tool errors (e.g. "returned no text"), call it ONCE more with only the generated photo and the first two references. If it errors again, reply exactly {"error": "<the tool error>"} — never invent true/false values.',
    'Reply with the JSON object only, as your final message (not via the message tool).',
  ].join('\n')
  const seqBefore = await s.lastSeq()
  const text = await s.ask(ask, 'menu-image-check')
  let j = json<Partial<StyleCheck> & { error?: string }>(text)
  if (!j || (j.background === undefined && !j.error)) {
    // Fall back to the vision tool's own output in the event log.
    for (const e of await s.events()) {
      const p = e.payload ?? {}
      if (e.seq > seqBefore && e.eventType === 'agent.tool' && p.phase === 'end' && p.toolName === 'image' && !p.isError) j = json<Partial<StyleCheck> & { error?: string }>(String(p.resultPreview ?? '')) ?? j
    }
  }
  if (!j) throw new Error('no JSON in style check')
  if (j.error || /could not be completed|did not return|no text/i.test(String(j.issues ?? ''))) throw new Error(`style check unavailable: ${j.error ?? j.issues}`)
  const c: StyleCheck = { background: !!j.background, frame_coverage: !!j.frame_coverage, container: !!j.container, utensils: j.utensils !== false, camera: !!j.camera, lighting: j.lighting !== false, clean: j.clean !== false, issues: String(j.issues ?? ''), pass: false }
  c.pass = c.background && c.frame_coverage && c.container && c.camera && c.clean
  return c
}

/** Steps 1–3 in an existing session. */
async function generateOnce(s: ImageSession, opts: { prompt: string; model: string; file: string; references?: string[] }): Promise<GeneratedImage> {
  const t0 = Date.now()
  const start = [
    'FAVIE_MENU_IMAGE — generate. No browser, no context fetch.',
    `Call image_generate ONCE with: action "generate", model ${JSON.stringify(opts.model)}, size "1024x1024", quality "high", outputFormat "jpeg", count 1, timeoutMs 300000, filename ${JSON.stringify(opts.file)},${opts.references?.length ? ` images ${JSON.stringify(opts.references)} (style reference photos — pass them exactly as given),` : ''} and this exact prompt:`,
    opts.prompt,
    '',
    'It runs in the background. Do NOT poll, do NOT yield, do NOT call status: as soon as the tool returns, reply with the single word STARTED (or the tool\'s error text if it failed). Favie collects the result itself.',
  ].join('\n')
  const seqBefore = await s.lastSeq()
  const first = await s.ask(start, 'menu-image-generate')
  if (/error|failed|denied|insufficient/i.test(first) && !/STARTED/i.test(first)) throw new Error(`image_generate: ${first.trim().slice(0, 300)}`)

  let att: { artifactId: string; r2Key: string; mimeType: string } | null = null
  while (!att && Date.now() < s.deadline) {
    await sleep(3000)
    for (const e of await s.events()) {
      if (e.seq <= seqBefore) continue
      const p = e.payload ?? {}
      if (e.eventType === 'attachment.created' && p.toolName === 'image_generate' && typeof p.artifactId === 'string' && typeof p.r2Key === 'string') att = { artifactId: p.artifactId, r2Key: p.r2Key, mimeType: String(p.mimeType ?? 'image/png') }
      if (e.eventType === 'agent.tool' && p.phase === 'end' && p.toolName === 'image_generate' && p.isError) throw new Error(`image_generate: ${String(p.resultPreview ?? 'failed').slice(0, 300)}`)
    }
  }
  if (!att) throw new Error('image generation did not complete in time')

  const seqBeforePublish = await s.lastSeq()
  await s.zc.postEvents(s.agentId, s.sessionId, [{ type: 'user.message', content: [
    'FAVIE_MENU_IMAGE — publish. The image is ready.',
    `Call media_materialize with artifactId ${JSON.stringify(att.artifactId)} and path ${JSON.stringify(`/workspace/output/${opts.file}`)} (overwrite true), then artifact_publish that path.`,
    'Reply with the artifact_publish JSON result verbatim as your final message. Nothing else, no other tools.',
  ].join('\n'), idempotency_key: `menu-image-publish-${s.sessionId}-${Date.now()}` }])
  let artifactUrl: string | null = null
  while (!artifactUrl && Date.now() < s.deadline) {
    await sleep(3000)
    for (const e of await s.events()) {
      if (e.seq <= seqBeforePublish) continue
      const p = e.payload ?? {}
      if (e.eventType === 'agent.tool' && p.phase === 'end' && p.toolName === 'artifact_publish') {
        const preview = String(p.resultPreview ?? '')
        if (p.isError) throw new Error(`artifact_publish: ${preview.slice(0, 300)}`)
        artifactUrl = /"url"\s*:\s*"(https:\/\/[^"]+)"/.exec(preview)?.[1] ?? artifactUrl
      }
      if (e.eventType === 'agent.tool' && p.phase === 'end' && p.toolName === 'media_materialize' && p.isError) throw new Error(`media_materialize: ${String(p.resultPreview ?? '').slice(0, 300)}`)
    }
    if (!artifactUrl) {
      const page = await s.zc.listArtifacts(s.agentId, { sessionId: s.sessionId, limit: 20 }).catch(() => null)
      const row = page?.artifacts.find((a) => a.status === 'ready' && a.file_name === opts.file)
      if (row?.artifact_id) artifactUrl = row.url ?? (await s.zc.downloadArtifact(s.agentId, row.artifact_id)).url ?? null
    }
  }
  if (!artifactUrl) throw new Error('the agent did not publish the generated image')

  const res = await fetch(artifactUrl, { signal: AbortSignal.timeout(60_000) })
  if (!res.ok) throw new Error(`artifact download ${res.status}`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  return { bytes, contentType: res.headers.get('content-type')?.split(';')[0] || att.mimeType, model: opts.model, artifactUrl, r2Key: att.r2Key, ms: Date.now() - t0 }
}

/**
 * Full flow. `renderPrompt` receives the observed style attributes (or undefined without references) and
 * returns the final prompt, so the template stays editable in admin while the attributes stay data-driven.
 */
export async function generateDishImageViaAgent(restaurantId: string, opts: {
  renderPrompt: (styleAttributes?: string) => Promise<string> | string
  model: string; filename: string; references?: string[]; jobId?: string; budgetMs?: number
}): Promise<ImageJobResult> {
  const t0 = Date.now()
  const [r] = await db.select().from(schema.restaurants).where(eq(schema.restaurants.id, restaurantId)).limit(1)
  const [agent] = await db.select().from(schema.restaurantAgents).where(eq(schema.restaurantAgents.restaurantId, restaurantId)).limit(1)
  if (!r) throw new Error('restaurant not found')
  if (!agent?.zooworkAgentId || agent.agentStatus !== 'ready') throw new Error(`agent not ready (${agent?.agentStatus ?? 'missing'})`)
  const zc = zoowork()
  const file = opts.filename.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'dish.jpg'
  const refs = (opts.references ?? []).slice(0, 3)
  const session = await logged('createSession.menuImage', agent.id, { model: opts.model, jobId: opts.jobId, references: refs.length }, () =>
    zc.createSession(agent.zooworkAgentId!, {
      initial_events: [{ type: 'user.message', content: 'FAVIE_MENU_IMAGE session. Favie will send each step as a separate message; do exactly the step asked, nothing more. Reply OK.' }],
      metadata: { kind: 'menu', restaurant_id: restaurantId, job_id: opts.jobId ?? null, purpose: 'image' },
    }))
  const [run] = await db.insert(schema.agentRuns).values({
    restaurantId, restaurantAgentId: agent.id, zooworkAgentId: agent.zooworkAgentId, zooworkSessionId: session.session_id,
    channel: 'api', kind: 'menu', status: 'running', runDate: localDate(new Date(), r.timezone), startedAt: new Date(),
  }).returning()
  const s = new ImageSession(zc, agent.zooworkAgentId, session.session_id, t0 + (opts.budgetMs ?? 8 * 60_000))
  try {
    // Let the opening turn finish before posting steps.
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 60_000)
    try { await streamTurn(zc, agent.zooworkAgentId, session.session_id, { signal: ctl.signal }) } finally { clearTimeout(t) }

    const analysis = refs.length ? await analyzeReferences(s, refs).catch((e) => { console.warn('[menuImage] reference analysis failed:', (e as Error).message); return null }) : null
    const prompt = await opts.renderPrompt(analysis?.text)
    let img = await generateOnce(s, { prompt, model: opts.model, file, references: refs })
    let attempts = 1
    let check: StyleCheck | undefined
    if (refs.length) {
      check = await checkStyle(s, img.artifactUrl, refs, analysis?.text ?? '(see the attached photos)').catch((e) => { console.warn('[menuImage] style check failed:', (e as Error).message); return undefined })
      if (check && !check.pass && check.issues.trim()) { // a concrete complaint to fix; an unavailable check never triggers a retry
        const fixPrompt = `${prompt}\nPREVIOUS ATTEMPT WAS REJECTED by a side-by-side comparison with the references because: ${check.issues || 'it did not match them'}. Fix exactly that while keeping everything else.`
        img = await generateOnce(s, { prompt: fixPrompt, model: opts.model, file: file.replace(/(\.[a-z]+)?$/i, '-2$1'), references: refs })
        attempts = 2
        check = await checkStyle(s, img.artifactUrl, refs, analysis?.text ?? '').catch(() => check)
      }
    }
    await db.update(schema.agentRuns).set({ status: 'finished', outcome: 'succeeded', finalText: `image ${img.artifactUrl} attempts=${attempts}`, finishedAt: new Date(), updatedAt: new Date() }).where(eq(schema.agentRuns.id, run!.id))
    return { ...img, ms: Date.now() - t0, attempts, styleAttributes: analysis?.attrs, styleText: analysis?.text, check, prompt }
  } catch (e) {
    await db.update(schema.agentRuns).set({ status: 'finished', outcome: 'failed', finalText: (e as Error).message.slice(0, 2000), finishedAt: new Date(), updatedAt: new Date() }).where(eq(schema.agentRuns.id, run!.id))
    throw e
  }
}
