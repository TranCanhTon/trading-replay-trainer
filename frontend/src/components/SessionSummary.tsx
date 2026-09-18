import type { SessionSummary as SessionSummaryType } from "../types";

interface SessionSummaryProps {
  summary: SessionSummaryType;
  onRestart: () => void;
}

export function SessionSummary({ summary, onRestart }: SessionSummaryProps) {
  return (
    <div className="session-summary">
      <h2>Session Complete</h2>
      <div className="summary-grid">
        <div>
          <span className="label">Total Trades</span>
          <span className="value">{summary.total_trades}</span>
        </div>
        <div>
          <span className="label">Wins</span>
          <span className="value">{summary.wins}</span>
        </div>
        <div>
          <span className="label">Losses</span>
          <span className="value">{summary.losses}</span>
        </div>
        <div>
          <span className="label">Win Rate</span>
          <span className="value">{summary.win_rate.toFixed(1)}%</span>
        </div>
        <div>
          <span className="label">Total PnL</span>
          <span className={`value ${summary.total_pnl >= 0 ? "pnl-positive" : "pnl-negative"}`}>
            {summary.total_pnl.toFixed(2)}
          </span>
        </div>
        <div>
          <span className="label">Cancelled Orders</span>
          <span className="value">{summary.cancelled_orders}</span>
        </div>
      </div>
      <button onClick={onRestart}>Start New Session</button>
    </div>
  );
}
