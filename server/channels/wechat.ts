import type { Request } from "express";

const ILINK_LOGIN_BASE = "https://ilinkai.weixin.qq.com";
const ILINK_MSG_BASE   = "https://api.weixin.qq.com";

function xUin(): string {
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(Math.floor(Math.random() * 0xFFFFFFFF), 0);
  return buf.toString("base64");
}

function pubHeaders(): Record<string, string> {
  return { "X-WECHAT-UIN": xUin(), "Content-Type": "application/json" };
}

function authHeaders(botToken: string): Record<string, string> {
  return {
    "Authorization": `Bearer ${botToken}`,
    "AuthorizationType": "ilink_bot_token",
    "X-WECHAT-UIN": xUin(),
    "Content-Type": "application/json",
  };
}

export interface ILinkMessage {
  from_user_id: string;
  to_user_id: string;
  context_token: string;
  item_list: Array<{ type: number; text?: string }>;
}

// ── Login flow ──────────────────────────────────────────────────────────────

export async function getQrCode(): Promise<{ qrcodeId: string; imgContent: string }> {
  const res = await fetch(`${ILINK_LOGIN_BASE}/ilink/bot/get_bot_qrcode?bot_type=3`, {
    headers: pubHeaders(),
  });
  if (!res.ok) throw new Error(`getQrCode failed: ${res.status}`);
  const data = await res.json() as { qrcode: string; qrcode_img_content: string };
  return { qrcodeId: data.qrcode, imgContent: data.qrcode_img_content };
}

export async function checkQrStatus(
  qrcodeId: string,
): Promise<{ status: "pending" } | { status: "confirmed"; botToken: string; baseurl: string }> {
  const res = await fetch(
    `${ILINK_LOGIN_BASE}/ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrcodeId)}`,
    { headers: pubHeaders() },
  );
  if (!res.ok) throw new Error(`checkQrStatus failed: ${res.status}`);
  const data = await res.json() as { status: string; bot_token?: string; baseurl?: string };
  if (data.status === "confirmed" && data.bot_token) {
    return { status: "confirmed", botToken: data.bot_token, baseurl: data.baseurl ?? ILINK_MSG_BASE };
  }
  return { status: "pending" };
}

// ── ChannelHandler interface ────────────────────────────────────────────────

export function parseIncoming(_req: Request): null {
  return null; // WeChat uses long-polling, not webhooks
}

export async function sendMessage(
  chatId: string,
  text: string,
  config: { botToken: string; baseurl?: string; latestContextToken?: string },
): Promise<void> {
  const base = config.baseurl ?? ILINK_MSG_BASE;
  const body: Record<string, unknown> = {
    to_user_id: chatId,
    item_list: [{ type: 1, text }],
  };
  if (config.latestContextToken) body.context_token = config.latestContextToken;
  const res = await fetch(`${base}/ilink/bot/sendmessage`, {
    method: "POST",
    headers: authHeaders(config.botToken),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`WeChat sendMessage failed: ${res.status}`);
}

export async function registerWebhook(
  _webhookUrl: string,
  config: { botToken: string; baseurl?: string },
): Promise<{ botUsername: string }> {
  // Validate token by doing a quick getupdates call
  const base = config.baseurl ?? ILINK_MSG_BASE;
  const res = await fetch(`${base}/ilink/bot/getupdates?timeout=0`, {
    headers: authHeaders(config.botToken),
  });
  if (!res.ok) throw new Error(`WeChat token validation failed: ${res.status}`);
  return { botUsername: "wechat" };
}

// ── Polling ─────────────────────────────────────────────────────────────────

export async function getUpdates(
  botToken: string,
  baseurl: string | undefined,
  cursor: string | undefined,
  timeout = 0,
  signal?: AbortSignal,
): Promise<{ messages: ILinkMessage[]; nextCursor: string }> {
  const base = baseurl ?? ILINK_MSG_BASE;
  let url = `${base}/ilink/bot/getupdates?timeout=${timeout}`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  const res = await fetch(url, { headers: authHeaders(botToken), signal });
  if (!res.ok) throw new Error(`WeChat getUpdates failed: ${res.status}`);
  const data = await res.json() as { item_list?: ILinkMessage[]; next_cursor?: string };
  return {
    messages: data.item_list ?? [],
    nextCursor: data.next_cursor ?? cursor ?? "",
  };
}
