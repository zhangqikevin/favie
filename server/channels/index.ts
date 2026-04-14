import type { Request } from "express";
import * as telegram from "./telegram";
import * as wechat from "./wechat";

export interface ChannelHandler {
  parseIncoming(req: Request): { chatId: string; text: string } | null;
  sendMessage(chatId: string, text: string, config: Record<string, unknown>): Promise<void>;
  registerWebhook(webhookUrl: string, config: Record<string, unknown>): Promise<{ botUsername: string }>;
}

const handlers: Record<string, ChannelHandler> = {
  telegram: telegram as unknown as ChannelHandler,
  wechat: wechat as unknown as ChannelHandler,
};

export function getChannelHandler(channelType: string): ChannelHandler | undefined {
  return handlers[channelType];
}
