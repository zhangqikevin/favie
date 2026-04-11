import type { Request } from "express";

export interface IncomingMessage {
  chatId: string;
  text: string;
}

export interface TelegramConfig {
  botToken: string;
  botUsername?: string;
}

export function parseIncoming(req: Request): IncomingMessage | null {
  const msg = req.body?.message;
  if (!msg?.text) return null;
  return { chatId: String(msg.chat.id), text: msg.text };
}

export async function sendMessage(
  chatId: string,
  text: string,
  config: TelegramConfig,
): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Telegram sendMessage failed: ${res.status} ${err}`);
  }
}

export async function registerWebhook(
  webhookUrl: string,
  config: TelegramConfig,
): Promise<{ botUsername: string }> {
  const setRes = await fetch(`https://api.telegram.org/bot${config.botToken}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: webhookUrl }),
  });
  if (!setRes.ok) {
    const err = await setRes.text();
    throw new Error(`Telegram setWebhook failed: ${setRes.status} ${err}`);
  }

  const meRes = await fetch(`https://api.telegram.org/bot${config.botToken}/getMe`);
  const me = (await meRes.json()) as { result: { username: string } };
  return { botUsername: me.result.username };
}
