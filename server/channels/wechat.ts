import crypto from "node:crypto";
import type { Request } from "express";
import {
  ApiClient,
  type UploadedFileInfo,
  sendText as ilinkSendText,
  sendImage as ilinkSendImage,
  CDN_BASE_URL,
  UploadMediaType,
  encryptAesEcb,
  aesEcbPaddedSize,
  buildCdnUploadUrl,
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
 * Download image from URL and upload to WeChat CDN.
 *
 * Built on SDK primitives (encryptAesEcb / aesEcbPaddedSize / buildCdnUploadUrl
 * / api.getUploadUrl) instead of SDK's uploadImage(), because the SDK's internal
 * retry reuses the same one-shot upload_param. We fetch a fresh upload_param
 * (and fresh filekey + aeskey) on every retry, which is what the WeChat CDN
 * actually needs.
 */
const UPLOAD_MAX_RETRIES = 4;

async function uploadImageFromUrl(
  imageUrl: string,
  chatId: string,
  api: ApiClient,
): Promise<UploadedFileInfo | null> {
  // Download image once — guarded so any network/stream error returns null
  // (NOT throws), letting sendMessage fall back to URL text.
  let plaintext: Buffer;
  let rawsize: number;
  let rawfilemd5: string;
  let filesize: number;
  try {
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      console.warn("[wechat-img] download failed:", imgRes.status, imageUrl.slice(0, 80));
      return null;
    }
    plaintext = Buffer.from(await imgRes.arrayBuffer());
    rawsize = plaintext.length;
    rawfilemd5 = crypto.createHash("md5").update(plaintext).digest("hex");
    filesize = aesEcbPaddedSize(rawsize);
    console.log("[wechat-img] downloaded:", JSON.stringify({
      size: rawsize,
      md5: rawfilemd5.slice(0, 12),
      url: imageUrl.slice(0, 80),
    }));
  } catch (e: any) {
    console.warn("[wechat-img] download error:", e?.message ?? e, imageUrl.slice(0, 80));
    return null;
  }

  let lastErr: unknown;
  for (let attempt = 1; attempt <= UPLOAD_MAX_RETRIES; attempt++) {
    // Fresh per-attempt material — upload_param appears to be one-shot/short-TTL
    const filekey = crypto.randomBytes(16).toString("hex");
    const aeskey = crypto.randomBytes(16);

    try {
      // Step 1: get fresh upload_param
      const t0 = Date.now();
      const resp = await api.getUploadUrl({
        filekey,
        media_type: UploadMediaType.IMAGE,
        to_user_id: chatId,
        rawsize,
        rawfilemd5,
        filesize,
        no_need_thumb: true,
        aeskey: aeskey.toString("hex"),
      });
      const getUrlMs = Date.now() - t0;
      // WeChat CDN returns either:
      //   - new: `upload_full_url` (complete pre-signed URL, includes encrypted_query_param + filekey + taskid)
      //   - old: `upload_param` (string we used to combine via buildCdnUploadUrl)
      const uploadParam = (resp as any).upload_param as string | undefined;
      const uploadFullUrl = (resp as any).upload_full_url as string | undefined;
      if (!uploadParam && !uploadFullUrl) {
        throw new Error(`getUploadUrl returned no upload_param/upload_full_url: ${JSON.stringify(resp)}`);
      }
      console.log("[wechat-img] attempt", attempt, "got upload params:", JSON.stringify({
        ms: getUrlMs,
        filekey: filekey.slice(0, 12),
        mode: uploadFullUrl ? "full_url" : "param",
        len: (uploadFullUrl ?? uploadParam ?? "").length,
      }));

      // For new `upload_full_url` mode, the URL is pre-signed and (per WeChat's nova
      // CDN) appears to expect RAW image bytes. AES encryption is only required for
      // the legacy `upload_param` flow.
      const useFullUrl = !!uploadFullUrl;
      const body: Buffer = useFullUrl ? plaintext : encryptAesEcb(plaintext, aeskey);
      const cdnUrl = uploadFullUrl
        ?? buildCdnUploadUrl({ cdnBaseUrl: CDN_BASE_URL, uploadParam: uploadParam!, filekey });
      const contentType = useFullUrl ? "image/png" : "application/octet-stream";

      const postT0 = Date.now();
      const cdnRes = await fetch(cdnUrl, {
        method: "POST",
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(body.length),
        },
        body: new Uint8Array(body),
      });
      const postMs = Date.now() - postT0;

      // Capture all response headers + body snippet for debugging
      const allHeaders: Record<string, string> = {};
      cdnRes.headers.forEach((v, k) => { allHeaders[k] = v; });
      const respBody = await cdnRes.text().catch(() => "(unreadable)");
      console.log("[wechat-img] attempt", attempt, "CDN POST result:", JSON.stringify({
        status: cdnRes.status,
        postMs,
        mode: useFullUrl ? "full_url-raw" : "param-aes",
        bodyLen: body.length,
        contentType,
        headers: allHeaders,
        bodySnippet: respBody.slice(0, 500),
      }));

      if (cdnRes.status !== 200) {
        throw new Error(`CDN POST ${cdnRes.status} (${postMs}ms): ${(allHeaders["x-error-message"] ?? respBody).slice(0, 200)}`);
      }

      // Try to extract download params from headers (legacy) or JSON body (new)
      let downloadParam = cdnRes.headers.get("x-encrypted-param") ?? undefined;
      if (!downloadParam && respBody) {
        try {
          const j = JSON.parse(respBody);
          downloadParam = j.encrypted_query_param ?? j.download_param ?? j.x_encrypted_param;
        } catch { /* not json */ }
      }
      if (!downloadParam) {
        throw new Error(`CDN POST 200 but no download param in headers/body (${postMs}ms)`);
      }

      const uploaded: UploadedFileInfo = {
        filekey,
        downloadEncryptedQueryParam: downloadParam,
        aeskey: aeskey.toString("hex"),
        fileSize: rawsize,
        fileSizeCiphertext: useFullUrl ? rawsize : filesize,
      };
      console.log("[wechat-img] upload success:", JSON.stringify({
        attempt,
        postMs,
        filekey: filekey.slice(0, 12),
        downloadParam: downloadParam.slice(0, 40),
      }));
      return uploaded;
    } catch (e: any) {
      lastErr = e;
      console.warn(`[wechat-img] attempt ${attempt}/${UPLOAD_MAX_RETRIES} failed:`, e?.message ?? e);
      if (attempt < UPLOAD_MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
  }

  console.warn("[wechat-img] all upload attempts failed:", (lastErr as any)?.message ?? lastErr);
  return null;
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
  const data = await res.json() as { msgs?: ILinkMessage[]; get_updates_buf?: string; ret?: number; errcode?: number; errmsg?: string };
  // Detect expired/dead ilink session — throw a typed error so poller can deactivate binding
  if (data.errcode && data.errcode !== 0) {
    const err = new Error(`WeChat ilink error ${data.errcode}: ${data.errmsg ?? "(no msg)"}`);
    (err as any).ilinkErrcode = data.errcode;
    throw err;
  }
  const msgCount = data.msgs?.length ?? 0;
  const inCursor = (cursor ?? "").slice(0, 20);
  const outCursor = (data.get_updates_buf ?? "").slice(0, 20);
  if (msgCount === 0 && inCursor !== outCursor && inCursor !== "") {
    console.log("[wechat] getUpdates ghost advance (cursor moved, 0 msgs) — payload:", JSON.stringify(data));
  } else {
    console.log("[wechat] getUpdates raw response:", JSON.stringify({ ret: data.ret, msgCount, buf: outCursor, firstMsg: data.msgs?.[0] }));
  }
  return {
    messages: data.msgs ?? [],
    nextCursor: data.get_updates_buf ?? cursor ?? "",
  };
}
