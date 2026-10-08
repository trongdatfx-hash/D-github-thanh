# NetFlow RTH Lite · V1

Trang độc lập: https://trongdatfx-hash.github.io/D-github-thanh/netflow-rth-lite/
Chỉ thêm thư mục này; không sửa các trang/workflow hiện có. Chạy qua hosting HTTP tĩnh (ES modules), không mở file://.

## Dữ liệu

Binance USDⓈ-M Futures public API: `/fapi/v1/exchangeInfo`, `/fapi/v1/time`, `/fapi/v1/klines`. Xác minh thực tế 2026-10-08: SPYUSDT và QQQUSDT là TRADING / TRADIFI_PERPETUAL / USDT (metadata lưu `symbol-validation.json`). Web vẫn xác minh lại mỗi lần tải, không dùng metadata để thay dữ liệu trực tiếp. Không phải Binance Spot hay dữ liệu giao dịch ETF trên sàn Mỹ.

M5/M15/M30/H1; lịch sử 7/14/30 ngày, phân trang 1000 nến/request. Chỉ chấp nhận nến đã đóng theo thời gian server. Poll 60 giây khi tab hiển thị; yêu cầu timeout 20 giây; không websocket. API lỗi có thể do CORS, hạn chế vùng, HTTP 451/429/418, symbol mất trạng thái hoặc mất mạng. Refresh lỗi giữ dữ liệu cũ kèm thông báo; đổi timeframe/lịch sử xóa dữ liệu cũ. Không có fake data, snapshot fallback, proxy hay đổi symbol ngầm.

BuyQ = kline[10] (taker buy quote asset volume). Quote volume Q = kline[7]. SellQ = Q − BuyQ. NetFlowQ = 2×BuyQ − Q. NF% = 100×NetFlowQ/Q; Q=0 thì NF% để trống.

SPY/QQQ tính riêng; composite chỉ lấy timestamp giao nhau, cộng Q/BuyQ/SellQ/NetFlowQ rồi NF% = 100×ΣNetFlowQ/ΣQ. Tương đương quote-volume weighted NF%; không trung bình đơn giản và không có OHLC composite. Pane giữa hiển thị Taker NetFlowQ (USDT) của SPY/QQQ/composite dưới dạng nến cột quanh mốc 0: xanh khi BuyQ > SellQ, đỏ khi SellQ > BuyQ. Ba nguồn dùng độ trong suốt khác nhau khi chồng lên nhau; có thể bật/tắt riêng. NF% vẫn có trong tooltip và CSV. Dropdown giá chọn symbol nến riêng. Dropdown nguồn Strength chọn nguồn tô màu nến và nguồn pane Strength, kể cả composite.

## Strength & phiên

Strength dùng cùng chuỗi làm mượt đã port trên trang `netflow-ml`: `voldH = NetFlowQ / SMA(quote volume,20)`; `R = sum(voldH,8)`; `Rs = EWMA(R)` với half-life 2 nến và alpha `1−2^(−1/2)`; `sigmaHat = SMA(abs(Rs),500) × sqrt(pi/2)`; `S = 2 × Phi(Rs/sigmaHat) − 1`. Trước khi SMA20 có đủ mẫu, dùng NetFlowQ thô như logic của bản port. Phi dùng xấp xỉ A&S và clamp z ±8. Khác biệt với Pine gốc: đầu vào ở đây là Binance Taker NetFlowQ theo quote volume, không phải `requestUpAndDownVolume` của TradingView. Đổi timeframe làm đổi thời gian làm mượt thực tế; cần ít nhất 507 nến liên tục mới có Strength đầu tiên, nên H1 cần tải 30 ngày.

Timezone America/New_York tự đổi DST. Ngày thường: NIGHT 20:00–04:00, PRE 04:00–09:30, RTH 09:30–16:00, POST 16:00–20:00. Weekend tách riêng không hiệu chỉnh. Chưa có holiday/early close calendar. Nhãn theo giờ mở nến; M30/H1 đi qua ranh giới phiên không tách volume.

Tối đa 500 mẫu raw Strength quá khứ mỗi phiên, tối thiểu 26 mẫu nguồn và RTH. PRE/POST/NIGHT: adjusted = (raw−mean_source)/sd_source×sd_RTH+mean_RTH. RTH giữ raw sau khi đủ mẫu. Không thêm mẫu hiện tại trước khi hiệu chỉnh. Phân phối phẳng/thiếu mẫu để trống, nến xám. Gap reset toàn bộ chuỗi Strength, thống kê phiên và hồi quy. Hiệu chỉnh có thể đổi dấu, không khẳng định dự báo giá tốt hơn.

OLS trên 50 adjusted Strength hợp lệ liên tiếp trước nến hiện tại; dự báo tại chỉ số 50; residual sigma = sqrt(SSE/(50−2)); biên prediction center ±2 sigma. Không dùng nến hiện tại hoặc tương lai để fit, không vẽ hồi quy fit cả đoạn ngược về quá khứ. Biên nằm trên pane Strength, không phải biên giá hoặc khoảng tin cậy 95%. Không có hồi quy khi chuỗi hiệu chỉnh chưa đủ liên tiếp.

Nến xanh/đỏ theo dấu adjusted của nguồn Strength đã chọn; opacity = .25 + .75×min(1,abs(adjusted)/30)×sampleConfidence. sampleConfidence = min(1,min(n_source,n_RTH)/100), chỉ biểu thị độ đủ mẫu, không xác suất thắng. Chưa đủ hiệu chỉnh nến xám.

## Chart & kiểm định

TradingView Lightweight Charts 5.0.9 được lưu cục bộ, Apache 2.0, giữ NOTICE/LICENSE và attribution. Ba pane đồng bộ: candlestick giá, Taker NetFlowQ SPY/QQQ/composite, adjusted Strength + OLS ±2σ. Wheel/pinch zoom, drag pan, normal crosshair xuyên pane, tooltip OHLC cùng quote flows của cả ba nguồn, fit + auto scale từng pane, toggle từng nguồn/Strength/bands/day-RTH markers, responsive mobile. CSV xuất nguồn Strength đang chọn, toàn lịch sử đã tải. Marker RTH là nến đầu có nhãn RTH, nên H1 không thể đánh dấu chính xác 09:30.

`node --test tests/engine.test.mjs` dùng fixture Binance thật từ `../netflow-ml/tests/fixtures/` chỉ để kiểm thử. Kiểm tra quote fields, composite, causal prefix/future mutation, chuỗi làm mượt DVP, regression, gaps, zero volume, DST, symbol validation, pagination. `tests/browser.test.cjs` kiểm chart desktop/mobile và trường hợp API bị chặn; chạy với NODE_PATH trỏ runtime có Playwright.

## ML tương lai

`modelStatus.trained=false`. V1 chưa có dataset nhãn, training hay backtest cho chiến lược này. `engine.mjs` tách khỏi UI/data để thay adapter bằng model có version sau khi có provenance dữ liệu, nhãn RTH, train/validation/test theo thời gian có purge/embargo, walk-forward ngoài mẫu và chi phí giao dịch. Không tự bật ML theo số nến. Hướng dẫn Binance: https://developers.binance.com/docs/derivatives/usds-margined-futures/market-data/rest-api/Kline-Candlestick-Data ; chart: https://tradingview.github.io/lightweight-charts/docs/5.0/ .
