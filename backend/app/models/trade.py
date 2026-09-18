import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TradeDirection(str, enum.Enum):
    long = "long"
    short = "short"


class OrderType(str, enum.Enum):
    market = "market"  # fills immediately at the current candle's close
    limit = "limit"  # fills when price retraces to a trigger level
    stop = "stop"  # fills when price breaks out through a trigger level


class TradeStatus(str, enum.Enum):
    pending = "pending"  # limit/stop order placed, not yet triggered
    open = "open"  # position live
    closed = "closed"  # position exited (SL, TP, or session end)
    cancelled = "cancelled"  # pending order never triggered before session end


class CloseReason(str, enum.Enum):
    take_profit = "take_profit"
    stop_loss = "stop_loss"
    manual = "manual"
    session_end = "session_end"


class Trade(Base):
    __tablename__ = "trades"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("replay_sessions.id"), index=True)

    direction: Mapped[TradeDirection] = mapped_column(Enum(TradeDirection))
    order_type: Mapped[OrderType] = mapped_column(Enum(OrderType))

    # For limit/stop orders: the price that must be touched to trigger a fill.
    # Null for market orders (they fill immediately, see entry_price).
    trigger_price: Mapped[float | None] = mapped_column(Numeric(12, 4), nullable=True)

    stop_loss: Mapped[float] = mapped_column(Numeric(12, 4))
    take_profit: Mapped[float] = mapped_column(Numeric(12, 4))

    status: Mapped[TradeStatus] = mapped_column(Enum(TradeStatus), default=TradeStatus.pending)

    placed_sequence: Mapped[int] = mapped_column(Integer)  # candle index when the order was created

    # Set once the order fills (immediately for market orders).
    entry_price: Mapped[float | None] = mapped_column(Numeric(12, 4), nullable=True)
    entry_sequence: Mapped[int | None] = mapped_column(Integer, nullable=True)

    exit_price: Mapped[float | None] = mapped_column(Numeric(12, 4), nullable=True)
    exit_sequence: Mapped[int | None] = mapped_column(Integer, nullable=True)
    close_reason: Mapped[CloseReason | None] = mapped_column(Enum(CloseReason), nullable=True)
    pnl: Mapped[float | None] = mapped_column(Numeric(12, 4), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    filled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    session: Mapped["ReplaySession"] = relationship(back_populates="trades")
