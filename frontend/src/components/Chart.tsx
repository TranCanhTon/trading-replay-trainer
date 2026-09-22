import {
  CandlestickSeries,
  createChart,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef } from "react";
import { unrealizedPnl } from "../pnl";
import { toChartTime } from "../time";
import type { Candle, Trade } from "../types";

interface ChartProps {
  candles: Candle[];
  openTrades: Trade[];
  pendingOrders: Trade[];
  currentPrice: number | null;
  /** Bump this number to force the chart to re-fit its visible range to all
   * data (e.g. on session start or timeframe change). Stepping through
   * candles should NOT bump this, so the viewer's pan/zoom is preserved. */
  fitTrigger: number;
}

interface TradeLines {
  entry: IPriceLine;
  sl: IPriceLine;
  tp: IPriceLine;
}

export function Chart({ candles, openTrades, pendingOrders, currentPrice, fitTrigger }: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const openLinesRef = useRef<Map<number, TradeLines>>(new Map());
  const pendingLinesRef = useRef<Map<number, TradeLines>>(new Map());

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 500,
      layout: { background: { color: "#131722" }, textColor: "#d1d4dc" },
      grid: {
        vertLines: { color: "#1e222d" },
        horzLines: { color: "#1e222d" },
      },
      timeScale: { timeVisible: true, secondsVisible: false },
      crosshair: { mode: CrosshairMode.Normal },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        chart.applyOptions({ width: entry.contentRect.width });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      openLinesRef.current.clear();
      pendingLinesRef.current.clear();
    };
  }, []);

  // Update the candle series whenever the visible data changes (every step
  // AND every timeframe switch). This intentionally does NOT touch zoom/pan.
  useEffect(() => {
    if (!seriesRef.current) return;
    const data = candles.map((c) => ({
      time: toChartTime(c.timestamp) as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    seriesRef.current.setData(data);
  }, [candles]);

  // Only re-fit the visible range when explicitly requested (session start,
  // timeframe change) -- never on a plain step, so panning/zoom sticks.
  useEffect(() => {
    if (fitTrigger === 0) return;
    chartRef.current?.timeScale().fitContent();
  }, [fitTrigger]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    const map = openLinesRef.current;
    const openIds = new Set(openTrades.map((t) => t.id));

    for (const [id, lines] of map.entries()) {
      if (!openIds.has(id)) {
        series.removePriceLine(lines.entry);
        series.removePriceLine(lines.sl);
        series.removePriceLine(lines.tp);
        map.delete(id);
      }
    }

    for (const trade of openTrades) {
      const entryPrice = trade.entry_price ?? 0;
      const pnl = currentPrice !== null ? unrealizedPnl(trade, currentPrice) : null;
      const pnlText = pnl !== null ? ` | PnL ${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}` : "";
      const entryTitle = `${trade.direction === "long" ? "Long" : "Short"} entry ${entryPrice.toFixed(2)}${pnlText}`;

      const existing = map.get(trade.id);
      if (!existing) {
        map.set(trade.id, {
          entry: series.createPriceLine({
            price: entryPrice,
            color: "#4c78ff",
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
            axisLabelVisible: true,
            title: entryTitle,
          }),
          sl: series.createPriceLine({
            price: trade.stop_loss,
            color: "#ef5350",
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: `SL (risk) ${trade.stop_loss.toFixed(2)}`,
          }),
          tp: series.createPriceLine({
            price: trade.take_profit,
            color: "#26a69a",
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: `TP (reward) ${trade.take_profit.toFixed(2)}`,
          }),
        });
      } else {
        existing.entry.applyOptions({ title: entryTitle });
      }
    }
  }, [openTrades, currentPrice]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    const map = pendingLinesRef.current;
    const pendingIds = new Set(pendingOrders.map((t) => t.id));

    for (const [id, lines] of map.entries()) {
      if (!pendingIds.has(id)) {
        series.removePriceLine(lines.entry);
        series.removePriceLine(lines.sl);
        series.removePriceLine(lines.tp);
        map.delete(id);
      }
    }

    for (const order of pendingOrders) {
      if (map.has(order.id)) continue;
      const trigger = order.trigger_price ?? 0;
      const label = `${order.direction === "long" ? "Long" : "Short"} ${order.order_type} pending @ ${trigger.toFixed(2)}`;

      map.set(order.id, {
        entry: series.createPriceLine({
          price: trigger,
          color: "#c084fc",
          lineWidth: 2,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: label,
        }),
        sl: series.createPriceLine({
          price: order.stop_loss,
          color: "#8b4a4a",
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `SL (risk) ${order.stop_loss.toFixed(2)}`,
        }),
        tp: series.createPriceLine({
          price: order.take_profit,
          color: "#3f7a72",
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `TP (reward) ${order.take_profit.toFixed(2)}`,
        }),
      });
    }
  }, [pendingOrders]);

  return <div ref={containerRef} />;
}
