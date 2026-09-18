from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Candle(Base):
    __tablename__ = "candles"
    __table_args__ = (UniqueConstraint("instrument_id", "timestamp", name="uq_candle_instrument_timestamp"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    instrument_id: Mapped[int] = mapped_column(ForeignKey("instruments.id"), index=True)
    sequence: Mapped[int] = mapped_column(index=True)  # 0-based order within the instrument's series
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    open: Mapped[float] = mapped_column(Numeric(12, 4))
    high: Mapped[float] = mapped_column(Numeric(12, 4))
    low: Mapped[float] = mapped_column(Numeric(12, 4))
    close: Mapped[float] = mapped_column(Numeric(12, 4))
    volume: Mapped[int] = mapped_column()

    instrument: Mapped["Instrument"] = relationship(back_populates="candles")
