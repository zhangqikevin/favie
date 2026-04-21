import { storage } from "./storage";
import * as wechat from "./channels/wechat";
import { callOpenclaw, syncOpencrawAgent } from "./openclaw";
import { getAgentSystemPrompt, type AgentId } from "./agent-context";
import { withDeliveryInstructions } from "./delivery-instructions";


// Map<bindingId, AbortController> — one long-poll loop per active WeChat binding
const activeLoops = new Map<string, AbortController>();

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function pollLoop(bindingId: string, signal: AbortSignal): Promise<void> {
  while (!signal.aborted) {
    const binding = await storage.getChannelBindingById(bindingId);
    if (!binding || !binding.active) break;

    const config = binding.channelConfig as Record<string, string>;
    if (!config.botToken) { await sleep(5000); continue; }

    try {
      // Long-poll: holds connection up to 30s, returns immediately when messages arrive
      const { messages, nextCursor } = await wechat.getUpdates(
        config.botToken,
        config.baseurl,
        config.cursor,
        30,
        signal,
      );

      if (signal.aborted) break;

      console.log(`[wechat-poll] binding=${bindingId} got ${messages.length} message(s), nextCursor=${nextCursor}`);

      if (messages.length > 0) {
        await storage.updateChannelBindingConfig(bindingId, { cursor: nextCursor });
        for (const msg of messages) {
          if (signal.aborted) break;
          console.log("[wechat-poll] raw msg:", JSON.stringify(msg));
          await processMessage(binding, msg, config).catch((e: Error) =>
            console.log("[wechat] getUpdates raw response:", JSON.stringify({ error: e.message }))
          );
        }
      }
      // If no messages and response returned instantly, wait before next poll
      if (messages.length === 0) await sleep(3000);
    } catch (e: any) {
      if (signal.aborted) break;
      // ilink session expired (errcode -14) or token invalid — bind is dead, mark inactive & stop polling
      if (e?.ilinkErrcode) {
        console.warn(`[wechat-poll] binding=${bindingId} ilink errcode=${e.ilinkErrcode} (${e.message}) — deactivating binding, user must re-bind via QR`);
        try { await storage.setChannelBindingActive(bindingId, false); } catch {}
        break;
      }
      console.error(`[wechat-poll] binding=${bindingId} getUpdates error:`, e.message);
      await sleep(5000);
    }
  }
}

async function processMessage(
  binding: { id: string; agentId: string; userId: string; restaurantId: string },
  msg: wechat.ILinkMessage,
  config: Record<string, string>,
): Promise<void> {
  const text = msg.item_list.find((i) => i.type === 1)?.text_item?.text;
  if (!text?.trim()) return;

  const chatId = msg.from_user_id;
  // Persist chatId and latest context_token for reply threading
  await storage.updateChannelBindingConfig(binding.id, {
    chatId,
    latestContextToken: msg.context_token,
  });

  const cfg = await storage.getSystemConfig();
  const { agentId, userId, restaurantId } = binding;
  if (cfg[`agent_${agentId}_enabled`] === "false") return;

  const restaurants = await storage.getRestaurants(userId);
  const restaurant = restaurants.find((r) => r.id === restaurantId) ?? restaurants[0];
  if (!restaurant) {
    console.warn(`[wechat-poll] no restaurant found for binding=${binding.id} userId=${userId}`);
    return;
  }

  const overrides = {
    role: cfg[`agent_${agentId}_role`],
    rules: cfg[`agent_${agentId}_rules`],
  };
  const systemPrompt = getAgentSystemPrompt(agentId as AgentId, restaurant, overrides, userId);

  const baseUrl = cfg["openclaw_base_url"] || "https://openclaw.kevinzhang.fun";
  const apiKey  = cfg["openclaw_api_key"]  ?? "";
  if (!apiKey) {
    console.warn(`[wechat-poll] openclaw not configured (missing openclaw_api_key in system_config), skipping reply`);
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

  const appBaseUrl = cfg["app_base_url"] || "https://favieai.replit.app";
  const enrichedPrompt = withDeliveryInstructions(systemPrompt, userId, agentId, appBaseUrl, apiKey);

  const ocAgentId = await syncOpencrawAgent(userId, restaurantId, agentId, restaurant.name, restaurant.cuisine ?? "", systemPrompt, cfg);
  const replyText = await callOpenclaw(baseUrl, apiKey, ocAgentId, userId, enrichedPrompt, ocMessages, 2048);

  const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  await storage.saveChatMessages([
    { userId, agentId, role: "user", text, ts },
    { userId, agentId, role: "ai", text: replyText, ts },
  ]);

  await wechat.sendMessage(chatId, replyText, {
    botToken: config.botToken,
    baseurl: config.baseurl,
    latestContextToken: msg.context_token,
  });
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Start long-polling loop for a binding (no-op if already running) */
export function startPolling(bindingId: string): void {
  if (activeLoops.has(bindingId)) return;
  const ac = new AbortController();
  activeLoops.set(bindingId, ac);
  pollLoop(bindingId, ac.signal).finally(() => activeLoops.delete(bindingId));
  console.log(`[wechat-poll] started binding=${bindingId}`);
}

/** Stop the long-polling loop for a binding */
export function stopPolling(bindingId: string): void {
  const ac = activeLoops.get(bindingId);
  if (ac) {
    ac.abort();
    activeLoops.delete(bindingId);
    console.log(`[wechat-poll] stopped binding=${bindingId}`);
  }
}

/** Restore all active WeChat pollers on server start */
export async function restoreAllPollers(): Promise<void> {
  const bindings = await storage.getAllActiveChannelBindingsByType("wechat");
  for (const b of bindings) startPolling(b.id);
  console.log(`[wechat-poll] restored ${bindings.length} poller(s)`);
}
