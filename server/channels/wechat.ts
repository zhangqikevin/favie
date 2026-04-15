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

interface UploadParam {
  url: string;
  auth_key: string;
  x_cos_security_token: string;
  aes_key: string; // 32-char hex → 16 bytes
}

/**
 * Correct iLink image upload flow (AES-128-ECB + CDN):
 * 1. POST /ilink/bot/getuploadurl  → upload_param (url, auth_key, aes_key, ...)
 * 2. AES-128-ECB encrypt raw image → POST to CDN → x-encrypted-param response header
 * 3. sendmessage with type:2, image_item.cdn_media { url_param, aes_key, encrypt_type:1 }
 *
 * Returns { urlParam, aesKey } on success, null on failure.
 */
async function uploadImageToILink(
  imageUrl: string,
  botToken: string,
  baseurl?: string,
): Promise<{ urlParam: string; aesKey: string } | null> {
  try {
    // Step 1: get upload URL + AES key
    // Try the message API base first (baseurl or ILINK_MSG_BASE), fallback to login base
    const base = baseurl || ILINK_MSG_BASE;
    const reqBody = { upload_type: 1, base_info: { channel_version: "favie-1.0.0" } };
    console.log("[wechat-img] getuploadurl request:", base, JSON.stringify(reqBody));
    const urlRes = await fetch(`${base}/ilink/bot/getuploadurl`, {
      method: "POST",
      headers: authHeaders(botToken),
      body: JSON.stringify(reqBody),
    });
    if (!urlRes.ok) {
      console.warn("[wechat-img] getuploadurl failed:", urlRes.status);
      return null;
    }
    const urlRaw = await urlRes.text();
    console.log("[wechat-img] getuploadurl response:", urlRaw.slice(0, 500));
    let urlData = JSON.parse(urlRaw) as { ret?: number; upload_param?: UploadParam };

    // If first base failed, try the other base (login vs msg)
    if (urlData.ret !== 0 || !urlData.upload_param) {
      const altBase = base === ILINK_LOGIN_BASE ? ILINK_MSG_BASE : ILINK_LOGIN_BASE;
      console.log("[wechat-img] retrying getuploadurl on alt base:", altBase);
      const altRes = await fetch(`${altBase}/ilink/bot/getuploadurl`, {
        method: "POST",
        headers: authHeaders(botToken),
        body: JSON.stringify(reqBody),
      });
      if (altRes.ok) {
        const altRaw = await altRes.text();
        console.log("[wechat-img] alt getuploadurl response:", altRaw.slice(0, 500));
        urlData = JSON.parse(altRaw) as { ret?: number; upload_param?: UploadParam };
      }
    }

    if (urlData.ret !== 0 || !urlData.upload_param) {
      console.warn("[wechat-img] getuploadurl bad ret on both bases:", urlData.ret);
      return null;
    }
    const up = urlData.upload_param;

    // Step 2: download source image
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      console.warn("[wechat-img] download failed:", imgRes.status, imageUrl.slice(0, 80));
      return null;
    }
    const plain = Buffer.from(await imgRes.arrayBuffer());
    const md5 = crypto.createHash("md5").update(plain).digest("hex");

    // AES-128-ECB encrypt with PKCS7 padding
    const key = Buffer.from(up.aes_key, "hex"); // 32 hex chars = 16 bytes
    const cipher = crypto.createCipheriv("aes-128-ecb", key, null);
    cipher.setAutoPadding(true);
    const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);

    // Upload encrypted bytes to CDN
    const cdnRes = await fetch(up.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Authorization": up.auth_key,
        "x-cos-security-token": up.x_cos_security_token,
        "x-cos-meta-md5": md5,
      },
      body: encrypted,
    });
    if (!cdnRes.ok) {
      console.warn("[wechat-img] CDN upload failed:", cdnRes.status);
      return null;
    }
    const urlParam = cdnRes.headers.get("x-encrypted-param");
    if (!urlParam) {
      console.warn("[wechat-img] CDN upload: missing x-encrypted-param header");
      return null;
    }
    console.log("[wechat-img] upload success, urlParam:", urlParam.slice(0, 40));
    return { urlParam, aesKey: up.aes_key };
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
  urlParam: string,
  aesKey: string,
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
      item_list: [{
        type: 2,
        image_item: {
          cdn_media: {
            url_param: urlParam,
            aes_key: aesKey,
            encrypt_type: 1,
          },
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
    const uploaded = await uploadImageToILink(url, config.botToken, config.baseurl);
    if (uploaded) {
      console.log("[wechat-send] sending native image message");
      await sendRawImage(chatId, uploaded.urlParam, uploaded.aesKey, config).catch(async (e: Error) => {
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
