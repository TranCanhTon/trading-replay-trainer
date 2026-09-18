from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.candle import Candle
from app.models.trade import CloseReason, OrderType, Trade, TradeDirection, TradeStatus


def validate_sl_tp(direction: TradeDirection, reference_price: float, stop_loss: float, take_profit: float) -> None:
    """reference_price is the entry price (market) or trigger price (limit/stop)."""
    if direction == TradeDirection.long:
        if not (stop_loss < reference_price < take_profit):
            raise ValueError("for a long trade, stop_loss must be below entry/trigger price, which must be below take_profit")
    else:
        if not (take_profit < reference_price < stop_loss):
            raise ValueError("for a short trade, take_profit must be below entry/trigger price, which must be below stop_loss")


def validate_trigger_price(direction: TradeDirection, order_type: OrderType, trigger_price: float, current_price: float) -> None:
    """Limit orders wait for price to retrace toward you; stop orders wait for
    a breakout away from the current price. Enforces the conventional
    direction of each relative to where price is right now."""
    if order_type == OrderType.limit:
        if direction == TradeDirection.long and not (trigger_price < current_price):
            raise ValueError("a buy limit must be placed below the current price")
        if direction == TradeDirection.short and not (trigger_price > current_price):
            raise ValueError("a sell limit must be placed above the current price")
    elif order_type == OrderType.stop:
        if direction == TradeDirection.long and not (trigger_price > current_price):
            raise ValueError("a buy stop must be placed above the current price")
        if direction == TradeDirection.short and not (trigger_price < current_price):
            raise ValueError("a sell stop must be placed below the current price")


def calculate_pnl(direction: TradeDirection, entry_price: float, exit_price: float) -> float:
    if direction == TradeDirection.long:
        return exit_price - entry_price
    return entry_price - exit_price


def fill_order(trade: Trade, fill_price: float, fill_sequence: int) -> None:
    trade.status = TradeStatus.open
    trade.entry_price = fill_price
    trade.entry_sequence = fill_sequence
    trade.filled_at = datetime.now(timezone.utc)


def close_trade(trade: Trade, exit_price: float, exit_sequence: int, reason: CloseReason) -> None:
    trade.status = TradeStatus.closed
    trade.exit_price = exit_price
    trade.exit_sequence = exit_sequence
    trade.close_reason = reason
    trade.pnl = calculate_pnl(TradeDirection(trade.direction), float(trade.entry_price), exit_price)
    trade.closed_at = datetime.now(timezone.utc)


def check_and_fill_pending_orders(db: Session, session_id: int, candle: Candle) -> list[Trade]:
    """Checks every pending limit/stop order against the given candle's
    high/low range and fills any whose trigger price was touched."""
    pending_orders = (
        db.query(Trade)
        .filter(Trade.session_id == session_id, Trade.status == TradeStatus.pending)
        .all()
    )

    filled: list[Trade] = []
    high = float(candle.high)
    low = float(candle.low)

    for order in pending_orders:
        direction = TradeDirection(order.direction)
        order_type = OrderType(order.order_type)
        trigger = float(order.trigger_price)

        if order_type == OrderType.limit:
            touched = low <= trigger if direction == TradeDirection.long else high >= trigger
        else:  # stop
            touched = high >= trigger if direction == TradeDirection.long else low <= trigger

        if touched:
            fill_order(order, trigger, candle.sequence)
            filled.append(order)

    return filled


def check_and_close_open_trades(db: Session, session_id: int, candle: Candle) -> list[Trade]:
    """Checks every open trade in the session against the given candle's
    high/low range and closes any whose SL or TP was touched. If both the
    stop loss and take profit fall within the candle's range, the stop loss
    is assumed to have been hit first (conservative default)."""
    open_trades = (
        db.query(Trade)
        .filter(Trade.session_id == session_id, Trade.status == TradeStatus.open)
        .all()
    )

    closed: list[Trade] = []
    high = float(candle.high)
    low = float(candle.low)

    for trade in open_trades:
        direction = TradeDirection(trade.direction)
        stop_loss = float(trade.stop_loss)
        take_profit = float(trade.take_profit)

        if direction == TradeDirection.long:
            hit_sl = low <= stop_loss
            hit_tp = high >= take_profit
        else:
            hit_sl = high >= stop_loss
            hit_tp = low <= take_profit

        if hit_sl:
            close_trade(trade, stop_loss, candle.sequence, CloseReason.stop_loss)
            closed.append(trade)
        elif hit_tp:
            close_trade(trade, take_profit, candle.sequence, CloseReason.take_profit)
            closed.append(trade)

    return closed


def cancel_pending_orders(db: Session, session_id: int) -> list[Trade]:
    pending_orders = (
        db.query(Trade)
        .filter(Trade.session_id == session_id, Trade.status == TradeStatus.pending)
        .all()
    )
    for order in pending_orders:
        order.status = TradeStatus.cancelled
    return pending_orders
