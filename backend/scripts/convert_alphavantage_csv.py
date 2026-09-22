"""Converts a raw Alpha Vantage intraday CSV (timestamp,open,high,low,close,volume
with space-separated, US/Eastern, newest-first timestamps) into the
timestamp,open,high,low,close,volume format load_data.py expects: ISO-8601
timestamps with an explicit UTC offset, sorted oldest-first.

Usage (run from the backend/ directory):
    python scripts/convert_alphavantage_csv.py --in ../data/raw/SPY_1min.csv --symbol SPY
"""

import argparse
import csv
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
EASTERN = ZoneInfo("America/New_York")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--in", dest="in_path", required=True, help="Path to the raw Alpha Vantage CSV")
    parser.add_argument("--symbol", required=True, help="Symbol used for the output filename, e.g. SPY")
    args = parser.parse_args()

    in_path = Path(args.in_path)
    if not in_path.exists():
        raise SystemExit(f"Input file not found: {in_path}")

    with in_path.open(newline="") as f:
        rows = list(csv.DictReader(f))

    converted = []
    for row in rows:
        naive = datetime.strptime(row["timestamp"], "%Y-%m-%d %H:%M:%S")
        ts = naive.replace(tzinfo=EASTERN)
        converted.append(
            {
                "timestamp": ts.isoformat(),
                "open": row["open"],
                "high": row["high"],
                "low": row["low"],
                "close": row["close"],
                "volume": row["volume"],
            }
        )

    converted.sort(key=lambda r: r["timestamp"])

    DATA_DIR.mkdir(exist_ok=True)
    out_path = DATA_DIR / f"{args.symbol}_1m.csv"
    with out_path.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["timestamp", "open", "high", "low", "close", "volume"])
        writer.writeheader()
        writer.writerows(converted)

    print(f"Wrote {len(converted)} candles for {args.symbol} to {out_path}")


if __name__ == "__main__":
    main()
