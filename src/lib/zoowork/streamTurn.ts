// Reconnecting stream wrapper, copied from the ZooWork skill's events-and-streaming.md.
// The SDK's streamEvents opens ONE request and ends when the server closes it; looping is ours.
import {
  ZooworkError, assistantText, isRunFinished, runOutcome,
  type SessionEvent, type ZooworkClient,
} from '@zoowork-ai/sdk'

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve()
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => { clearTimeout(t); resolve() }, { once: true })
  })

export interface TurnResult {
  outcome?: 'succeeded' | 'failed' | 'aborted'
  text: string
  cursor?: string // valid to resume from even when outcome is undefined
}

export async function streamTurn(
  zc: ZooworkClient,
  agentId: string,
  sessionId: string,
  opts: { cursor?: string; afterSeq?: number; signal?: AbortSignal; maxAttempts?: number; onEvent?: (ev: SessionEvent) => void } = {},
): Promise<TurnResult> {
  const maxAttempts = opts.maxAttempts ?? 6
  let cursor = opts.cursor
  let text = ''

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const attemptCtl = new AbortController()
    const relay = () => attemptCtl.abort()
    opts.signal?.addEventListener('abort', relay, { once: true })
    if (opts.signal?.aborted) attemptCtl.abort()

    try {
      for await (const ev of zc.streamEvents(agentId, sessionId, {
        ...(cursor ? { cursor } : {}),
        signal: attemptCtl.signal,
      })) {
        cursor = ev.cursor ?? cursor
        // Multi-turn session without a saved cursor: ignore everything from earlier turns.
        if (opts.afterSeq != null && ev.seq <= opts.afterSeq) continue
        text += assistantText(ev)
        opts.onEvent?.(ev)
        if (isRunFinished(ev)) {
          const outcome = runOutcome(ev)
          return { ...(outcome ? { outcome } : {}), text, ...(cursor ? { cursor } : {}) }
        }
      }
    } catch (e) {
      if (e instanceof ZooworkError && e.status >= 400 && e.status < 500) throw e
    } finally {
      opts.signal?.removeEventListener('abort', relay)
      attemptCtl.abort()
    }

    if (opts.signal?.aborted) return { text, ...(cursor ? { cursor } : {}) }
    await sleep(Math.min(1_000 * 2 ** attempt, 15_000), opts.signal)
  }

  return { text, ...(cursor ? { cursor } : {}) }
}
