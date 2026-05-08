// In-memory structured capture of cron-webhook + deliver requests.
// Exposed via GET /api/admin/cron-debug for remote diagnosis.
//
// Records EVERY decision point in the handler so we can tell, at a glance,
// where a particular webhook silently dropped (auth fail, empty text, no
// bindings, no chatId, channel send error, etc.).
//
// Auth headers and openclaw keys are redacted to "Bearer xxx...last6 (len=N)"
// so the buffer never holds full secrets.

import type { Request } from "express";

const MAX_CAPTURES = 200;

export type CapDecision =
  | "pending"
  | "unauthorized"
  | "deprecated-url"  // hit the old /:userId/:agentId path that no longer accepts deliveries
  | "empty-text"
  | "delivered"       // saved to chat_messages and (attempted) channel push
  | "saved-only"      // saved but zero active bindings
  | "error";

export interface BindingResult {
  channelType: string;
  bindingId: string;
  hasChatId: boolean;
  chatIdTail: string;          // last 8 chars of chatId (or "(none)")
  hasHandler: boolean;
  sendResult: "ok" | "skipped-no-chatId" | "skipped-no-handler" | "error";
  errorMessage?: string;
  ms?: number;
}

export interface CronWebhookCapture {
  endpoint: "cron-webhook" | "deliver";
  ts: string;
  userId: string;
  agentId: string;
  ip?: string;
  // ── auth ──
  hasAuthHeader: boolean;
  authHeaderRedacted: string;  // "Bearer xxx...last6 (len=N)" or "(missing)"
  expectedKeyTail: string;     // last 6 chars of expected key
  expectedKeyLength: number;
  authMatch: boolean | null;
  // ── body ──
  bodyKeys: string[];
  bodyPreview: string;         // JSON-stringified, truncated 1500 chars
  text: string;                // extracted summary || error
  textLength: number;
  // ── outcome ──
  decision: CapDecision;
  bindingsFound: number;
  bindingResults: BindingResult[];
  chatMessageSaved: boolean;
  totalMs?: number;
  errorMessage?: string;
}

const buffer: CronWebhookCapture[] = [];

function redactAuth(auth: string): string {
  if (!auth) return "(missing)";
  if (auth.length <= 13) return `(short, len=${auth.length})`;
  return `${auth.slice(0, 7)}...${auth.slice(-6)} (len=${auth.length})`;
}

export function startCapture(
  endpoint: "cron-webhook" | "deliver",
  req: Request,
  userId: string,
  agentId: string,
): CronWebhookCapture {
  const auth = (req.headers.authorization ?? "").toString();
  let bodyKeys: string[] = [];
  let bodyPreview = "";
  try {
    if (req.body && typeof req.body === "object") {
      bodyKeys = Object.keys(req.body);
    }
    bodyPreview = JSON.stringify(req.body ?? null).slice(0, 1500);
  } catch {
    bodyPreview = "(unstringifiable body)";
  }

  const cap: CronWebhookCapture = {
    endpoint,
    ts: new Date().toISOString(),
    userId,
    agentId,
    ip: req.ip,
    hasAuthHeader: auth.length > 0,
    authHeaderRedacted: redactAuth(auth),
    expectedKeyTail: "",
    expectedKeyLength: 0,
    authMatch: null,
    bodyKeys,
    bodyPreview,
    text: "",
    textLength: 0,
    decision: "pending",
    bindingsFound: 0,
    bindingResults: [],
    chatMessageSaved: false,
  };

  buffer.push(cap);
  if (buffer.length > MAX_CAPTURES) buffer.splice(0, buffer.length - MAX_CAPTURES);
  return cap;
}

export function setExpectedKey(cap: CronWebhookCapture, key: string): void {
  cap.expectedKeyLength = key.length;
  cap.expectedKeyTail = key.length >= 6 ? key.slice(-6) : `(short, len=${key.length})`;
}

export function getCaptures(last = 50): CronWebhookCapture[] {
  return buffer.slice(-last);
}

export function getCaptureSummary(): {
  total: number;
  byDecision: Record<string, number>;
  byEndpoint: Record<string, number>;
  recent: { ts: string; endpoint: string; userId: string; agentId: string; decision: CapDecision }[];
} {
  const byDecision: Record<string, number> = {};
  const byEndpoint: Record<string, number> = {};
  for (const c of buffer) {
    byDecision[c.decision] = (byDecision[c.decision] ?? 0) + 1;
    byEndpoint[c.endpoint] = (byEndpoint[c.endpoint] ?? 0) + 1;
  }
  const recent = buffer.slice(-10).map((c) => ({
    ts: c.ts,
    endpoint: c.endpoint,
    userId: c.userId.slice(0, 8),
    agentId: c.agentId,
    decision: c.decision,
  }));
  return { total: buffer.length, byDecision, byEndpoint, recent };
}
