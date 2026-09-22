import {
  CandlestickSeries,
  createChart,
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
  currentPrice: number | null;
}

interface TradeLines {
  entry: IPriceLine;
  sl: IPriceLine;
  tp: IPriceLine;
}

export function Chart({ candles, openTrades, currentPrice }: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLinesRef = useRef<Map<number, TradeLines>>(new Map());

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

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      priceLinesRef.current.clear();
    };
  }, []);

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
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    const map = priceLinesRef.current;
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

  return <div ref={containerRef} />;
}
