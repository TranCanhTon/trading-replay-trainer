from pydantic import BaseModel, ConfigDict


class InstrumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    symbol: str
    name: str
    candle_count: int
