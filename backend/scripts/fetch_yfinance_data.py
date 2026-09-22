"""Fetches real historical OHLCV candles from Yahoo Finance and writes them to
data/<SYMBOL>_<interval>.csv in the same format generate_synthetic_data.py
produces (timestamp,open,high,low,close,volume), so load_data.py needs no
changes to consume it.

Yahoo only serves 1m data for the trailing ~7 days; use a coarser --interval
(e.g. 5m, 15m, 1h) for a longer history.

Usage (run from the backend/ directory):
    python scripts/fetch_yfinance_data.py --ticker MNQ=F --symbol MNQ --interval 1m --period 7d
    python scripts/fetch_yfinance_data.py --ticker ES=F --symbol ES --interval 5m --period 60d
"""

import argparse
import csv
from pathlib import Path

import yfinance as yf

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ticker", required=True, help="Yahoo Finance ticker, e.g. MNQ=F, ES=F, ^GSPC")
    parser.add_argument("--symbol", required=True, help="Short symbol used for the output filename, e.g. MNQ")
    parser.add_argument("--interval", default="1m", help="Candle interval: 1m,2m,5m,15m,30m,60m,1d,...")
    parser.add_argument("--period", default="7d", help="How far back to fetch, e.g. 7d, 60d, 1y")
    args = parser.parse_args()

    df = yf.Ticker(args.ticker).history(interval=args.interval, period=args.period, auto_adjust=False)
    if df.empty:
        raise SystemExit(f"No data returned for ticker {args.ticker} (interval={args.interval}, period={args.period})")

    DATA_DIR.mkdir(exist_ok=True)
    out_path = DATA_DIR / f"{args.symbol}_{args.interval}.csv"

    with out_path.open("w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["timestamp", "open", "high", "low", "close", "volume"])
        for ts, row in df.iterrows():
            writer.writerow(
                [
                    ts.isoformat(),
                    round(float(row["Open"]), 4),
                    round(float(row["High"]), 4),
                    round(float(row["Low"]), 4),
                    round(float(row["Close"]), 4),
                    int(row["Volume"]),
                ]
            )

    print(f"Wrote {len(df)} candles for {args.ticker} to {out_path}")


if __name__ == "__main__":
    main()
