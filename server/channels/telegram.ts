import type { Request } from "express";
import { parseMarkdownMedia } from "../media-markdown";

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

async function tgCall(
  botToken: string,
  method: string,
  body: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Telegram ${method} failed: ${res.status} ${err}`);
  }
}

export async function sendMessage(
  chatId: string,
  text: string,
  config: TelegramConfig,
): Promise<void> {
  const { cleanText, images, videos } = parseMarkdownMedia(text);

  if (cleanText.trim()) {
    await tgCall(config.botToken, "sendMessage", { chat_id: chatId, text: cleanText });
  }

  // Telegram fetches media from the URL directly — no need to download ourselves.
  for (const url of images) {
    try {
      await tgCall(config.botToken, "sendPhoto", { chat_id: chatId, photo: url });
    } catch (e: any) {
      console.warn("[telegram] sendPhoto failed, fallback to text URL:", e?.message ?? e);
      await tgCall(config.botToken, "sendMessage", { chat_id: chatId, text: url });
    }
  }

  for (const url of videos) {
    try {
      await tgCall(config.botToken, "sendVideo", { chat_id: chatId, video: url });
    } catch (e: any) {
      console.warn("[telegram] sendVideo failed, fallback to text URL:", e?.message ?? e);
      await tgCall(config.botToken, "sendMessage", { chat_id: chatId, text: url });
    }
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
