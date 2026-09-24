from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.routers import instruments, sessions, trades
from app.logging_config import configure_logging

configure_logging()
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Trading Replay Trainer APICCCCCCC")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(instruments.router)
app.include_router(sessions.router)
app.include_router(trades.router)


@app.get("/health")
def health():
    return {"status": "ok"}
