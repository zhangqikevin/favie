import type { Request } from "express";

/**
 * WhatsApp channel handler — uses Baileys (WhatsApp Web protocol).
 * The actual socket lifecycle is managed by whatsapp-manager.ts;
 * this module just satisfies the ChannelHandler interface for
 * message routing in routes.ts.
 */

export function parseIncoming(_req: Request): null {
  // WhatsApp uses persistent WebSocket via Baileys, not HTTP webhooks
  return null;
}

export async function sendMessage(
  chatId: string,
  text: string,
  config: Record<string, unknown>,
): Promise<void> {
  // Actual sending is done through whatsapp-manager.ts via the live socket.
  // This is called from routes.ts for proactive delivery (cron webhooks).
  const { getWhatsAppManager } = await import("../whatsapp-manager");
  const mgr = getWhatsAppManager();
  const bindingId = config._bindingId as string | undefined;
  if (!bindingId) {
    console.warn("[whatsapp] sendMessage called without _bindingId in config");
    return;
  }
  await mgr.sendMessage(bindingId, chatId, text);
}

export async function registerWebhook(
  _webhookUrl: string,
  _config: Record<string, unknown>,
): Promise<{ botUsername: string }> {
  // No webhook to register — Baileys uses WebSocket
  return { botUsername: "whatsapp" };
}
