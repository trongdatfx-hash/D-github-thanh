# SPYUSDT.P AI Signal Engine — MVP

Mục tiêu: thu dữ liệu công khai Binance, tạo Basis/Taker/CVD features, huấn luyện xác suất LONG/NEUTRAL/SHORT và backtest walk-forward.

## Chạy Windows 11

```bat
cd ai-engine
py -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python run_mvp.py
```

Không có API key và không đặt lệnh. Nếu Taker historical data không khả dụng, collector sẽ tích lũy live trade data để xây dataset thật.

## Output
- data/*.csv
- models/*.joblib
- reports/backtest.csv
- reports/latest_signal.json
