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

/**
 * Extract image URLs and clean markdown from a response string.
 * Returns { cleanText, imageUrls }.
 */
function parseMarkdownImages(raw: string): { cleanText: string; imageUrls: string[] } {
  const imageUrls: string[] = [];
  const cleanText = raw.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, _alt, url) => {
    imageUrls.push(url.trim());
    return "";
  }).replace(/\n{3,}/g, "\n\n").trim();
  return { cleanText, imageUrls };
}

/**
 * Download an image from URL and upload it to iLink media storage.
 * Returns media_id on success, null on failure.
 */
async function uploadImageToILink(
  imageUrl: string,
  botToken: string,
  baseurl?: string,
): Promise<string | null> {
  try {
    const base = baseurl || ILINK_MSG_BASE;

    // Download the image
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      console.warn("[wechat-img] download failed:", imgRes.status, imageUrl.slice(0, 80));
      return null;
    }
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    const ext = contentType.includes("png") ? "png" : contentType.includes("gif") ? "gif" : "jpg";

    // Build multipart form (native FormData + Blob, available in Node 20)
    const form = new FormData();
    form.append("type", "image");
    form.append("media", new Blob([imgBuffer], { type: contentType }), `image.${ext}`);

    // Upload — omit Content-Type so fetch sets multipart boundary automatically
    const { "Content-Type": _ct, ...headersWithoutCT } = authHeaders(botToken);
    const uploadRes = await fetch(`${base}/ilink/bot/upload_media`, {
      method: "POST",
      headers: headersWithoutCT,
      body: form,
    });
    const uploadBody = await uploadRes.text().catch(() => "");
    console.log("[wechat-img] upload response:", uploadRes.status, uploadBody.slice(0, 200));
    if (!uploadRes.ok) return null;

    const data = JSON.parse(uploadBody) as { media_id?: string; ret?: number };
    if (data.ret && data.ret !== 0) return null;
    return data.media_id ?? null;
  } catch (e: any) {
    console.warn("[wechat-img] upload error:", e.message);
    return null;
  }
}

async function sendRawText(
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
  const res = await fetch(`${base}/ilink/bot/sendmessage`, {
    method: "POST",
    headers: authHeaders(config.botToken),
    body: JSON.stringify(body),
  });
  const resBody = await res.text().catch(() => "");
  console.log("[wechat-send]", JSON.stringify({ to: chatId, status: res.status, body: resBody.slice(0, 200) }));
  if (!res.ok) throw new Error(`WeChat sendMessage failed: ${res.status} ${resBody}`);
  try {
    const parsed = JSON.parse(resBody);
    if (parsed.ret && parsed.ret !== 0) throw new Error(`WeChat sendMessage ret=${parsed.ret}: ${resBody}`);
  } catch (e: any) {
    if (e.message.startsWith("WeChat")) throw e;
  }
}

async function sendRawImage(
  chatId: string,
  mediaId: string,
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
      item_list: [{ type: 3, image_item: { media_id: mediaId } }],
      context_token: config.latestContextToken ?? "",
    },
    base_info: { channel_version: "favie-1.0.0" },
  };
  const res = await fetch(`${base}/ilink/bot/sendmessage`, {
    method: "POST",
    headers: authHeaders(config.botToken),
    body: JSON.stringify(body),
  });
  const resBody = await res.text().catch(() => "");
  console.log("[wechat-sendimg]", JSON.stringify({ to: chatId, status: res.status, body: resBody.slice(0, 200) }));
  if (!res.ok) throw new Error(`WeChat sendImage failed: ${res.status} ${resBody}`);
  try {
    const parsed = JSON.parse(resBody);
    if (parsed.ret && parsed.ret !== 0) throw new Error(`WeChat sendImage ret=${parsed.ret}: ${resBody}`);
  } catch (e: any) {
    if (e.message.startsWith("WeChat")) throw e;
  }
}

export async function sendMessage(
  chatId: string,
  text: string,
  config: { botToken: string; baseurl?: string; latestContextToken?: string },
): Promise<void> {
  const { cleanText, imageUrls } = parseMarkdownImages(text);

  // Send the main text (if non-empty after stripping images)
  if (cleanText.trim()) {
    await sendRawText(chatId, cleanText, config);
  }

  // For each image: upload to iLink and send as image message; fallback to URL text
  for (const url of imageUrls) {
    console.log("[wechat-send] processing image:", url.slice(0, 80));
    const mediaId = await uploadImageToILink(url, config.botToken, config.baseurl);
    if (mediaId) {
      console.log("[wechat-send] sending image via media_id:", mediaId);
      await sendRawImage(chatId, mediaId, config).catch(async (e: Error) => {
        console.warn("[wechat-send] image send failed, fallback to URL:", e.message);
        await sendRawText(chatId, url, config);
      });
    } else {
      console.log("[wechat-send] upload failed, sending URL as text");
      await sendRawText(chatId, url, config);
    }
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
