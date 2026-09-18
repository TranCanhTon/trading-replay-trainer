"""Loads a CSV of OHLCV candles into Postgres for a given instrument symbol.

Idempotent: re-running for the same symbol replaces that instrument's candles
rather than duplicating them, so it's safe to re-run after regenerating data.

Usage (run from the backend/ directory):
    python scripts/load_data.py --symbol MNQ --name "Micro E-mini Nasdaq-100" --file ../data/MNQ_1m.csv
"""

import argparse
import csv
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.models.candle import Candle  # noqa: E402
from app.models.instrument import Instrument  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--symbol", required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--file", required=True, help="Path to a CSV with timestamp,open,high,low,close,volume")
    args = parser.parse_args()

    Base.metadata.create_all(bind=engine)

    csv_path = Path(args.file)
    if not csv_path.exists():
        raise SystemExit(f"CSV file not found: {csv_path}")

    db = SessionLocal()
    try:
        instrument = db.query(Instrument).filter(Instrument.symbol == args.symbol).first()
        if instrument is None:
            instrument = Instrument(symbol=args.symbol, name=args.name)
            db.add(instrument)
            db.flush()
        else:
            instrument.name = args.name
            db.query(Candle).filter(Candle.instrument_id == instrument.id).delete()

        with csv_path.open(newline="") as f:
            reader = csv.DictReader(f)
            rows = sorted(reader, key=lambda r: r["timestamp"])

        for sequence, row in enumerate(rows):
            db.add(
                Candle(
                    instrument_id=instrument.id,
                    sequence=sequence,
                    timestamp=datetime.fromisoformat(row["timestamp"]),
                    open=float(row["open"]),
                    high=float(row["high"]),
                    low=float(row["low"]),
                    close=float(row["close"]),
                    volume=int(row["volume"]),
                )
            )

        db.commit()
        print(f"Loaded {len(rows)} candles for {args.symbol} ({args.name})")
    finally:
        db.close()


if __name__ == "__main__":
    main()
