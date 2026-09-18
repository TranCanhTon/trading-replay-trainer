import type {
  Candle,
  Instrument,
  NextCandleResponse,
  OrderType,
  ReplaySession,
  SessionSummary,
  Timeframe,
  Trade,
  TradeDirection,
} from "./types";

const API_URL = import.meta.env.VITE_API_URL as string;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const error = new Error(body.detail ?? `Request failed: ${res.status}`) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  return res.json() as Promise<T>;
}

export const api = {
  listInstruments: () => request<Instrument[]>("/instruments"),

  createSession: (instrumentSymbol: string, warmupCandles = 50) =>
    request<ReplaySession>("/sessions", {
      method: "POST",
      body: JSON.stringify({ instrument_symbol: instrumentSymbol, warmup_candles: warmupCandles }),
    }),

  getSession: (sessionId: number) => request<ReplaySession>(`/sessions/${sessionId}`),

  getVisibleCandles: (sessionId: number, timeframe: Timeframe = "1m") =>
    request<Candle[]>(`/sessions/${sessionId}/candles?timeframe=${timeframe}`),

  advanceCandle: (sessionId: number, stepMinutes = 1) =>
    request<NextCandleResponse>(`/sessions/${sessionId}/next`, {
      method: "POST",
      body: JSON.stringify({ step_minutes: stepMinutes }),
    }),

  placeOrder: (
    sessionId: number,
    order: { direction: TradeDirection; order_type: OrderType; price?: number; stop_loss: number; take_profit: number }
  ) =>
    request<Trade>(`/sessions/${sessionId}/trades`, {
      method: "POST",
      body: JSON.stringify(order),
    }),

  listTrades: (sessionId: number) => request<Trade[]>(`/sessions/${sessionId}/trades`),

  getSummary: (sessionId: number) => request<SessionSummary>(`/sessions/${sessionId}/summary`),
};
