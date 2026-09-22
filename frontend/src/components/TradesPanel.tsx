import { unrealizedPnl } from "../pnl";
import type { Trade } from "../types";

interface TradesPanelProps {
  trades: Trade[];
  currentPrice: number | null;
}

export function TradesPanel({ trades, currentPrice }: TradesPanelProps) {
  const pendingOrders = trades.filter((t) => t.status === "pending");
  const openTrades = trades.filter((t) => t.status === "open");
  const closedTrades = trades.filter((t) => t.status === "closed" || t.status === "cancelled");

  return (
    <div className="trades-panel">
      {pendingOrders.length > 0 && (
        <>
          <h4>Pending Orders ({pendingOrders.length})</h4>
          <table>
            <thead>
              <tr>
                <th>Dir</th>
                <th>Type</th>
                <th>Trigger</th>
                <th>SL</th>
                <th>TP</th>
              </tr>
            </thead>
            <tbody>
              {pendingOrders.map((t) => (
                <tr key={t.id}>
                  <td>{t.direction}</td>
                  <td>{t.order_type}</td>
                  <td>{t.trigger_price}</td>
                  <td>{t.stop_loss}</td>
                  <td>{t.take_profit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h4>Open Trades ({openTrades.length})</h4>
      {openTrades.length === 0 ? (
        <p className="muted">No open trades</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Dir</th>
              <th>Type</th>
              <th>Entry</th>
              <th>SL</th>
              <th>TP</th>
              <th>Unrealized PnL</th>
            </tr>
          </thead>
          <tbody>
            {openTrades.map((t) => {
              const pnl = currentPrice !== null ? unrealizedPnl(t, currentPrice) : null;
              return (
                <tr key={t.id}>
                  <td>{t.direction}</td>
                  <td>{t.order_type}</td>
                  <td>{t.entry_price}</td>
                  <td>{t.stop_loss}</td>
                  <td>{t.take_profit}</td>
                  <td className={pnl !== null && pnl >= 0 ? "pnl-positive" : "pnl-negative"}>
                    {pnl !== null ? pnl.toFixed(2) : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <h4>Closed / Cancelled ({closedTrades.length})</h4>
      {closedTrades.length === 0 ? (
        <p className="muted">No closed trades yet</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Dir</th>
              <th>Type</th>
              <th>Entry</th>
              <th>Exit</th>
              <th>Reason</th>
              <th>PnL</th>
            </tr>
          </thead>
          <tbody>
            {closedTrades.map((t) => (
              <tr key={t.id}>
                <td>{t.direction}</td>
                <td>{t.order_type}</td>
                <td>{t.entry_price ?? "-"}</td>
                <td>{t.exit_price ?? "-"}</td>
                <td>{t.status === "cancelled" ? "cancelled" : t.close_reason}</td>
                <td className={(t.pnl ?? 0) >= 0 ? "pnl-positive" : "pnl-negative"}>
                  {t.pnl !== null ? t.pnl.toFixed(2) : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
