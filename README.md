# Trading Replay Trainer

Phase 1: local-only MVP. Load historical MNQ candles, step through them one
at a time, place market/limit/stop orders with SL/TP, auto-fill and
auto-close on trigger, and see a session summary. No Docker, no auth, one
instrument.

## Project layout

```
backend/     FastAPI app (Python, Postgres via SQLAlchemy)
frontend/    React + TradingView lightweight-charts (Vite)
data/        CSV candle data (synthetic or real, per instrument)
```

## Prerequisites (already set up on this machine)

- PostgreSQL 17 running as a Windows service (`postgresql-x64-17`)
- Database `trading_replay`, owned by role `replay_app` / password `replay_app_pw`, on `localhost:5432`
- Python 3.10, Node 24 / npm 11

Once the backend and frontend are each set up per steps 1–2 below, you can
run both together with one command from the project root:

```bash
npm install   # once, to get concurrently
npm run dev
```

## 1. Backend

```bash
cd backend
python -m venv venv          # already created
./venv/Scripts/pip install -r requirements.txt   # already installed
```

Config lives in `backend/.env` (copy `.env.example` if it's missing):

```
DATABASE_URL=postgresql+psycopg2://replay_app:replay_app_pw@localhost:5432/trading_replay
CORS_ORIGINS=http://localhost:5173
```

Load candle data (already done once; re-run any time to reload/replace):

```bash
cd backend
./venv/Scripts/python.exe scripts/generate_synthetic_data.py --symbol MNQ --count 3000
./venv/Scripts/python.exe scripts/load_data.py --symbol MNQ --name "Micro E-mini Nasdaq-100" --file ../data/MNQ_1m.csv
```

Or load real historical data from Yahoo Finance instead of synthetic data
(no API key needed; 1m bars only cover the trailing ~7 days, use a coarser
`--interval` for a longer history):

```bash
cd backend
./venv/Scripts/python.exe scripts/fetch_yfinance_data.py --ticker MNQ=F --symbol MNQ --interval 1m --period 7d
./venv/Scripts/python.exe scripts/load_data.py --symbol MNQ --name "Micro E-mini Nasdaq-100" --file ../data/MNQ_1m.csv

./venv/Scripts/python.exe scripts/fetch_yfinance_data.py --ticker ES=F --symbol ES --interval 1m --period 7d
./venv/Scripts/python.exe scripts/load_data.py --symbol ES --name "E-mini S&P 500" --file ../data/ES_1m.csv
```

Run the API:

```bash
cd backend
./venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

- API: http://localhost:8000
- Interactive docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

## 2. Frontend

```bash
cd frontend
npm install     # already run once
npm run dev
```

- App: http://localhost:5173
- Config lives in `frontend/.env` (copy `.env.example` if missing): `VITE_API_URL=http://localhost:8000`

A project-local `frontend/.npmrc` points npm's cache at `frontend/.npm-cache`
instead of the machine-wide default — the global npm cache/prefix on this
machine point at a `D:\` path that's read-only for standard user accounts, so
without this override `npm install`/`npm create` fail with `EPERM`. No action
needed, just don't delete `.npmrc`.

## 3. Using the app

1. Open http://localhost:5173, pick MNQ, click **Start Session**. Every session starts at that instrument's NY AM open (9:30 America/New_York) on the first day of its data.
2. The stats bar at the top shows the current replay time (fixed UTC+3 / "Helsinki" display), the total history available in the loaded dataset, account balance (starts at $50,000), realized PnL, and running (realized + unrealized) PnL.
3. Click **Next Candle** (or **Ctrl+Space**) to step forward. The **Step** dropdown controls how much underlying time each step advances (1m/5m/1h) — steps always land on an interval boundary minus one minute (e.g. 30m steps land at :29/:59 past the hour), matching how a candle of that size actually closes. The **Timeframe** dropdown only controls how candles are aggregated for display (1m/3m/5m/15m/30m/1h) and is independent of the step size — so you can watch a 15m candle build up 1-minute at a time. The chart auto-fits when you start a session or switch timeframe, but otherwise keeps whatever zoom/pan you set — stepping never yanks the view back.
4. Place an order:
   - **Market** — fills immediately at the current price.
   - **Limit** — set a trigger price to fill on a retrace (buy limit below market, sell limit above market).
   - **Stop** — set a trigger price to fill on a breakout (buy stop above market, sell stop below market).
   - Stop loss / take profit are required for all order types. Pending limit/stop orders show a dotted purple trigger line (plus preview SL/TP lines) on the chart immediately; once filled they switch to the solid entry-line style with live PnL in the label.
5. A toast notification confirms entry (direction, SL, TP) as soon as a position actually opens (immediately for market, on trigger for limit/stop). The chart draws a live entry line (with running PnL), a red SL line, and a green TP line for each open position.
6. Keep stepping — pending limit/stop orders are checked against every revealed candle's high/low and filled on touch; open positions are auto-closed on SL/TP touch (if both are touched in the same candle, stop loss is assumed to hit first).
7. When the data runs out, any still-open positions are force-closed at the last close price, any still-pending orders are cancelled, and a session summary (trade count, win rate, total PnL) is shown.

If you ever see a "session not found" error (e.g. after the backend restarts and its in-memory dev data resets), the app now catches that automatically and returns you to the start screen instead of getting stuck.

### Notes on the time/timezone handling

- The backend forces its Postgres session timezone to UTC (`database.py`) and always stores/serves true UTC timestamps, regardless of the machine's local timezone — this matters for consistent behavior once containerized.
- The frontend shifts every displayed timestamp by a fixed +3 hours ("Helsinki") for display only (`src/time.ts`); this is a flat offset, not DST-aware, matching what was asked for. All PnL/order logic still runs on the true UTC instants from the backend.
- The NY AM session anchor uses real `America/New_York` DST rules (via Python's `zoneinfo`, backed by the `tzdata` package since Windows has no system tz database) to find 9:30 ET precisely, since that's a well-defined real-world market time.

## Ports used

| Service    | Port |
|------------|------|
| Backend    | 8000 |
| Frontend   | 5173 |
| Postgres   | 5432 |

## API endpoints (backend)

| Method | Path                                    | Purpose |
|--------|------------------------------------------|---------|
| GET    | /instruments                              | List instruments and candle counts |
| POST   | /sessions                                 | Start a replay session (`instrument_symbol`); always anchors to that instrument's NY AM (9:30 ET) open |
| GET    | /sessions/{id}                            | Session state |
| GET    | /sessions/{id}/candles?timeframe=15m      | Candles visible so far, aggregated to the given display timeframe (1m/3m/5m/15m/30m/1h) |
| POST   | /sessions/{id}/next                       | Advance `step_minutes` (default 1) base candles; fills pending orders and closes open trades on any SL/TP/trigger touched along the way |
| POST   | /sessions/{id}/trades                     | Place an order (`direction`, `order_type`: market/limit/stop, `price` [trigger, required for limit/stop], `stop_loss`, `take_profit`) |
| GET    | /sessions/{id}/trades                     | List orders/trades (pending, open, closed, cancelled) |
| GET    | /sessions/{id}/summary                    | PnL, win rate, trade/pending/cancelled counts |

Order lifecycle: `pending` (limit/stop waiting to trigger) → `open` (position
live) → `closed` (SL/TP/session-end) or `cancelled` (pending order never
triggered before the session ended). Market orders skip straight to `open`.

## Design notes for containerization later

- All config (DB URL, CORS origin, API URL) is read from environment
  variables via `.env` files — nothing is hardcoded, so these map directly to
  Docker environment variables / compose `environment:` blocks.
- Backend has no local filesystem dependency at runtime (data is loaded into
  Postgres up front via a script, not read from CSV per-request), so the
  container only needs the app code + a DB connection.
- `instruments` is a real table, not a hardcoded symbol — adding a new
  instrument is `generate_synthetic_data.py` (or a real data source) +
  `load_data.py`, no code changes.
