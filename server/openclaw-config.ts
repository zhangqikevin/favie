import { storage } from "./storage";

export const DEFAULT_OPENCLAW_BASE_URL = "https://openclaw.kevinzhang.fun";

export interface EffectiveOpenclawConfig {
  baseUrl: string;
  apiKey: string;
}

export async function getEffectiveOpenclawConfig(
  userId: string | null | undefined,
): Promise<EffectiveOpenclawConfig> {
  const cfg = await storage.getSystemConfig();
  const globalBaseUrl = cfg["openclaw_base_url"] || DEFAULT_OPENCLAW_BASE_URL;
  const globalApiKey  = cfg["openclaw_api_key"]  ?? "";

  if (!userId) {
    return { baseUrl: globalBaseUrl, apiKey: globalApiKey };
  }

  const userSettings = await storage.getUserOpenclawSettings(userId);
  return {
    baseUrl: (userSettings?.baseUrl?.trim() || globalBaseUrl),
    apiKey:  (userSettings?.apiKey?.trim()  || globalApiKey),
  };
}

export function maskApiKey(key: string | null | undefined): string {
  const k = (key ?? "").trim();
  if (!k) return "";
  return "••••••" + k.slice(-6);
}
