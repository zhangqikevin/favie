import crypto from "node:crypto";
import type { Request } from "express";

const ILINK_LOGIN_BASE = "https://ilinkai.weixin.qq.com";
const ILINK_MSG_BASE   = "https://api.weixin.qq.com";

function xUin(): string {
  const uint32 = crypto.randomBytes(4).readUInt32BE(0);
  return Buffer.from(String(uint32), "utf-8").toString("base64");
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
  item_list: Array<{ type: number; text_item?: { text: string } }>;
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
    return { status: "confirmed", botToken: data.bot_token, baseurl: data.baseurl || ILINK_MSG_BASE };
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
  const base = config.baseurl || ILINK_MSG_BASE;
  const clientId = `favie-${crypto.randomBytes(8).toString("hex")}`;
  const body = {
    msg: {
      from_user_id: "",
      to_user_id: chatId,
      client_id: clientId,
      message_type: 2,
      message_state: 2,
      item_list: [{ type: 1, text_item: { text } }],
      context_token: config.latestContextToken ?? "",
    },
    base_info: { channel_version: "favie-1.0.0" },
  };
  console.log("[wechat] getUpdates raw response:", JSON.stringify({ sendMsg: { to: chatId, base, clientId } }));
  const res = await fetch(`${base}/ilink/bot/sendmessage`, {
    method: "POST",
    headers: authHeaders(config.botToken),
    body: JSON.stringify(body),
  });
  const resBody = await res.text().catch(() => "");
  console.log("[wechat] getUpdates raw response:", JSON.stringify({ sendMsgResult: { status: res.status, body: resBody } }));
  if (!res.ok) {
    throw new Error(`WeChat sendMessage failed: ${res.status} ${resBody}`);
  }
}

export async function registerWebhook(
  _webhookUrl: string,
  config: { botToken: string; baseurl?: string },
): Promise<{ botUsername: string }> {
  // Validate token by doing a quick getupdates call (POST, get_updates_buf="")
  const base = config.baseurl || ILINK_MSG_BASE;
  const res = await fetch(`${base}/ilink/bot/getupdates`, {
    method: "POST",
    headers: authHeaders(config.botToken),
    body: JSON.stringify({ get_updates_buf: "", base_info: { channel_version: "favie-1.0.0" } }),
  });
  if (!res.ok) throw new Error(`WeChat token validation failed: ${res.status}`);
  return { botUsername: "wechat" };
}

// ── Polling ─────────────────────────────────────────────────────────────────

export async function getUpdates(
  botToken: string,
  baseurl: string | undefined,
  cursor: string | undefined,
  _timeout = 0,
  signal?: AbortSignal,
): Promise<{ messages: ILinkMessage[]; nextCursor: string }> {
  const base = baseurl || ILINK_MSG_BASE;
  const res = await fetch(`${base}/ilink/bot/getupdates`, {
    method: "POST",
    headers: authHeaders(botToken),
    body: JSON.stringify({ get_updates_buf: cursor ?? "", base_info: { channel_version: "favie-1.0.0" } }),
    signal,
  });
  if (!res.ok) throw new Error(`WeChat getUpdates failed: ${res.status}`);
  const data = await res.json() as { msgs?: ILinkMessage[]; get_updates_buf?: string; ret?: number };
  console.log("[wechat] getUpdates raw response:", JSON.stringify({ ret: data.ret, msgCount: data.msgs?.length, buf: data.get_updates_buf?.slice(0, 20), firstMsg: data.msgs?.[0] }));
  return {
    messages: data.msgs ?? [],
    nextCursor: data.get_updates_buf ?? cursor ?? "",
  };
}
