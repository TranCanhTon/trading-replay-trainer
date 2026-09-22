import { formatDurationMinutes, formatHelsinki } from "../time";

interface StatsBarProps {
  currentTimeIso: string | null;
  totalCandles: number;
  balance: number;
  realizedPnl: number;
  runningPnl: number;
}

export function StatsBar({ currentTimeIso, totalCandles, balance, realizedPnl, runningPnl }: StatsBarProps) {
  return (
    <div className="stats-bar">
      <div className="stat">
        <span className="stat-label">Time (Helsinki)</span>
        <span className="stat-value">{currentTimeIso ? formatHelsinki(currentTimeIso) : "-"}</span>
      </div>
      <div className="stat">
        <span className="stat-label">Max History</span>
        <span className="stat-value">{formatDurationMinutes(totalCandles)}</span>
      </div>
      <div className="stat">
        <span className="stat-label">Balance</span>
        <span className="stat-value">${balance.toFixed(2)}</span>
      </div>
      <div className="stat">
        <span className="stat-label">PnL (realized)</span>
        <span className={`stat-value ${realizedPnl >= 0 ? "pnl-positive" : "pnl-negative"}`}>
          {realizedPnl.toFixed(2)}
        </span>
      </div>
      <div className="stat">
        <span className="stat-label">Running PnL</span>
        <span className={`stat-value ${runningPnl >= 0 ? "pnl-positive" : "pnl-negative"}`}>
          {runningPnl.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
