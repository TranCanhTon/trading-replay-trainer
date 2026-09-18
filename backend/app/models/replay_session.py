import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SessionStatus(str, enum.Enum):
    active = "active"
    finished = "finished"


class ReplaySession(Base):
    __tablename__ = "replay_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    instrument_id: Mapped[int] = mapped_column(ForeignKey("instruments.id"), index=True)
    # index (into the instrument's ordered candles) of the last candle revealed to the player.
    # -1 means no candles revealed yet.
    current_index: Mapped[int] = mapped_column(Integer, default=-1)
    status: Mapped[SessionStatus] = mapped_column(Enum(SessionStatus), default=SessionStatus.active)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    instrument: Mapped["Instrument"] = relationship()
    trades: Mapped[list["Trade"]] = relationship(back_populates="session", cascade="all, delete-orphan")
