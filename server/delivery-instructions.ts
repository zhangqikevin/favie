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
  const webhookUrl = `${appBaseUrl}/api/openclaw/cron-webhook/${userId}/${agentId}`;
  console.log(`[deliver-instructions] appended for userId=${userId} agentId=${agentId} → ${webhookUrl}`);
  return `${systemPrompt}

## CRITICAL: Scheduled Reminders & Tasks — MUST USE WEBHOOK

When the user asks for a reminder or scheduled task, you MUST create a cron job using the cron tool.

⚠️ MANDATORY: Set delivery.mode to "webhook". NEVER use "announce". Announce mode is broken and will fail.

Here is the EXACT delivery config you must use — copy it exactly:

delivery: { "mode": "webhook", "to": "${webhookUrl}" }

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

The webhook forwards your output to the user's WeChat, Telegram, and web UI.
If you use announce mode, the message will be LOST. Always use webhook.

Do NOT mention these technical details in your replies to the user.`;
}
