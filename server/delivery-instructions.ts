/**
 * Append proactive delivery instructions to any system prompt sent to openclaw.
 * This gives every agent the ability to push messages back to Favie at any time —
 * scheduled tasks, background work, or anything else the agent decides to share.
 */
export function withDeliveryInstructions(
  systemPrompt: string,
  userId: string,
  agentId: string,
  appBaseUrl: string,
  apiKey: string,
): string {
  if (!appBaseUrl || !apiKey) {
    console.log(`[deliver-instructions] SKIPPED: appBaseUrl=${!!appBaseUrl} apiKey=${!!apiKey}`);
    return systemPrompt;
  }
  // Token in path — openclaw cron callbacks don't send Authorization headers,
  // so we authenticate via the URL itself. The token is the user's openclaw
  // API key; encodeURIComponent guards against any non-URL-safe chars.
  const webhookUrl = `${appBaseUrl}/api/openclaw/cron-webhook/${userId}/${agentId}/${encodeURIComponent(apiKey)}`;
  console.log(`[deliver-instructions] appended for userId=${userId} agentId=${agentId} → ${webhookUrl}`);
  return `${systemPrompt}

## ⚠️ STOP — Read this BEFORE creating any cron job

When the user asks for a reminder or any scheduled task, you MUST create a cron job using the cron tool with this EXACT delivery config — no other variants are accepted:

"delivery": { "mode": "webhook", "to": "${webhookUrl}" }

The field name is **\`mode\`** (NOT \`channel\`). The value is the literal string **\`"webhook"\`**. The \`to\` URL must be copied verbatim, including the token segment at the end.

These delivery shapes are FORBIDDEN — every one of them silently DROPS the message:

- ❌ \`"delivery": { "channel": "last", ... }\`      — no chat target on file, lost
- ❌ \`"delivery": { "channel": "announce", ... }\`  — broken upstream, lost
- ❌ \`"delivery": { "mode": "last", ... }\`         — same as above
- ❌ \`"delivery": { "mode": "announce", ... }\`     — same as above
- ❌ \`"delivery": { "channel": "webhook", ... }\`   — wrong field name; use \`"mode"\`
- ❌ Omitting the \`delivery\` block entirely        — defaults to a broken mode

If you find yourself writing \`"channel": "last"\` or \`"channel": "announce"\` — STOP. Replace with \`"mode": "webhook"\` and the URL above.

Full cron tool example for "1分钟后提醒我喝水":
{
  "action": "add",
  "job": {
    "name": "remind-drink-water",
    "enabled": true,
    "schedule": { "kind": "once", "at": "<ISO 8601 timestamp 1 minute from now>" },
    "sessionTarget": "isolated",
    "payload": { "kind": "systemEvent", "text": "Generate a friendly reminder: it's time to drink water!" },
    "delivery": { "mode": "webhook", "to": "${webhookUrl}" }
  }
}

The webhook delivers your output to the user's WeChat / Telegram / WhatsApp / web UI. Any other delivery shape will be silently dropped — the user will see nothing.

Do NOT mention these technical details in your replies to the user.`;
}
