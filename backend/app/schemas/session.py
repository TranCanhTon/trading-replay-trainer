from pydantic import BaseModel, ConfigDict

from app.models.replay_session import SessionStatus
from app.schemas.candle import CandleOut
from app.schemas.trade import TradeOut


class SessionCreate(BaseModel):
    instrument_symbol: str  # session always starts at the instrument's NY AM (9:30 ET) open


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    instrument_id: int
    current_index: int
    status: SessionStatus
    total_candles: int


class NextCandleRequest(BaseModel):
    step_minutes: int = 1  # how many 1-minute base candles to advance per step


class NextCandleResponse(BaseModel):
    session: SessionOut
    candles: list[CandleOut]  # every base candle revealed by this step, in order
    filled_orders: list[TradeOut]
    closed_trades: list[TradeOut]
    cancelled_orders: list[TradeOut]


class SessionSummary(BaseModel):
    session_id: int
    status: SessionStatus
    total_trades: int
    open_trades: int
    closed_trades: int
    pending_orders: int
    cancelled_orders: int
    wins: int
    losses: int
    win_rate: float
    total_pnl: float
