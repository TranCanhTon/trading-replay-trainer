from dataclasses import dataclass
from datetime import datetime, timezone

from app.models.candle import Candle

TIMEFRAME_MINUTES = {
    "1m": 1,
    "3m": 3,
    "5m": 5,
    "15m": 15,
    "30m": 30,
    "1h": 60,
}


@dataclass
class AggregatedCandle:
    sequence: int
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: int


def resample_candles(candles: list[Candle], timeframe: str) -> list[AggregatedCandle]:
    """Aggregates a time-ordered list of 1-minute candles into the given
    display timeframe. Bucket boundaries align to clock time (e.g. 15m
    buckets start on :00/:15/:30/:45), matching how charting platforms
    normally bucket bars. The last bucket may be a partial (still-forming)
    candle if the replay pointer is mid-bucket -- that's intentional, it's
    what lets the player watch the current candle build up."""
    minutes = TIMEFRAME_MINUTES[timeframe]
    if minutes == 1:
        return [
            AggregatedCandle(
                sequence=c.sequence,
                timestamp=c.timestamp,
                open=float(c.open),
                high=float(c.high),
                low=float(c.low),
                close=float(c.close),
                volume=c.volume,
            )
            for c in candles
        ]

    buckets: list[AggregatedCandle] = []
    current_bucket_key = None

    for c in candles:
        epoch_minutes = int(c.timestamp.astimezone(timezone.utc).timestamp() // 60)
        bucket_key = epoch_minutes - (epoch_minutes % minutes)

        if bucket_key != current_bucket_key:
            current_bucket_key = bucket_key
            buckets.append(
                AggregatedCandle(
                    sequence=len(buckets),
                    timestamp=c.timestamp,
                    open=float(c.open),
                    high=float(c.high),
                    low=float(c.low),
                    close=float(c.close),
                    volume=c.volume,
                )
            )
        else:
            bucket = buckets[-1]
            bucket.high = max(bucket.high, float(c.high))
            bucket.low = min(bucket.low, float(c.low))
            bucket.close = float(c.close)
            bucket.volume += c.volume

    return buckets
