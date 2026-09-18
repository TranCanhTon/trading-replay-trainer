from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.candle import Candle
from app.models.replay_session import ReplaySession, SessionStatus
from app.models.trade import OrderType, Trade, TradeStatus
from app.schemas.trade import OrderCreate, TradeOut
from app.services.trading import validate_sl_tp, validate_trigger_price

router = APIRouter(prefix="/sessions/{session_id}/trades", tags=["trades"])


def _get_session_or_404(db: Session, session_id: int) -> ReplaySession:
    session = db.get(ReplaySession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="session not found")
    return session


@router.post("", response_model=TradeOut)
def place_order(session_id: int, payload: OrderCreate, db: Session = Depends(get_db)):
    session = _get_session_or_404(db, session_id)

    if session.status != SessionStatus.active:
        raise HTTPException(status_code=400, detail="session is not active")
    if session.current_index < 0:
        raise HTTPException(status_code=400, detail="no candle is visible yet; advance the session first")

    current_candle = (
        db.query(Candle)
        .filter(Candle.instrument_id == session.instrument_id, Candle.sequence == session.current_index)
        .first()
    )
    current_price = float(current_candle.close)

    try:
        if payload.order_type == OrderType.market:
            validate_sl_tp(payload.direction, current_price, payload.stop_loss, payload.take_profit)
        else:
            validate_trigger_price(payload.direction, payload.order_type, payload.price, current_price)
            validate_sl_tp(payload.direction, payload.price, payload.stop_loss, payload.take_profit)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if payload.order_type == OrderType.market:
        trade = Trade(
            session_id=session.id,
            direction=payload.direction,
            order_type=payload.order_type,
            trigger_price=None,
            stop_loss=payload.stop_loss,
            take_profit=payload.take_profit,
            status=TradeStatus.open,
            placed_sequence=session.current_index,
            entry_price=current_price,
            entry_sequence=session.current_index,
            filled_at=datetime.now(timezone.utc),
        )
    else:
        trade = Trade(
            session_id=session.id,
            direction=payload.direction,
            order_type=payload.order_type,
            trigger_price=payload.price,
            stop_loss=payload.stop_loss,
            take_profit=payload.take_profit,
            status=TradeStatus.pending,
            placed_sequence=session.current_index,
        )

    db.add(trade)
    db.commit()
    db.refresh(trade)
    return trade


@router.get("", response_model=list[TradeOut])
def list_trades(session_id: int, db: Session = Depends(get_db)):
    _get_session_or_404(db, session_id)
    return (
        db.query(Trade)
        .filter(Trade.session_id == session_id)
        .order_by(Trade.created_at)
        .all()
    )
