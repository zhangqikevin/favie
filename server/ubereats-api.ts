// ─── UberEats Eats Marketplace API ────────────────────────────────────────────
// Auth base: https://auth.uber.com  (NOT login.uber.com)
// API base:  https://api.uber.com/v1/eats
// OAuth flow: authorization_code with scope eats.pos_provisioning
//             (eats.store uses client_credentials only)

export interface UberEatsStore {
  store_id: string;
  name: string;
  location?: {
    street_address?: string;
    city?: string;
    country?: string;
  };
  contact_emails?: string[];
  status?: {
    is_accepting_orders?: boolean;
  };
  [key: string]: any;
}

export interface UberEatsTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
}

const AUTH_BASE = "https://auth.uber.com";
const API_BASE  = "https://api.uber.com";

export function getRedirectUri(): string {
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
  if (domain) return `https://${domain}/api/ubereats/oauth/callback`;
  return `http://localhost:5000/api/ubereats/oauth/callback`;
}

export function buildAuthUrl(userId: string): string {
  const clientId = process.env.UBEREATS_CLIENT_ID!;
  const url = new URL(`${AUTH_BASE}/oauth/v2/authorize`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  // eats.pos_provisioning = authorization_code flow for store discovery
  // also covers GET /v1/eats/stores
  url.searchParams.set("scope", "eats.pos_provisioning");
  url.searchParams.set("redirect_uri", getRedirectUri());
  url.searchParams.set("state", userId);
  return url.toString();
}

export async function exchangeCodeForTokens(code: string): Promise<UberEatsTokens> {
  const body = new URLSearchParams({
    client_id:     process.env.UBEREATS_CLIENT_ID!,
    client_secret: process.env.UBEREATS_CLIENT_SECRET!,
    grant_type:    "authorization_code",
    code,
    redirect_uri:  getRedirectUri(),
  });

  const res = await fetch(`${AUTH_BASE}/oauth/v2/token`, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${err}`);
  }
  return res.json() as any;
}

export async function refreshAccessToken(refreshToken: string): Promise<UberEatsTokens> {
  const body = new URLSearchParams({
    client_id:     process.env.UBEREATS_CLIENT_ID!,
    client_secret: process.env.UBEREATS_CLIENT_SECRET!,
    grant_type:    "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await fetch(`${AUTH_BASE}/oauth/v2/token`, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${err}`);
  }
  return res.json() as any;
}

async function uberEatsFetch(path: string, accessToken: string): Promise<any> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`UberEats API ${path} failed (${res.status}): ${err}`);
  }
  return res.json();
}

export async function fetchStores(accessToken: string): Promise<UberEatsStore[]> {
  const data = await uberEatsFetch("/v1/eats/stores", accessToken);
  return (data.stores ?? data.data ?? []) as UberEatsStore[];
}

export async function fetchStoreDetails(accessToken: string, storeId: string): Promise<UberEatsStore> {
  return uberEatsFetch(`/v1/eats/stores/${storeId}`, accessToken) as any;
}

export function buildFavieSystemPrompt(store: UberEatsStore | null): string {
  const name    = store?.name ?? "your restaurant";
  const address = [store?.location?.street_address, store?.location?.city]
    .filter(Boolean).join(", ") || "unknown location";
  const accepting = store?.status?.is_accepting_orders;
  const statusLine = accepting == null
    ? ""
    : accepting
      ? "Currently accepting orders."
      : "Currently NOT accepting orders (check your settings).";

  return `You are Favie, a world-class AI restaurant growth advisor embedded directly inside the restaurant's UberEats account. You are talking with the restaurant owner or manager.

Restaurant context (real-time from UberEats):
- Name: ${name}
- Location: ${address}
${statusLine ? `- Status: ${statusLine}` : ""}

Your personality:
- Concise, direct, and actionable — no fluff, no filler.
- You speak like a trusted senior consultant who knows restaurant ops deeply.
- You focus on growth levers: order volume, ratings, menu profitability, marketing, and customer retention.
- When asked to take an action, give your quick take, then ask "Want me to go ahead?" — only act after confirmation.
- Keep responses short and clear. Use bullet points when listing more than 2 items.
- Always reply in the same language the user writes in.`;
}
