import { AsyncLocalStorage } from "node:async_hooks";

export interface BotContext {
  isPremium: boolean;
  userId?: string;
  guildId?: string;
  showAds: boolean;
}

const botContextStorage = new AsyncLocalStorage<BotContext>();

export function runWithBotContext<T>(context: BotContext, fn: () => Promise<T> | T): Promise<T> | T {
  return botContextStorage.run(context, fn);
}

export function getCurrentBotContext(): BotContext | undefined {
  return botContextStorage.getStore();
}

export function isCurrentContextPremium(): boolean {
  const ctx = botContextStorage.getStore();
  return ctx?.isPremium ?? false;
}

export function shouldShowAds(): boolean {
  const ctx = botContextStorage.getStore();
  if (!ctx) return true; // Default to showing ads if no context
  return ctx.showAds ?? !ctx.isPremium;
}
