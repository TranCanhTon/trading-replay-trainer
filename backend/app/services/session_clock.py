from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.models.candle import Candle

NY_TZ = ZoneInfo("America/New_York")
NY_AM_OPEN_HOUR = 9
NY_AM_OPEN_MINUTE = 30


def find_ny_am_open_index(db: Session, instrument_id: int) -> int:
    """Returns the sequence of the first candle at/after 9:30 AM America/New_York
    on the first calendar day present in the instrument's data. Falls back to
    0 (the very first candle) if the data never reaches that time."""
    first_candle = (
        db.query(Candle)
        .filter(Candle.instrument_id == instrument_id)
        .order_by(Candle.sequence)
        .first()
    )
    if first_candle is None:
        return 0

    local_date = first_candle.timestamp.astimezone(NY_TZ).date()
    target_ny = datetime(
        local_date.year, local_date.month, local_date.day, NY_AM_OPEN_HOUR, NY_AM_OPEN_MINUTE, tzinfo=NY_TZ
    )
    target_utc = target_ny.astimezone(timezone.utc)

    candle = (
        db.query(Candle)
        .filter(Candle.instrument_id == instrument_id, Candle.timestamp >= target_utc)
        .order_by(Candle.sequence)
        .first()
    )
    return candle.sequence if candle else 0


def epoch_minutes(dt: datetime) -> int:
    return int(dt.timestamp() // 60)


def next_aligned_epoch_minute(current_epoch_minute: int, step_minutes: int) -> int:
    """Given the epoch-minute of the currently-revealed candle, returns the
    epoch-minute of the next candle to reveal such that it lands exactly
    step_minutes-1 minutes into its own clock-aligned bucket (e.g. stepping by
    30m always lands on :29 or :59 past the hour) -- mirroring how a candle
    of that size "closes" one second before the next boundary. Landing at a
    step_minutes==1 is trivially satisfied by every minute, so this reduces to
    a plain +1 in that case."""
    candidate = current_epoch_minute + 1
    remainder = candidate % step_minutes
    return candidate + ((step_minutes - 1 - remainder) % step_minutes)
