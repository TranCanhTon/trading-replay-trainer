from app.models.trade import TradeDirection
from app.services.trading import calculate_pnl


def test_calculate_pnl_long_profit():
    pnl = calculate_pnl(TradeDirection.long, entry_price=100, exit_price=110)
    assert pnl == 10


def test_calculate_pnl_short_profit():
    pnl = calculate_pnl(TradeDirection.short, entry_price=100, exit_price=90)
    assert pnl == 10