export type SessionStatus = "active" | "finished";
export type TradeDirection = "long" | "short";
export type OrderType = "market" | "limit" | "stop";
export type TradeStatus = "pending" | "open" | "closed" | "cancelled";
export type CloseReason = "take_profit" | "stop_loss" | "manual" | "session_end";
export type Timeframe = "1m" | "3m" | "5m" | "15m" | "30m" | "1h";
export type StepSize = "1m" | "5m" | "1h";

export const TIMEFRAMES: Timeframe[] = ["1m", "3m", "5m", "15m", "30m", "1h"];
export const STEP_SIZES: StepSize[] = ["1m", "5m", "1h"];

export const STEP_MINUTES: Record<StepSize, number> = {
  "1m": 1,
  "5m": 5,
  "1h": 60,
};

export interface Instrument {
  id: number;
  symbol: string;
  name: string;
  candle_count: number;
}

export interface Candle {
  sequence: number;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ReplaySession {
  id: number;
  instrument_id: number;
  current_index: number;
  status: SessionStatus;
  total_candles: number;
}

export interface Trade {
  id: number;
  direction: TradeDirection;
  order_type: OrderType;
  trigger_price: number | null;
  stop_loss: number;
  take_profit: number;
  status: TradeStatus;
  placed_sequence: number;
  entry_price: number | null;
  entry_sequence: number | null;
  exit_price: number | null;
  exit_sequence: number | null;
  close_reason: CloseReason | null;
  pnl: number | null;
  created_at: string;
  filled_at: string | null;
  closed_at: string | null;
}

export interface NextCandleResponse {
  session: ReplaySession;
  candles: Candle[];
  filled_orders: Trade[];
  closed_trades: Trade[];
  cancelled_orders: Trade[];
}

export interface SessionSummary {
  session_id: number;
  status: SessionStatus;
  total_trades: number;
  open_trades: number;
  closed_trades: number;
  pending_orders: number;
  cancelled_orders: number;
  wins: number;
  losses: number;
  win_rate: number;
  total_pnl: number;
}
