import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  fetchLatestBaileysVersion,
} from "baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import path from "node:path";
import fs from "node:fs";
import { storage } from "./storage";
import { callOpenclaw, syncOpencrawAgent } from "./openclaw";
import { getAgentSystemPrompt, type AgentId } from "./agent-context";
import { withDeliveryInstructions } from "./delivery-instructions";

const AUTH_DIR = path.resolve(process.cwd(), ".whatsapp-auth");

// ── Login sessions (temporary, during QR scanning) ─────────────────────────

interface LoginSession {
  qr: string | null;
  status: "pending" | "confirmed" | "error";
  socket: ReturnType<typeof makeWASocket> | null;
  authDir: string;
  error?: string;
}

const loginSessions = new Map<string, LoginSession>();

/**
 * Start a WhatsApp login session: create a Baileys socket, wait for QR.
 * Returns a sessionId the frontend can poll.
 */
export async function startLogin(): Promise<{ sessionId: string; qr: string }> {
  const sessionId = crypto.randomUUID();
  const authDir = path.join(AUTH_DIR, `login-${sessionId}`);
  fs.mkdirSync(authDir, { recursive: true });

  const session: LoginSession = { qr: null, status: "pending", socket: null, authDir };
  loginSessions.set(sessionId, session);

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }) as any,
    browser: Browsers.ubuntu("Favie"),
    printQRInTerminal: false,
  });
  session.socket = sock;

  sock.ev.on("creds.update", saveCreds);

  // Wait for QR code
  return new Promise<{ sessionId: string; qr: string }>((resolve, rejected) => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        session.status = "error";
        session.error = "QR timeout";
        rejected(new Error("QR code timeout"));
      }
    }, 60_000);

    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        session.qr = qr;
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve({ sessionId, qr });
        }
      }
      if (connection === "open") {
        session.status = "confirmed";
        console.log(`[whatsapp-login] session=${sessionId} connected`);
      }
      if (connection === "close") {
        const code = (lastDisconnect?.error as Boom)?.output?.statusCode;
        if (code === DisconnectReason.loggedOut) {
          session.status = "error";
          session.error = "Logged out";
        }
        // restartRequired is normal after QR scan — Baileys reconnects
      }
    });
  });
}

/**
 * Check login session status. Returns current QR (may have refreshed) and status.
 */
export function getLoginStatus(sessionId: string): {
  status: "pending" | "confirmed" | "error";
  qr: string | null;
  error?: string;
} | null {
  const session = loginSessions.get(sessionId);
  if (!session) return null;
  return { status: session.status, qr: session.qr, error: session.error };
}

/**
 * Finalize login: close the temp socket, move auth dir to permanent location,
 * return so the caller can save the binding and start the persistent connection.
 */
export async function finalizeLogin(sessionId: string, bindingId: string): Promise<void> {
  const session = loginSessions.get(sessionId);
  if (!session) throw new Error("Login session not found");

  // Close the temporary login socket
  if (session.socket) {
    session.socket.ev.removeAllListeners("connection.update");
    session.socket.ev.removeAllListeners("messages.upsert");
    session.socket.end(undefined);
  }

  // Move auth dir from temp to permanent
  const permanentDir = path.join(AUTH_DIR, bindingId);
  if (fs.existsSync(permanentDir)) fs.rmSync(permanentDir, { recursive: true });
  fs.renameSync(session.authDir, permanentDir);

  loginSessions.delete(sessionId);
}

/**
 * Clean up a login session without saving.
 */
export function cancelLogin(sessionId: string): void {
  const session = loginSessions.get(sessionId);
  if (!session) return;
  if (session.socket) session.socket.end(undefined);
  if (fs.existsSync(session.authDir)) fs.rmSync(session.authDir, { recursive: true });
  loginSessions.delete(sessionId);
}

// ── Persistent connections (active bindings) ───────────────────────────────

interface ActiveConnection {
  socket: ReturnType<typeof makeWASocket>;
  bindingId: string;
}

const activeConnections = new Map<string, ActiveConnection>();

/**
 * Start a persistent WhatsApp connection for an active binding.
 */
export async function startConnection(bindingId: string): Promise<void> {
  if (activeConnections.has(bindingId)) return;

  const authDir = path.join(AUTH_DIR, bindingId);
  if (!fs.existsSync(authDir)) {
    console.warn(`[whatsapp] no auth dir for binding=${bindingId}, skipping`);
    return;
  }

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }) as any,
    browser: Browsers.ubuntu("Favie"),
    printQRInTerminal: false,
  });

  activeConnections.set(bindingId, { socket: sock, bindingId });
  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      const code = (lastDisconnect?.error as Boom)?.output?.statusCode;
      activeConnections.delete(bindingId);

      if (code === DisconnectReason.loggedOut) {
        console.warn(`[whatsapp] binding=${bindingId} logged out — deactivating`);
        try { await storage.setChannelBindingActive(bindingId, false); } catch {}
        // Clean up auth
        if (fs.existsSync(authDir)) fs.rmSync(authDir, { recursive: true });
        return;
      }
      // Reconnect for transient errors
      console.log(`[whatsapp] binding=${bindingId} disconnected (code=${code}), reconnecting...`);
      setTimeout(() => startConnection(bindingId), 3000);
    }
    if (connection === "open") {
      console.log(`[whatsapp] binding=${bindingId} connected`);
    }
  });

  sock.ev.on("messages.upsert", async ({ messages: msgs }) => {
    for (const msg of msgs) {
      if (msg.key.fromMe) continue;
      const text = msg.message?.conversation
        || msg.message?.extendedTextMessage?.text;
      if (!text?.trim()) continue;

      const chatId = msg.key.remoteJid;
      if (!chatId) continue;

      console.log(`[whatsapp] binding=${bindingId} msg from=${chatId}: ${text.slice(0, 80)}`);
      processMessage(bindingId, chatId, text).catch((e: Error) =>
        console.error(`[whatsapp] processMessage error:`, e.message),
      );
    }
  });

  console.log(`[whatsapp] started connection for binding=${bindingId}`);
}

/**
 * Stop a persistent connection.
 */
export function stopConnection(bindingId: string): void {
  const conn = activeConnections.get(bindingId);
  if (conn) {
    conn.socket.end(undefined);
    activeConnections.delete(bindingId);
    console.log(`[whatsapp] stopped binding=${bindingId}`);
  }
}

/**
 * Send a text message through an active connection.
 */
export async function sendMessageViaSocket(
  bindingId: string,
  chatId: string,
  text: string,
): Promise<void> {
  const conn = activeConnections.get(bindingId);
  if (!conn) throw new Error(`No active WhatsApp connection for binding=${bindingId}`);
  await conn.socket.sendMessage(chatId, { text });
}

/**
 * Restore all active WhatsApp connections on server start.
 */
export async function restoreAllConnections(): Promise<void> {
  const bindings = await storage.getAllActiveChannelBindingsByType("whatsapp");
  for (const b of bindings) {
    startConnection(b.id).catch((e: Error) =>
      console.error(`[whatsapp] restore binding=${b.id} failed:`, e.message),
    );
  }
  console.log(`[whatsapp] restored ${bindings.length} connection(s)`);
}

/**
 * Clean up auth directory when a binding is deleted.
 */
export function cleanupAuth(bindingId: string): void {
  const authDir = path.join(AUTH_DIR, bindingId);
  if (fs.existsSync(authDir)) fs.rmSync(authDir, { recursive: true });
}

// ── Message processing ─────────────────────────────────────────────────────

async function processMessage(
  bindingId: string,
  chatId: string,
  text: string,
): Promise<void> {
  const binding = await storage.getChannelBindingById(bindingId);
  if (!binding || !binding.active) return;

  // Persist chatId for proactive delivery
  await storage.updateChannelBindingConfig(bindingId, { chatId });

  const cfg = await storage.getSystemConfig();
  const { agentId, userId, restaurantId } = binding;
  if (cfg[`agent_${agentId}_enabled`] === "false") return;

  const restaurants = await storage.getRestaurants(userId);
  const restaurant = restaurants.find((r) => r.id === restaurantId) ?? restaurants[0];
  if (!restaurant) {
    console.warn(`[whatsapp] no restaurant for binding=${bindingId}`);
    return;
  }

  const overrides = {
    role: cfg[`agent_${agentId}_role`],
    rules: cfg[`agent_${agentId}_rules`],
  };
  const systemPrompt = getAgentSystemPrompt(agentId as AgentId, restaurant, overrides, userId);

  const baseUrl = cfg["openclaw_base_url"] || "https://openclaw.kevinzhang.fun";
  const apiKey = cfg["openclaw_api_key"] ?? "";
  if (!apiKey) {
    console.warn(`[whatsapp] openclaw not configured, skipping reply`);
    return;
  }

  const { messages: history } = await storage.getChatHistory(userId, agentId);
  const ocMessages = [
    ...history.slice(-20).map((h) => ({
      role: h.role === "ai" ? "assistant" : "user",
      content: h.text,
    })),
    { role: "user", content: text },
  ];

  const ocAgentId = await syncOpencrawAgent(
    userId, restaurantId, agentId, restaurant.name,
    restaurant.cuisine ?? "", systemPrompt, cfg,
  );

  const appBaseUrl = cfg["app_base_url"] || "https://favieai.replit.app";
  const enrichedPrompt = withDeliveryInstructions(systemPrompt, userId, agentId, appBaseUrl, apiKey);

  const replyText = await callOpenclaw(baseUrl, apiKey, ocAgentId, userId, enrichedPrompt, ocMessages, 2048);

  const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  await storage.saveChatMessages([
    { userId, agentId, role: "user", text, ts },
    { userId, agentId, role: "ai", text: replyText, ts },
  ]);

  await sendMessageViaSocket(bindingId, chatId, replyText);
}

// ── Singleton accessor ─────────────────────────────────────────────────────

const manager = {
  startLogin,
  getLoginStatus,
  finalizeLogin,
  cancelLogin,
  startConnection,
  stopConnection,
  sendMessage: sendMessageViaSocket,
  restoreAllConnections,
  cleanupAuth,
};

export type WhatsAppManager = typeof manager;

export function getWhatsAppManager(): WhatsAppManager {
  return manager;
}
