from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.candle import Candle
from app.models.instrument import Instrument
from app.schemas.instrument import InstrumentOut

router = APIRouter(prefix="/instruments", tags=["instruments"])


@router.get("", response_model=list[InstrumentOut])
def list_instruments(db: Session = Depends(get_db)):
    rows = (
        db.query(Instrument, func.count(Candle.id))
        .outerjoin(Candle, Candle.instrument_id == Instrument.id)
        .group_by(Instrument.id)
        .all()
    )
    return [
        InstrumentOut(id=inst.id, symbol=inst.symbol, name=inst.name, candle_count=count)
        for inst, count in rows
    ]
