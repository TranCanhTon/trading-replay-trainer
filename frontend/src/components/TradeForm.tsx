import { useState } from "react";
import type { OrderType, TradeDirection } from "../types";

interface TradeFormProps {
  currentPrice: number | null;
  disabled: boolean;
  onSubmit: (order: { direction: TradeDirection; order_type: OrderType; price?: number; stop_loss: number; take_profit: number }) => Promise<void>;
}

const ORDER_TYPE_HELP: Record<OrderType, string> = {
  market: "Fills immediately at the current price.",
  limit: "Fills if price retraces to your trigger price (buy limit below market, sell limit above market).",
  stop: "Fills if price breaks out through your trigger price (buy stop above market, sell stop below market).",
};

export function TradeForm({ currentPrice, disabled, onSubmit }: TradeFormProps) {
  const [direction, setDirection] = useState<TradeDirection>("long");
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [price, setPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const useCurrentPrice = () => {
    if (currentPrice !== null) setPrice(String(currentPrice));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const sl = parseFloat(stopLoss);
    const tp = parseFloat(takeProfit);
    if (Number.isNaN(sl) || Number.isNaN(tp)) {
      setError("Stop loss and take profit must be valid numbers");
      return;
    }

    let triggerPrice: number | undefined;
    if (orderType !== "market") {
      triggerPrice = parseFloat(price);
      if (Number.isNaN(triggerPrice)) {
        setError("Trigger price must be a valid number");
        return;
      }
    }

    setSubmitting(true);
    try {
      await onSubmit({ direction, order_type: orderType, price: triggerPrice, stop_loss: sl, take_profit: tp });
      setPrice("");
      setStopLoss("");
      setTakeProfit("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to place order");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="trade-form">
      <h3>Place Order</h3>
      <label>
        Direction
        <select value={direction} onChange={(e) => setDirection(e.target.value as TradeDirection)} disabled={disabled}>
          <option value="long">Long</option>
          <option value="short">Short</option>
        </select>
      </label>
      <label>
        Order Type
        <select value={orderType} onChange={(e) => setOrderType(e.target.value as OrderType)} disabled={disabled}>
          <option value="market">Market</option>
          <option value="limit">Limit</option>
          <option value="stop">Stop</option>
        </select>
      </label>
      <p className="hint">{ORDER_TYPE_HELP[orderType]}</p>

      {orderType !== "market" && (
        <label>
          Trigger Price
          <div className="input-with-button">
            <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} disabled={disabled} required />
            <button type="button" onClick={useCurrentPrice} disabled={disabled || currentPrice === null}>
              Use current
            </button>
          </div>
        </label>
      )}

      <label>
        Stop Loss
        <input type="number" step="0.01" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} disabled={disabled} required />
      </label>
      <label>
        Take Profit
        <input type="number" step="0.01" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} disabled={disabled} required />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={disabled || submitting}>
        {submitting ? "Placing..." : orderType === "market" ? "Place Trade" : "Place Order"}
      </button>
    </form>
  );
}
