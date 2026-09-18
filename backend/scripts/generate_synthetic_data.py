"""Generates a synthetic 1-minute OHLCV series and writes it to data/<SYMBOL>_1m.csv.

Real historical data can be swapped in later by dropping a CSV with the same
columns (timestamp,open,high,low,close,volume) into the data/ folder and
pointing load_data.py at it -- nothing else in the app needs to change.
"""

import argparse
import csv
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"


def generate_candles(start_price: float, count: int, tick_size: float, seed: int) -> list[dict]:
    rng = random.Random(seed)
    candles = []
    price = start_price
    timestamp = datetime(2025, 1, 2, 14, 30, tzinfo=timezone.utc)  # a US market open, arbitrary

    for _ in range(count):
        open_price = price
        # random walk in ticks, mildly trending drift removed to keep it centered
        num_ticks = rng.randint(1, 12)
        drift = rng.choice([-1, 1])
        close_price = open_price + drift * num_ticks * tick_size

        high_extra = rng.randint(0, 6) * tick_size
        low_extra = rng.randint(0, 6) * tick_size
        high_price = max(open_price, close_price) + high_extra
        low_price = min(open_price, close_price) - low_extra
        volume = rng.randint(50, 500)

        candles.append(
            {
                "timestamp": timestamp.isoformat(),
                "open": round(open_price, 2),
                "high": round(high_price, 2),
                "low": round(low_price, 2),
                "close": round(close_price, 2),
                "volume": volume,
            }
        )

        price = close_price
        timestamp += timedelta(minutes=1)

    return candles


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--symbol", default="MNQ", help="Instrument symbol, used for the output filename")
    parser.add_argument("--start-price", type=float, default=18500.0)
    parser.add_argument("--count", type=int, default=3000, help="Number of 1-minute candles to generate")
    parser.add_argument("--tick-size", type=float, default=0.25)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    candles = generate_candles(args.start_price, args.count, args.tick_size, args.seed)

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    out_path = DATA_DIR / f"{args.symbol}_1m.csv"
    with out_path.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["timestamp", "open", "high", "low", "close", "volume"])
        writer.writeheader()
        writer.writerows(candles)

    print(f"Wrote {len(candles)} candles to {out_path}")


if __name__ == "__main__":
    main()
