import type { Trade } from "./types";

export function unrealizedPnl(trade: Trade, currentPrice: number): number {
  const entry = trade.entry_price ?? 0;
  return trade.direction === "long" ? currentPrice - entry : entry - currentPrice;
}

export function realizedPnl(trades: Trade[]): number {
  return trades.filter((t) => t.status === "closed").reduce((sum, t) => sum + (t.pnl ?? 0), 0);
}

export function totalUnrealizedPnl(trades: Trade[], currentPrice: number | null): number {
  if (currentPrice === null) return 0;
  return trades.filter((t) => t.status === "open").reduce((sum, t) => sum + unrealizedPnl(t, currentPrice), 0);
}
