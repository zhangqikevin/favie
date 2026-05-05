import { storage } from "./storage";

export const DEFAULT_OPENCLAW_BASE_URL = "https://openclaw.kevinzhang.fun";

export interface EffectiveOpenclawConfig {
  baseUrl: string;
  apiKey: string;
}

/**
 * Pure resolver: combine pre-fetched system config + per-user settings into the
 * effective Openclaw config. Useful when callers already have the cfg/userSettings
 * in hand (e.g. from a Promise.all batch) so we don't double-query the DB.
 */
export function resolveOpenclawConfig(
  cfg: Record<string, string>,
  userSettings: { baseUrl?: string | null; apiKey?: string | null } | null | undefined,
): EffectiveOpenclawConfig {
  const globalBaseUrl = cfg["openclaw_base_url"] || DEFAULT_OPENCLAW_BASE_URL;
  const globalApiKey  = cfg["openclaw_api_key"]  ?? "";
  return {
    baseUrl: (userSettings?.baseUrl?.trim?.() || globalBaseUrl),
    apiKey:  (userSettings?.apiKey?.trim?.()  || globalApiKey),
  };
}

export async function getEffectiveOpenclawConfig(
  userId: string | null | undefined,
  cfg?: Record<string, string>,
): Promise<EffectiveOpenclawConfig> {
  const config = cfg ?? await storage.getSystemConfig();
  if (!userId) return resolveOpenclawConfig(config, null);
  const userSettings = await storage.getUserOpenclawSettings(userId);
  return resolveOpenclawConfig(config, userSettings);
}

export function maskApiKey(key: string | null | undefined): string {
  const k = (key ?? "").trim();
  if (!k) return "";
  return "••••••" + k.slice(-6);
}
