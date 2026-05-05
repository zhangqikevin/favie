/**
 * Call openclaw for a chat completion.
 * Full systemPrompt is passed as messages[0] (system role) — authoritative context for this call.
 *
 * Bounded by an 8-minute AbortController so a stalled upstream surfaces as a
 * clean timeout error instead of hanging on the request socket forever.
 */
const OPENCLAW_FETCH_TIMEOUT_MS = 8 * 60 * 1000;

export async function callOpenclaw(
  baseUrl: string,
  apiKey: string,
  ocAgentId: string,
  sessionId: string,
  systemPrompt: string,
  messages: { role: string; content: string }[],
  maxTokens: number,
): Promise<string> {
  const body = {
    model: `openclaw/${ocAgentId}`,
    user: sessionId,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENCLAW_FETCH_TIMEOUT_MS);
  const startedAt = Date.now();

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e: any) {
    const elapsed = Date.now() - startedAt;
    if (e?.name === "AbortError") {
      throw new Error(`openclaw chat timed out after ${elapsed}ms (limit ${OPENCLAW_FETCH_TIMEOUT_MS}ms). Long-running operations like video generation must use async cron delivery, not block the chat HTTP request.`);
    }
    throw new Error(`openclaw chat fetch error after ${elapsed}ms: ${e?.message ?? e}`);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`openclaw chat failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as {
    choices: { message: { content: string | null; tool_calls?: any[] } }[];
  };
  const msg = data.choices[0]?.message;
  console.log("[openclaw] response:", JSON.stringify({ elapsedMs: Date.now() - startedAt, content: msg?.content?.slice(0, 200) ?? null, hasToolCalls: !!msg?.tool_calls?.length, choiceCount: data.choices?.length }));
  return msg?.content ?? "";
}

/**
 * Tracks per-agent initialization state to prevent race conditions where
 * concurrent first-time requests would all fire SOUL.md init in parallel
 * (which is what caused the "agent dir exists but not in openclaw.json" bug).
 *
 * - `initializedSouls`: agent IDs that have completed init successfully this lifetime
 * - `inFlightInits`: agent IDs currently initializing — concurrent callers share the same promise
 */
const initializedSouls = new Set<string>();
const inFlightInits = new Map<string, Promise<void>>();
/**
 * Negative cache: when soul-init fails after retries, remember the failure for
 * a short window so the NEXT incoming chat message doesn't pay the same
 * 3-attempt + backoff penalty (~1.8s minimum). After the window expires we
 * try again. Keeps the user-facing latency near callOpenclaw's own RTT even
 * when the upstream openclaw URL is misconfigured.
 */
const failedSoulInits = new Map<string, number>(); // ocAgentId → retryAfter (ms epoch)
const FAILED_SOUL_INIT_TTL_MS = 60_000;

/**
 * Run a single SOUL.md init attempt with retries. Concurrent callers for the
 * same agent share the same promise (via inFlightInits map), so we never fire
 * the init in parallel for the same agent.
 *
 * On final failure, the agent is NOT marked initialized — the next call will
 * retry. This guarantees agents reach a fully-registered state before users
 * are allowed to chat with them, eliminating the "half-created" race.
 */
async function ensureSoulInit(
  ocAgentId: string,
  baseUrl: string,
  apiKey: string,
  userId: string,
  webhookUrl: string,
): Promise<void> {
  if (initializedSouls.has(ocAgentId)) return;

  const existing = inFlightInits.get(ocAgentId);
  if (existing) return existing;

  const promise = (async () => {
    const soulContent = [
      "# ⚠️ MANDATORY: Cron Delivery Config",
      "",
      "When creating ANY cron job or scheduled task, you MUST use webhook delivery.",
      "NEVER use announce mode — it is broken and will fail.",
      "",
      "ALWAYS copy this delivery block exactly:",
      "",
      `delivery: { "mode": "webhook", "to": "${webhookUrl}" }`,
      "",
      "Full example for a reminder:",
      `{ "action": "add", "job": { "name": "remind", "enabled": true, "schedule": { "kind": "once", "at": "<ISO timestamp>" }, "sessionTarget": "isolated", "payload": { "kind": "systemEvent", "text": "<reminder prompt>" }, "delivery": { "mode": "webhook", "to": "${webhookUrl}" } } }`,
      "",
      "This webhook forwards to the user's WeChat/Telegram. If you use announce, the message is LOST.",
    ].join("\n");

    const maxAttempts = 3;
    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`[soul-init] ${ocAgentId} attempt ${attempt}/${maxAttempts} → ${webhookUrl}`);
        const reply = await callOpenclaw(
          baseUrl,
          apiKey,
          ocAgentId,
          `${userId}-soul-init`,
          "You are being initialized. Your only job right now is to write the provided content to your SOUL.md file using the Write tool. Reply only with 'Done.' after writing.",
          [
            {
              role: "user",
              content: `Please write the following content to your SOUL.md file now:\n\n${soulContent}`,
            },
          ],
          50,
        );
        initializedSouls.add(ocAgentId);
        console.log(`[soul-init] ✅ ${ocAgentId} registered (attempt ${attempt}): ${reply?.slice(0, 80)}`);
        return;
      } catch (e) {
        lastErr = e;
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`[soul-init] ❌ ${ocAgentId} attempt ${attempt}/${maxAttempts} failed: ${msg}`);
        if (attempt < maxAttempts) {
          // Exponential-ish backoff: 600ms, 1200ms
          await new Promise((r) => setTimeout(r, 600 * attempt));
        }
      }
    }
    // All attempts failed — leave initializedSouls unset so the NEXT request retries.
    // We re-throw so the caller can decide whether to surface the failure.
    const errMsg = lastErr instanceof Error ? lastErr.message : String(lastErr);
    throw new Error(`soul-init failed for ${ocAgentId} after ${maxAttempts} attempts: ${errMsg}`);
  })();

  inFlightInits.set(ocAgentId, promise);
  // Always clear in-flight slot, win or lose, so a failed init can be retried later.
  // Note: `.finally()` on a rejecting promise returns a NEW rejecting promise.
  // If we don't attach a `.catch()` to that chain, the rejection becomes an
  // unhandled-promise-rejection and Node 20 will crash the process — even
  // though the actual caller already awaits & catches the original promise.
  promise.finally(() => inFlightInits.delete(ocAgentId)).catch(() => {});

  return promise;
}

/**
 * Return a per-user openclaw agent ID for this request, and on first use
 * AWAIT initialization of the agent's SOUL.md before returning.
 *
 * Why we await: openclaw's auto-registration (writing the agent into
 * openclaw.json) only happens reliably when the init call completes BEFORE any
 * other concurrent chat call hits the same new agent. Previously this was
 * fire-and-forget, which created a race where the user's actual chat request
 * would arrive while init was still in-flight — leading to "half-created"
 * agents that had a session directory on disk but no entry in openclaw.json.
 *
 * Concurrent callers for the same agent share one in-flight init promise.
 * Init is retried up to 3 times with backoff. If init still fails, we log
 * loudly and let the chat proceed anyway (better degraded service than total
 * block); the next call will retry from scratch.
 *
 * Format: favie2-{userId[0..7]}-{favieAgentId}
 * Example: favie2-a1b2c3d4-operation
 */
export async function syncOpencrawAgent(
  userId: string,
  _restaurantId: string,
  agentId: string,
  _restaurantName: string,
  _cuisine: string,
  _fullSystemPrompt: string,
  resolved: { baseUrl: string; apiKey: string; appBaseUrl: string },
): Promise<string> {
  const ocAgentId = `favie2-${userId.slice(0, 8)}-${agentId}`;

  const { baseUrl, apiKey, appBaseUrl } = resolved;
  if (!appBaseUrl || !apiKey || !baseUrl) {
    return ocAgentId;
  }

  if (!initializedSouls.has(ocAgentId)) {
    // Negative cache: skip the (slow, failure-prone) init if we just failed.
    const retryAfter = failedSoulInits.get(ocAgentId);
    if (retryAfter && Date.now() < retryAfter) {
      return ocAgentId;
    }

    const webhookUrl = `${appBaseUrl}/api/openclaw/cron-webhook/${userId}/${agentId}`;
    try {
      await ensureSoulInit(ocAgentId, baseUrl, apiKey, userId, webhookUrl);
      failedSoulInits.delete(ocAgentId);
    } catch (e) {
      // Init failed after retries — log loudly but don't block the user's chat.
      // Mark the agent as "do not retry for FAILED_SOUL_INIT_TTL_MS" so the
      // next incoming message doesn't pay the retry penalty again.
      failedSoulInits.set(ocAgentId, Date.now() + FAILED_SOUL_INIT_TTL_MS);
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[soul-init] ⚠️  proceeding without confirmed init for ${ocAgentId} (will retry after ${FAILED_SOUL_INIT_TTL_MS / 1000}s): ${msg}`);
    }
  }

  return ocAgentId;
}
