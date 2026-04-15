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

const CDN_BASE = "https://novac2c.cdn.weixin.qq.com/c2c";

function aesEcbPaddedSize(plaintextSize: number): number {
  return Math.ceil((plaintextSize + 1) / 16) * 16;
}

/**
 * iLink image upload flow (per wechat-ilink-client SDK):
 * 1. Download source image, compute MD5, generate random AES key + filekey
 * 2. POST /ilink/bot/getuploadurl with file metadata → upload_param (encrypted string)
 * 3. AES-128-ECB encrypt image → POST to CDN → x-encrypted-param response header
 * 4. sendmessage with type:2, image_item.media { encrypt_query_param, aes_key (base64), encrypt_type:1 }
 *
 * Returns { downloadParam, aesKeyHex } on success, null on failure.
 */
async function uploadImageToILink(
  imageUrl: string,
  botToken: string,
  chatId: string,
  baseurl?: string,
): Promise<{ downloadParam: string; aesKeyHex: string; ciphertextSize: number } | null> {
  try {
    // Step 1: download source image
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      console.warn("[wechat-img] download failed:", imgRes.status, imageUrl.slice(0, 80));
      return null;
    }
    const plain = Buffer.from(await imgRes.arrayBuffer());
    const rawsize = plain.length;
    const rawfilemd5 = crypto.createHash("md5").update(plain).digest("hex");
    const filesize = aesEcbPaddedSize(rawsize);

    // Generate random AES key and filekey
    const aesKey = crypto.randomBytes(16);
    const aesKeyHex = aesKey.toString("hex");
    const filekey = crypto.randomBytes(16).toString("hex");

    // Step 2: call getuploadurl with file metadata
    const reqBody = {
      filekey,
      media_type: 1, // IMAGE
      to_user_id: chatId,
      rawsize,
      rawfilemd5,
      filesize,
      no_need_thumb: true,
      aeskey: aesKeyHex,
      base_info: { channel_version: "favie-1.0.0" },
    };
    console.log("[wechat-img] getuploadurl request:", JSON.stringify({ filekey, rawsize, filesize, md5: rawfilemd5 }));
    const urlRes = await fetch(`${ILINK_LOGIN_BASE}/ilink/bot/getuploadurl`, {
      method: "POST",
      headers: authHeaders(botToken),
      body: JSON.stringify(reqBody),
    });
    if (!urlRes.ok) {
      console.warn("[wechat-img] getuploadurl HTTP failed:", urlRes.status);
      return null;
    }
    const urlRaw = await urlRes.text();
    console.log("[wechat-img] getuploadurl response:", urlRaw.slice(0, 500));
    const urlData = JSON.parse(urlRaw) as { ret?: number; upload_param?: string; upload_full_url?: string };
    // ret=0 or absent means success; need either upload_full_url or upload_param
    if ((urlData.ret !== undefined && urlData.ret !== 0) || (!urlData.upload_full_url && !urlData.upload_param)) {
      console.warn("[wechat-img] getuploadurl bad ret:", urlData.ret, "has_url:", !!urlData.upload_full_url, "has_param:", !!urlData.upload_param);
      return null;
    }

    // Step 3: AES-128-ECB encrypt and upload to CDN
    const cipher = crypto.createCipheriv("aes-128-ecb", aesKey, null);
    cipher.setAutoPadding(true);
    const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);

    // Use upload_full_url if provided, otherwise build from upload_param
    const cdnUrl = urlData.upload_full_url
      ?? `${CDN_BASE}/upload?encrypted_query_param=${encodeURIComponent(urlData.upload_param!)}&filekey=${encodeURIComponent(filekey)}`;
    console.log("[wechat-img] CDN upload URL:", cdnUrl.slice(0, 120));
    const cdnRes = await fetch(cdnUrl, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: new Uint8Array(encrypted),
    });
    if (!cdnRes.ok) {
      console.warn("[wechat-img] CDN upload failed:", cdnRes.status);
      return null;
    }
    const downloadParam = cdnRes.headers.get("x-encrypted-param");
    if (!downloadParam) {
      console.warn("[wechat-img] CDN: missing x-encrypted-param header");
      return null;
    }
    console.log("[wechat-img] upload success, downloadParam:", downloadParam.slice(0, 40));
    return { downloadParam, aesKeyHex, ciphertextSize: encrypted.length };
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
  downloadParam: string,
  aesKeyHex: string,
  ciphertextSize: number,
  config: { botToken: string; baseurl?: string; latestContextToken?: string },
): Promise<void> {
  const base = config.baseurl || ILINK_MSG_BASE;
  const clientId = `favie-${crypto.randomBytes(8).toString("hex")}`;
  // aes_key in sendmessage is base64 of the hex string (not raw bytes)
  // per SDK: Buffer.from(uploaded.aeskey).toString("base64") where aeskey is hex
  const aesKeyBase64 = Buffer.from(aesKeyHex).toString("base64");
  const body = {
    msg: {
      from_user_id: "",
      to_user_id: chatId,
      client_id: clientId,
      message_type: 2,
      message_state: 2,
      item_list: [{
        type: 2,
        image_item: {
          media: {
            encrypt_query_param: downloadParam,
            aes_key: aesKeyBase64,
            encrypt_type: 1,
          },
          mid_size: ciphertextSize,
        },
      }],
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

  // For each image: upload to iLink CDN and send as native image message; fallback to URL text
  for (const url of imageUrls) {
    console.log("[wechat-send] processing image:", url.slice(0, 80));
    const uploaded = await uploadImageToILink(url, config.botToken, chatId, config.baseurl);
    if (uploaded) {
      console.log("[wechat-send] sending native image message");
      await sendRawImage(chatId, uploaded.downloadParam, uploaded.aesKeyHex, uploaded.ciphertextSize, config).catch(async (e: Error) => {
        console.warn("[wechat-send] image send failed, fallback to URL:", e.message);
        await sendRawText(chatId, url, config);
      });
    } else {
      console.log("[wechat-send] upload failed, sending URL as text fallback");
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
