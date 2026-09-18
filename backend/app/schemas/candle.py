from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CandleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sequence: int
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: int
