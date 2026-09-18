from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Instrument(Base):
    """A tradable symbol. Kept separate from Candle so adding new
    instruments later is just a new row, not a schema change."""

    __tablename__ = "instruments"

    id: Mapped[int] = mapped_column(primary_key=True)
    symbol: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))

    candles: Mapped[list["Candle"]] = relationship(back_populates="instrument", cascade="all, delete-orphan")
