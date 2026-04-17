import type { Request } from "express";
import * as telegram from "./telegram";
import * as wechat from "./wechat";
import * as whatsapp from "./whatsapp";

export interface ChannelHandler {
  parseIncoming(req: Request): { chatId: string; text: string } | null;
  sendMessage(chatId: string, text: string, config: Record<string, unknown>): Promise<void>;
  registerWebhook(webhookUrl: string, config: Record<string, unknown>): Promise<{ botUsername: string }>;
}

const handlers: Record<string, ChannelHandler> = {
  telegram: telegram as unknown as ChannelHandler,
  wechat: wechat as unknown as ChannelHandler,
  whatsapp: whatsapp as unknown as ChannelHandler,
};

/** IM channel types (mutually exclusive — user can only bind one) */
export const IM_CHANNEL_TYPES = ["telegram", "wechat", "whatsapp"] as const;

export function getChannelHandler(channelType: string): ChannelHandler | undefined {
  return handlers[channelType];
}
