import { useEffect, useRef, useState } from "react";
import "./App.css";
import { api } from "./api";
import { Chart } from "./components/Chart";
import { SessionSummary } from "./components/SessionSummary";
import { StatsBar } from "./components/StatsBar";
import { StatsBar } from "./components/StatsBar";
import { TradeForm } from "./components/TradeForm";
import { TradesPanel } from "./components/TradesPanel";
import { Toasts, type ToastMessage } from "./components/Toasts";
import { realizedPnl, totalUnrealizedPnl } from "./pnl";
import { realizedPnl, totalUnrealizedPnl } from "./pnl";
import {
  STEP_MINUTES,
  STEP_SIZES,
  TIMEFRAMES,
  type Candle,
  type Instrument,
  type OrderType,
  type ReplaySession,
  type SessionSummary as SessionSummaryType,
  type StepSize,
  type Timeframe,
  type Trade,
  type TradeDirection,
} from "./types";

const STARTING_BALANCE = 50000;

const STARTING_BALANCE = 50000;

let toastCounter = 0;

function App() {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>("");
  const [session, setSession] = useState<ReplaySession | null>(null);
  const [chartCandles, setChartCandles] = useState<Candle[]>([]);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [lastCandleTimestamp, setLastCandleTimestamp] = useState<string | null>(
    null,
  );
  const [lastCandleTimestamp, setLastCandleTimestamp] = useState<string | null>(
    null,
  );
  const [trades, setTrades] = useState<Trade[]>([]);
  const [summary, setSummary] = useState<SessionSummaryType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeframe, setTimeframe] = useState<Timeframe>("1m");
  const [stepSize, setStepSize] = useState<StepSize>("1m");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [fitTrigger, setFitTrigger] = useState(0);

  const sessionRef = useRef(session);
  sessionRef.current = session;

  const addToast = (text: string, tone: ToastMessage["tone"] = "info") => {
    const id = ++toastCounter;
    setToasts((prev) => [...prev, { id, text, tone }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      6000,
    );
  };

  useEffect(() => {
    api
      .listInstruments()
      .then((list) => {
        setInstruments(list);
        if (list.length > 0) setSelectedSymbol(list[0].symbol);
      })
      .catch((err) => setError(err.message));
  }, []);

  const resetToStart = (message?: string) => {
    setSession(null);
    setChartCandles([]);
    setLastPrice(null);
    setLastCandleTimestamp(null);
    setLastCandleTimestamp(null);
    setTrades([]);
    setSummary(null);
    if (message) setError(message);
  };

  const refreshChartCandles = async (sessionId: number, tf: Timeframe) => {
    const candles = await api.getVisibleCandles(sessionId, tf);
    setChartCandles(candles);
  };

  const startSession = async () => {
    if (!selectedSymbol) return;
    setError(null);
    setLoading(true);
    try {
      const newSession = await api.createSession(selectedSymbol);
      setSession(newSession);
      setSummary(null);
      const [baseCandles, sessionTrades] = await Promise.all([
        api.getVisibleCandles(newSession.id, "1m"),
        api.listTrades(newSession.id),
      ]);
      if (baseCandles.length > 0) {
        setLastPrice(baseCandles[baseCandles.length - 1].close);
        setLastCandleTimestamp(baseCandles[baseCandles.length - 1].timestamp);
      }
      if (baseCandles.length > 0) {
        setLastPrice(baseCandles[baseCandles.length - 1].close);
        setLastCandleTimestamp(baseCandles[baseCandles.length - 1].timestamp);
      }
      setTrades(sessionTrades);
      await refreshChartCandles(newSession.id, timeframe);
      setFitTrigger((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start session");
    } finally {
      setLoading(false);
    }
  };

  const handleTimeframeChange = async (tf: Timeframe) => {
    setTimeframe(tf);
    if (session) {
      await refreshChartCandles(session.id, tf);
      setFitTrigger((n) => n + 1);
    }
  };

  const handleNext = async () => {
    const current = sessionRef.current;
    if (!current || current.status === "finished") return;
    setError(null);
    try {
      const res = await api.advanceCandle(current.id, STEP_MINUTES[stepSize]);
      setSession(res.session);
      if (res.candles.length > 0) {
        setLastPrice(res.candles[res.candles.length - 1].close);
        setLastCandleTimestamp(res.candles[res.candles.length - 1].timestamp);
        setLastCandleTimestamp(res.candles[res.candles.length - 1].timestamp);
      }

      if (
        res.filled_orders.length > 0 ||
        res.closed_trades.length > 0 ||
        res.cancelled_orders.length > 0
      ) {
        const refreshed = await api.listTrades(current.id);
        setTrades(refreshed);
      }

      for (const order of res.filled_orders) {
        addToast(
          `${order.direction === "long" ? "Long" : "Short"} position entered at ${order.entry_price?.toFixed(2)} (${order.order_type}). SL at ${order.stop_loss.toFixed(2)}; TP at ${order.take_profit.toFixed(2)}.`,
          "success",
        );
      }
      for (const trade of res.closed_trades) {
        const won = (trade.pnl ?? 0) >= 0;
        addToast(
          `${trade.direction === "long" ? "Long" : "Short"} position closed at ${trade.exit_price?.toFixed(2)} (${trade.close_reason}). PnL ${won ? "+" : ""}${trade.pnl?.toFixed(2)}.`,
          won ? "success" : "danger",
        );
      }
      if (res.cancelled_orders.length > 0) {
        addToast(
          `${res.cancelled_orders.length} pending order(s) cancelled — session ended.`,
          "info",
        );
      }

      // Note: no fitTrigger bump here on purpose -- stepping should never
      // reset the viewer's pan/zoom, only setData with the newly revealed bars.
      await refreshChartCandles(current.id, timeframe);

      if (res.session.status === "finished") {
        const finalSummary = await api.getSummary(current.id);
        setSummary(finalSummary);
      }
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 404) {
        resetToStart("That session no longer exists. Start a new one below.");
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to advance candle");
    }
  };

  const handleNextRef = useRef(handleNext);
  handleNextRef.current = handleNext;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.code === "Space" || e.key === " ")) {
        e.preventDefault();
        handleNextRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handlePlaceOrder = async (order: {
    direction: TradeDirection;
    order_type: OrderType;
    price?: number;
    stop_loss: number;
    take_profit: number;
  }) => {
    if (!session) return;
    try {
      const placed = await api.placeOrder(session.id, order);
      const refreshed = await api.listTrades(session.id);
      setTrades(refreshed);

      if (placed.status === "open") {
        addToast(
          `${placed.direction === "long" ? "Long" : "Short"} entered at ${placed.entry_price?.toFixed(2)}. SL at ${placed.stop_loss.toFixed(2)}; TP at ${placed.take_profit.toFixed(2)}.`,
          "success",
        );
      } else {
        addToast(
          `${placed.order_type} order placed: ${placed.direction} at trigger ${placed.trigger_price?.toFixed(2)}. SL at ${placed.stop_loss.toFixed(2)}; TP at ${placed.take_profit.toFixed(2)}.`,
          "info",
        );
      }
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 404) {
        resetToStart("That session no longer exists. Start a new one below.");
        return;
      }
      throw err;
    }
  };

  const isFinished = session?.status === "finished";
  const openTrades = trades.filter((t) => t.status === "open");
  const pendingOrders = trades.filter((t) => t.status === "pending");
  const realized = realizedPnl(trades);
  const unrealized = totalUnrealizedPnl(trades, lastPrice);

  return (
    <div className="app">
      <Toasts toasts={toasts} />
      <header>
        <h1>Trading Replay Trainer</h1>
      </header>

      {error && <p className="error banner">{error}</p>}

      {!session && (
        <div className="start-panel">
          <label>
            Instrument
            <select
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
            >
              {instruments.map((inst) => (
                <option key={inst.id} value={inst.symbol}>
                  {inst.symbol} - {inst.name} ({inst.candle_count} candles)
                </option>
              ))}
            </select>
          </label>
          <button onClick={startSession} disabled={loading || !selectedSymbol}>
            {loading ? "Starting..." : "Start Session"}
          </button>
        </div>
      )}

      {session && (
        <>
          <StatsBar
            currentTimeIso={lastCandleTimestamp}
            totalCandles={session.total_candles}
            balance={STARTING_BALANCE + realized}
            realizedPnl={realized}
            runningPnl={realized + unrealized}
          />
          <div className="session-layout">
            <div className="chart-column">
              <Chart
                candles={chartCandles}
                openTrades={openTrades}
                pendingOrders={pendingOrders}
                currentPrice={lastPrice}
                fitTrigger={fitTrigger}
              />
              <div className="controls">
                <button onClick={handleNext} disabled={isFinished}>
                  Next Candle
                </button>
                <span className="progress">
                  Candle {session.current_index + 1} / {session.total_candles}
                </span>
                <label className="inline-label">
                  Timeframe
                  <select
                    value={timeframe}
                    onChange={(e) =>
                      handleTimeframeChange(e.target.value as Timeframe)
                    }
                  >
                    {TIMEFRAMES.map((tf) => (
                      <option key={tf} value={tf}>
                        {tf}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="inline-label">
                  Step
                  <select
                    value={stepSize}
                    onChange={(e) => setStepSize(e.target.value as StepSize)}
                  >
                    {STEP_SIZES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="hint">Ctrl+Space also advances</span>
              </div>
              {isFinished && summary && (
                <SessionSummary
                  summary={summary}
                  onRestart={() => resetToStart()}
                />
              )}
            </div>

            <div className="side-column">
              <TradeForm
                currentPrice={lastPrice}
                disabled={isFinished}
                onSubmit={handlePlaceOrder}
              />
              <TradesPanel trades={trades} currentPrice={lastPrice} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
