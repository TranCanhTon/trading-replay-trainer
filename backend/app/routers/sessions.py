from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.candle import Candle
from app.models.instrument import Instrument
from app.models.replay_session import ReplaySession, SessionStatus
from app.models.trade import CloseReason, Trade, TradeStatus
from app.schemas.candle import CandleOut
from app.schemas.session import NextCandleRequest, NextCandleResponse, SessionCreate, SessionOut, SessionSummary
from app.schemas.trade import TradeOut
from app.services.resample import TIMEFRAME_MINUTES, resample_candles
from app.services.trading import cancel_pending_orders, check_and_close_open_trades, check_and_fill_pending_orders, close_trade

router = APIRouter(prefix="/sessions", tags=["sessions"])


def _total_candles(db: Session, instrument_id: int) -> int:
    return db.query(func.count(Candle.id)).filter(Candle.instrument_id == instrument_id).scalar() or 0


def _get_session_or_404(db: Session, session_id: int) -> ReplaySession:
    session = db.get(ReplaySession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="session not found")
    return session


def _to_session_out(db: Session, session: ReplaySession) -> SessionOut:
    return SessionOut(
        id=session.id,
        instrument_id=session.instrument_id,
        current_index=session.current_index,
        status=session.status,
        total_candles=_total_candles(db, session.instrument_id),
    )


@router.post("", response_model=SessionOut)
def create_session(payload: SessionCreate, db: Session = Depends(get_db)):
    instrument = db.query(Instrument).filter(Instrument.symbol == payload.instrument_symbol).first()
    if instrument is None:
        raise HTTPException(status_code=404, detail=f"instrument '{payload.instrument_symbol}' not found")

    total = _total_candles(db, instrument.id)
    if total == 0:
        raise HTTPException(status_code=400, detail="instrument has no candle data loaded")

    if payload.warmup_candles < 1:
        raise HTTPException(status_code=400, detail="warmup_candles must be at least 1")

    session = ReplaySession(
        instrument_id=instrument.id,
        current_index=min(payload.warmup_candles, total) - 1,
        status=SessionStatus.active,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return _to_session_out(db, session)


@router.get("/{session_id}", response_model=SessionOut)
def get_session(session_id: int, db: Session = Depends(get_db)):
    session = _get_session_or_404(db, session_id)
    return _to_session_out(db, session)


@router.get("/{session_id}/candles", response_model=list[CandleOut])
def get_visible_candles(
    session_id: int,
    db: Session = Depends(get_db),
    timeframe: str = Query("1m", description="Display timeframe to aggregate base 1-minute candles into"),
):
    session = _get_session_or_404(db, session_id)
    if timeframe not in TIMEFRAME_MINUTES:
        raise HTTPException(status_code=400, detail=f"unsupported timeframe '{timeframe}'")
    if session.current_index < 0:
        return []

    base_candles = (
        db.query(Candle)
        .filter(Candle.instrument_id == session.instrument_id, Candle.sequence <= session.current_index)
        .order_by(Candle.sequence)
        .all()
    )
    return resample_candles(base_candles, timeframe)


@router.post("/{session_id}/next", response_model=NextCandleResponse)
def advance_candle(session_id: int, payload: NextCandleRequest = NextCandleRequest(), db: Session = Depends(get_db)):
    session = _get_session_or_404(db, session_id)
    if session.status == SessionStatus.finished:
        raise HTTPException(status_code=400, detail="session has already finished")

    total = _total_candles(db, session.instrument_id)
    step = max(1, payload.step_minutes)
    start_index = session.current_index + 1
    end_index = min(start_index + step - 1, total - 1)

    revealed_candles = (
        db.query(Candle)
        .filter(
            Candle.instrument_id == session.instrument_id,
            Candle.sequence >= start_index,
            Candle.sequence <= end_index,
        )
        .order_by(Candle.sequence)
        .all()
    )

    filled_orders: list[Trade] = []
    closed_trades: list[Trade] = []
    cancelled_orders: list[Trade] = []

    for candle in revealed_candles:
        filled_orders.extend(check_and_fill_pending_orders(db, session.id, candle))
        closed_trades.extend(check_and_close_open_trades(db, session.id, candle))

    session.current_index = end_index

    if end_index >= total - 1 and revealed_candles:
        last_candle = revealed_candles[-1]
        cancelled_orders = cancel_pending_orders(db, session.id)
        still_open = (
            db.query(Trade)
            .filter(Trade.session_id == session.id, Trade.status == TradeStatus.open)
            .all()
        )
        for trade in still_open:
            close_trade(trade, float(last_candle.close), last_candle.sequence, CloseReason.session_end)
        closed_trades.extend(still_open)
        session.status = SessionStatus.finished

    db.commit()
    db.refresh(session)

    return NextCandleResponse(
        session=_to_session_out(db, session),
        candles=[CandleOut.model_validate(c) for c in revealed_candles],
        filled_orders=[TradeOut.model_validate(t) for t in filled_orders],
        closed_trades=[TradeOut.model_validate(t) for t in closed_trades],
        cancelled_orders=[TradeOut.model_validate(t) for t in cancelled_orders],
    )


@router.get("/{session_id}/summary", response_model=SessionSummary)
def get_summary(session_id: int, db: Session = Depends(get_db)):
    session = _get_session_or_404(db, session_id)
    trades = db.query(Trade).filter(Trade.session_id == session.id).all()

    closed = [t for t in trades if t.status == TradeStatus.closed]
    open_count = sum(1 for t in trades if t.status == TradeStatus.open)
    pending_count = sum(1 for t in trades if t.status == TradeStatus.pending)
    cancelled_count = sum(1 for t in trades if t.status == TradeStatus.cancelled)
    wins = sum(1 for t in closed if float(t.pnl or 0) > 0)
    losses = sum(1 for t in closed if float(t.pnl or 0) <= 0)
    total_pnl = sum(float(t.pnl or 0) for t in closed)
    win_rate = (wins / len(closed) * 100) if closed else 0.0

    return SessionSummary(
        session_id=session.id,
        status=session.status,
        total_trades=len(closed) + open_count,
        open_trades=open_count,
        closed_trades=len(closed),
        pending_orders=pending_count,
        cancelled_orders=cancelled_count,
        wins=wins,
        losses=losses,
        win_rate=round(win_rate, 2),
        total_pnl=round(total_pnl, 4),
    )
