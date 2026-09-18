from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from app.models.trade import CloseReason, OrderType, TradeDirection, TradeStatus


class OrderCreate(BaseModel):
    direction: TradeDirection
    order_type: OrderType = OrderType.market
    price: float | None = None  # trigger price; required for limit/stop, ignored for market
    stop_loss: float
    take_profit: float

    @field_validator("price", "stop_loss", "take_profit")
    @classmethod
    def must_be_positive(cls, v: float | None) -> float | None:
        if v is not None and v <= 0:
            raise ValueError("must be a positive price")
        return v

    @model_validator(mode="after")
    def price_required_for_pending_orders(self) -> "OrderCreate":
        if self.order_type != OrderType.market and self.price is None:
            raise ValueError(f"price (trigger) is required for a {self.order_type.value} order")
        return self


class TradeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    direction: TradeDirection
    order_type: OrderType
    trigger_price: float | None
    stop_loss: float
    take_profit: float
    status: TradeStatus
    placed_sequence: int
    entry_price: float | None
    entry_sequence: int | None
    exit_price: float | None
    exit_sequence: int | None
    close_reason: CloseReason | None
    pnl: float | None
    created_at: datetime
    filled_at: datetime | None
    closed_at: datetime | None
