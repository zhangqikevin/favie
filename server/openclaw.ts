/**
 * Call openclaw for a chat completion.
 * Full systemPrompt is passed as messages[0] (system role) — authoritative context for this call.
 */
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

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`openclaw chat failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as {
    choices: { message: { content: string | null; tool_calls?: any[] } }[];
  };
  const msg = data.choices[0]?.message;
  console.log("[openclaw] response:", JSON.stringify({ content: msg?.content?.slice(0, 200) ?? null, hasToolCalls: !!msg?.tool_calls?.length, choiceCount: data.choices?.length }));
  return msg?.content ?? "";
}

/**
 * Track which agents have already had their SOUL.md initialized this server lifetime.
 * On first encounter, we fire a one-shot call asking the agent to write the delivery
 * config to its SOUL.md so it persists across all future sessions, including cron jobs.
 */
const initializedSouls = new Set<string>();

/**
 * Return a per-user openclaw agent ID for this request, and on first use
 * initialize the agent's SOUL.md with proactive delivery instructions.
 *
 * openclaw auto-creates a new agent the first time it sees an unknown agent ID,
 * so no explicit registration is needed. Agent IDs are scoped per-user × agentType,
 * giving each user a fully isolated workspace, session history, and memory on the
 * remote openclaw instance.
 *
 * Format: favie-{userId[0..7]}-{favieAgentId}
 * Example: favie-a1b2c3d4-operation
 */
export async function syncOpencrawAgent(
  userId: string,
  _restaurantId: string,
  agentId: string,
  _restaurantName: string,
  _cuisine: string,
  _fullSystemPrompt: string,
  cfg: Record<string, string>,
): Promise<string> {
  const ocAgentId = `favie2-${userId.slice(0, 8)}-${agentId}`;

  const appBaseUrl = cfg["app_base_url"] || "https://favieai.replit.app";
  const apiKey = cfg["openclaw_api_key"] ?? "";
  const baseUrl = cfg["openclaw_base_url"] || "https://openclaw.kevinzhang.fun";

  // First time we see this agent: write delivery config to SOUL.md so it persists
  // across all sessions including cron-triggered ones. Fire-and-forget.
  if (appBaseUrl && apiKey && baseUrl && !initializedSouls.has(ocAgentId)) {
    initializedSouls.add(ocAgentId);
    const webhookUrl = `${appBaseUrl}/api/openclaw/cron-webhook/${userId}/${agentId}`;
    console.log(`[soul-init] initializing SOUL.md for ${ocAgentId} → ${webhookUrl}`);

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

    callOpenclaw(
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
    ).then((reply) =>
      console.log(`[soul-init] success for ${ocAgentId}: ${reply?.slice(0, 80)}`),
    ).catch((e: Error) =>
      console.warn(`[soul-init] failed for ${ocAgentId}:`, e.message),
    );
  }

  return ocAgentId;
}
