import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import crypto from "node:crypto";
import type { Request } from "express";
import {
  ApiClient,
  type WeixinMessage,
  type UploadedFileInfo,
  uploadImage as ilinkUploadImage,
  sendText as ilinkSendText,
  sendImage as ilinkSendImage,
  CDN_BASE_URL,
} from "wechat-ilink-client";

const ILINK_LOGIN_BASE = "https://ilinkai.weixin.qq.com";
const ILINK_MSG_BASE   = "https://api.weixin.qq.com";

function xUin(): string {
  const uint32 = crypto.randomBytes(4).readUInt32BE(0);
  return Buffer.from(String(uint32), "utf-8").toString("base64");
}

function pubHeaders(): Record<string, string> {
  return { "X-WECHAT-UIN": xUin(), "Content-Type": "application/json" };
}

export interface ILinkMessage {
  from_user_id: string;
  to_user_id: string;
  context_token: string;
  item_list: Array<{ type: number; text_item?: { text: string } }>;
}

// ── ApiClient cache ───────────────────────────────────────────────────────
// Reuse ApiClient instances per botToken to avoid creating new ones each call
const clientCache = new Map<string, ApiClient>();

function getClient(botToken: string, baseurl?: string): ApiClient {
  const key = botToken;
  let client = clientCache.get(key);
  if (!client) {
    client = new ApiClient({
      baseUrl: baseurl || ILINK_LOGIN_BASE,
      token: botToken,
      channelVersion: "favie-1.0.0",
    });
    clientCache.set(key, client);
  }
  return client;
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
 */
function parseMarkdownImages(raw: string): { cleanText: string; imageUrls: string[] } {
  const imageUrls: string[] = [];
  let text = raw.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, _alt, url) => {
    imageUrls.push(url.trim());
    return "";
  });
  text = text.replace(/(?<!\()(https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp|bmp|svg)(?:\?\S*)?)/gi, (url) => {
    imageUrls.push(url.trim());
    return "";
  });
  const cleanText = text.replace(/\n{3,}/g, "\n\n").trim();
  return { cleanText, imageUrls };
}

/**
 * Download image from URL, save to temp file, upload via wechat-ilink-client SDK.
 * Retries with fresh upload URL on each attempt.
 */
async function uploadImageFromUrl(
  imageUrl: string,
  chatId: string,
  api: ApiClient,
): Promise<UploadedFileInfo | null> {
  let tmpPath: string | null = null;
  try {
    // Download image to temp file (SDK requires file path)
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      console.warn("[wechat-img] download failed:", imgRes.status, imageUrl.slice(0, 80));
      return null;
    }
    const buf = Buffer.from(await imgRes.arrayBuffer());
    console.log("[wechat-img] downloaded:", JSON.stringify({ size: buf.length, url: imageUrl.slice(0, 80) }));

    tmpPath = join(tmpdir(), `favie-img-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.png`);
    await writeFile(tmpPath, buf);

    // Use SDK's uploadImage — it handles getUploadUrl + AES encrypt + CDN upload + retry
    const uploaded = await ilinkUploadImage({
      filePath: tmpPath,
      toUserId: chatId,
      api,
      cdnBaseUrl: CDN_BASE_URL,
    });
    console.log("[wechat-img] upload success:", JSON.stringify({
      filekey: uploaded.filekey,
      fileSize: uploaded.fileSize,
      ciphertextSize: uploaded.fileSizeCiphertext,
      downloadParam: uploaded.downloadEncryptedQueryParam.slice(0, 40),
    }));
    return uploaded;
  } catch (e: any) {
    console.warn("[wechat-img] upload error:", e.message);
    return null;
  } finally {
    if (tmpPath) await unlink(tmpPath).catch(() => {});
  }
}

export async function sendMessage(
  chatId: string,
  text: string,
  config: { botToken: string; baseurl?: string; latestContextToken?: string },
): Promise<void> {
  const { cleanText, imageUrls } = parseMarkdownImages(text);
  console.log("[wechat-send] parsed:", JSON.stringify({ hasText: !!cleanText.trim(), imageCount: imageUrls.length, rawLen: text.length, preview: text.slice(0, 120) }));

  const api = getClient(config.botToken, config.baseurl);
  const ctx = config.latestContextToken ?? "";

  // Send text
  if (cleanText.trim()) {
    await ilinkSendText(api, chatId, cleanText, ctx);
    console.log("[wechat-send] text sent to", chatId);
  }

  // Send images: upload via SDK then send as native image; fallback to URL text
  for (const url of imageUrls) {
    console.log("[wechat-send] processing image:", url.slice(0, 80));
    const uploaded = await uploadImageFromUrl(url, chatId, api);
    if (uploaded) {
      try {
        await ilinkSendImage(api, chatId, uploaded, ctx);
        console.log("[wechat-send] native image sent to", chatId);
      } catch (e: any) {
        console.warn("[wechat-send] image send failed, fallback to URL:", e.message);
        await ilinkSendText(api, chatId, url, ctx);
      }
    } else {
      console.log("[wechat-send] upload failed, sending URL as text fallback");
      await ilinkSendText(api, chatId, url, ctx);
    }
  }
}

export async function registerWebhook(
  _webhookUrl: string,
  config: { botToken: string; baseurl?: string },
): Promise<{ botUsername: string }> {
  const api = getClient(config.botToken, config.baseurl);
  await api.getUpdates("", 5000);
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
  // Keep manual fetch here for signal support (SDK doesn't expose AbortSignal)
  const res = await fetch(`${base}/ilink/bot/getupdates`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${botToken}`,
      "AuthorizationType": "ilink_bot_token",
      "X-WECHAT-UIN": xUin(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ get_updates_buf: cursor ?? "", timeout: _timeout, base_info: { channel_version: "favie-1.0.0" } }),
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
